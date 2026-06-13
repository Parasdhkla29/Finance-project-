# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server with HMR
npm run build     # tsc -b && vite build (type-check + bundle)
npm run lint      # ESLint with flat config
npm run preview   # Preview production build locally
```

There are no tests. The build command (`npm run build`) is the primary correctness check — always run it after changes.

## Environment

Requires a `.env` file with:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Architecture Overview

**PrivyLedger** is a personal finance SPA: React 19 + TypeScript + Vite, Zustand for state, Supabase (PostgreSQL) for persistence, TailwindCSS for styling.

### Routing (`src/App.tsx`)

Two protected portals:
- **User app** (`/dashboard`, `/transactions`, `/loans`, `/credit-cards`, `/subscriptions`, `/budgets`, `/insights`, `/goals`, `/settings`) — gated by `AuthGuard`
- **Admin portal** (`/admin/*`) — gated by `AdminGuard` (requires `role === 'admin'`)
- Public: `/login`, `/change-password`, `/admin/login`

`useAppInit` hook handles boot: restore theme → validate session → on login, seed default account + run recurring rules.

### Auth (`src/auth/useAuthStore.ts`)

Custom session auth via Postgres RPC, **not** Supabase Auth. Calls `login()`, `validate_session()`, `logout()`, `change_own_password()` RPCs. Session token is stored in `localStorage` under `pl_session_token`. A `tempPasswordRequired` flag forces `/change-password` before app access. `getCurrentUserId()` is exported for use inside stores.

### Data Layer (`src/core/db.ts` + `src/core/supabase.ts`)

All DB access goes through a `UserScopedTable<T>` abstraction that mirrors a Dexie-like API:

```typescript
db.transactions.forUser(userId).toArray()   // fetch all (filters user_id + deleted_at IS NULL)
db.transactions.forUser(userId).add(obj)    // insert with user_id injected
db.transactions.forUser(userId).update(id, changes)
db.transactions.forUser(userId).remove(id)  // soft-delete (sets deleted_at)
```

**Every store operation must call `.forUser(getCurrentUserId())`** before querying. Never access `db.tableName` directly without `forUser`.

**camelCase ↔ snake_case** conversion is automatic: `toDb()` converts TypeScript objects to snake_case for writes; `fromDb()` converts DB rows to camelCase. `undefined` → `null` on the way in, `null` → `undefined` on the way out.

### Stores (`src/store/`)

Eight Zustand stores, one per domain:

| Store | Domain |
|---|---|
| `useAccountStore` | Bank/cash accounts |
| `useTransactionStore` | Income / expense / transfer + partial payments + recurring |
| `useLoanStore` | Lent/borrowed loans with payment history |
| `useSubscriptionStore` | Recurring billing subscriptions |
| `useBudgetStore` | Category spend limits |
| `useGoalStore` | Savings goals with `allocateAmount` / `deallocateAmount` |
| `useCreditCardStore` | Credit card accounts and their transactions |
| `useUIStore` | Theme, currency, defaultAccountId, UI toggles (persisted to `pl_settings` in localStorage) |

**Optimistic update pattern** used throughout: call `set()` first to update UI immediately, then `await db...`, and revert on failure by catching the error and calling `set()` again with the original value.

### Types (`src/core/types.ts`)

All entities extend `BaseEntity` (`id`, `createdAt`, `updatedAt`, `deletedAt?`). All monetary values are stored as **minor units** (pence/cents as integers) — never floats. Use `toMinor(major)` to convert from display values, `formatCurrency(minorUnits, currency)` to display.

`isScheduled(t)` returns true for status `'scheduled'`, `'partially_received'`, or `paymentTiming === 'future'`. Partially received income has a `receivedAmountMinorUnits` field representing what's actually arrived.

Goals connect to transactions via `linkedGoalId` on `Transaction` + `allocationType: 'goal'`. When a goal-linked transaction is saved, call `allocateAmount(goalId, amount)`; on delete, call `deallocateAmount(goalId, amount)`.

### TypeScript Constraints

`erasableSyntaxOnly: true` is set — **do not use `enum`** (use `type` unions instead) and avoid decorators or other non-erasable syntax. `verbatimModuleSyntax: true` — use `import type` for type-only imports.

### UI Conventions

- Primitive UI components live in `src/components/ui/` (`Button`, `Card`, `Input`, `Select`, `Modal`, `BottomSheet`, `Badge`, `Textarea`)
- Bottom sheets use `createPortal` to `document.body` — beware of `z-index` layering; nested sheets need a higher `zIndex` prop
- Category metadata (emojis, preset list, custom category CRUD) lives in `src/components/transactions/CategorySheet.tsx` — the `CATEGORY_EMOJIS` record and `loadCustomCategories()` are imported by other files
- Custom categories stored in `localStorage` under `pl_custom_categories`; hidden preset categories under `pl_hidden_preset_categories`

### Database Schema

See `supabase-schema.sql` for the full schema. Tables: `accounts`, `transactions`, `loans`, `subscriptions`, `budgets`, `goals`, `recurring_rules`, `credit_cards`. All have RLS enabled with a permissive `anon_all` policy (single-user app). Migrations are appended at the bottom of `supabase-schema.sql` using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
