import { useState } from 'react';
import BottomSheet from '../ui/BottomSheet';
import type { Account } from '../../core/types';
import { PRESET_CATEGORIES, CATEGORY_EMOJIS, loadCustomCategories } from './CategorySheet';

// ── Types ─────────────────────────────────────────────────────────────────

export type DateFilterType =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'custom';

export interface DateFilter {
  type: DateFilterType;
  from?: string;
  to?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

interface SheetFooterProps {
  onClear: () => void;
  onApply: () => void;
  clearLabel?: string;
}
function SheetFooter({ onClear, onApply, clearLabel = 'Clear' }: SheetFooterProps) {
  return (
    <div className="sticky bottom-0 bg-white border-t border-slate-100 px-4 py-3 flex gap-3">
      <button
        onClick={onClear}
        className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
      >
        {clearLabel}
      </button>
      <button
        onClick={onApply}
        className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors"
      >
        Apply
      </button>
    </div>
  );
}

// ── Date Filter ───────────────────────────────────────────────────────────

interface DateFilterSheetProps {
  open: boolean;
  onClose: () => void;
  value: DateFilter;
  onChange: (f: DateFilter) => void;
}

const DATE_OPTIONS: { type: DateFilterType; label: string }[] = [
  { type: 'all', label: 'All Time' },
  { type: 'today', label: 'Today' },
  { type: 'yesterday', label: 'Yesterday' },
  { type: 'this_week', label: 'This Week' },
  { type: 'this_month', label: 'This Month' },
  { type: 'last_month', label: 'Last Month' },
  { type: 'custom', label: 'Custom Range' },
];

export function DateFilterSheet({ open, onClose, value, onChange }: DateFilterSheetProps) {
  const [draft, setDraft] = useState<DateFilter>(value);

  function handleOpen() {
    setDraft(value);
  }

  // Reset draft when sheet opens
  const handleApply = () => {
    onChange(draft);
    onClose();
  };
  const handleClear = () => {
    const cleared: DateFilter = { type: 'all' };
    setDraft(cleared);
    onChange(cleared);
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => { handleOpen(); onClose(); }}
      title="Date Filter"
    >
      <div className="px-4 pt-3 pb-2 space-y-1.5">
        {DATE_OPTIONS.map((opt) => (
          <button
            key={opt.type}
            onClick={() => setDraft({ type: opt.type })}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all text-sm font-medium ${
              draft.type === opt.type
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'border-slate-100 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {opt.label}
            {draft.type === opt.type && <span className="text-blue-600"><CheckIcon /></span>}
          </button>
        ))}

        {/* Custom range inputs */}
        {draft.type === 'custom' && (
          <div className="mt-3 p-4 bg-slate-50 rounded-xl space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">From</label>
              <input
                type="date"
                value={draft.from ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">To</label>
              <input
                type="date"
                value={draft.to ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>
      <SheetFooter onClear={handleClear} onApply={handleApply} />
    </BottomSheet>
  );
}

// ── Type Filter ───────────────────────────────────────────────────────────

interface TypeFilterSheetProps {
  open: boolean;
  onClose: () => void;
  value: string[];
  onChange: (v: string[]) => void;
}

export function TypeFilterSheet({ open, onClose, value, onChange }: TypeFilterSheetProps) {
  const [draft, setDraft] = useState<string[]>(value);

  const options = [
    { id: 'income', label: 'Income', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    { id: 'expense', label: 'Expense', color: 'text-red-700 bg-red-50 border-red-200' },
    { id: 'transfer', label: 'Transfer', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  ];

  const toggle = (id: string) =>
    setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  return (
    <BottomSheet open={open} onClose={onClose} title="Transaction Type">
      <div className="px-4 pt-3 pb-2 space-y-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => toggle(opt.id)}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all text-sm font-medium ${
              draft.includes(opt.id) ? opt.color : 'border-slate-100 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {opt.label}
            {draft.includes(opt.id) && <CheckIcon />}
          </button>
        ))}
      </div>
      <SheetFooter
        onClear={() => { setDraft([]); onChange([]); onClose(); }}
        onApply={() => { onChange(draft); onClose(); }}
      />
    </BottomSheet>
  );
}

// ── Account Filter ────────────────────────────────────────────────────────

interface AccountFilterSheetProps {
  open: boolean;
  onClose: () => void;
  value: string[];
  onChange: (v: string[]) => void;
  accounts: Account[];
}

export function AccountFilterSheet({ open, onClose, value, onChange, accounts }: AccountFilterSheetProps) {
  const [draft, setDraft] = useState<string[]>(value);

  const toggle = (id: string) =>
    setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  const active = accounts.filter((a) => !a.isArchived && !a.deletedAt);

  return (
    <BottomSheet open={open} onClose={onClose} title="Account">
      <div className="px-4 pt-3 pb-2 space-y-1.5">
        <button
          onClick={() => setDraft([])}
          className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-sm font-medium transition-all ${
            draft.length === 0
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'border-slate-100 text-slate-700 hover:bg-slate-50'
          }`}
        >
          All Accounts
          {draft.length === 0 && <span className="text-blue-600"><CheckIcon /></span>}
        </button>
        {active.map((acc) => (
          <button
            key={acc.id}
            onClick={() => toggle(acc.id)}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-sm font-medium transition-all ${
              draft.includes(acc.id)
                ? 'bg-blue-50 border-blue-200'
                : 'border-slate-100 hover:bg-slate-50'
            }`}
          >
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: acc.color }} />
            <span className={`flex-1 text-left ${draft.includes(acc.id) ? 'text-blue-700' : 'text-slate-700'}`}>
              {acc.name}
            </span>
            <span className="text-xs text-slate-400">{acc.currency}</span>
            {draft.includes(acc.id) && <span className="text-blue-600"><CheckIcon /></span>}
          </button>
        ))}
      </div>
      <SheetFooter
        onClear={() => { setDraft([]); onChange([]); onClose(); }}
        onApply={() => { onChange(draft); onClose(); }}
      />
    </BottomSheet>
  );
}

// ── Category Filter ───────────────────────────────────────────────────────

interface CategoryFilterSheetProps {
  open: boolean;
  onClose: () => void;
  value: string[];
  onChange: (v: string[]) => void;
}

export function CategoryFilterSheet({ open, onClose, value, onChange }: CategoryFilterSheetProps) {
  const [draft, setDraft] = useState<string[]>(value);
  const [search, setSearch] = useState('');

  const customCatNames = loadCustomCategories().map((c) => c.name);
  // preset list minus anything the user already named custom (avoid duplicates)
  const presetOnly = PRESET_CATEGORIES.filter((c) => !customCatNames.includes(c));

  const q = search.toLowerCase();
  const filteredCustom = customCatNames.filter((c) => !q || c.toLowerCase().includes(q));
  const filteredPreset = presetOnly.filter((c) => !q || c.toLowerCase().includes(q));

  const toggle = (c: string) =>
    setDraft((d) => (d.includes(c) ? d.filter((x) => x !== c) : [...d, c]));

  function CatButton({ cat }: { cat: string }) {
    return (
      <button
        key={cat}
        onClick={() => toggle(cat)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
          draft.includes(cat) ? 'bg-blue-50 border-blue-200' : 'border-transparent hover:bg-slate-50'
        }`}
      >
        <span className="text-lg w-6 text-center shrink-0">{CATEGORY_EMOJIS[cat] ?? '📌'}</span>
        <span className={`flex-1 text-left ${draft.includes(cat) ? 'text-blue-700' : 'text-slate-700'}`}>
          {cat}
        </span>
        {draft.includes(cat) && <span className="text-blue-600"><CheckIcon /></span>}
      </button>
    );
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Category">
      <div className="px-4 pt-3 pb-1 border-b border-slate-100">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search categories..."
          className="w-full px-4 py-2.5 bg-slate-50 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-transparent"
        />
      </div>
      <div className="px-4 pt-2 pb-2 max-h-80 overflow-y-auto">
        {/* My Categories */}
        {filteredCustom.length > 0 && (
          <>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider pt-2 pb-1">
              My Categories
            </p>
            <div className="space-y-1 mb-2">
              {filteredCustom.map((cat) => <CatButton key={cat} cat={cat} />)}
            </div>
          </>
        )}
        {/* Suggested */}
        {filteredPreset.length > 0 && (
          <>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider pt-2 pb-1">
              {filteredCustom.length > 0 ? 'Suggested' : (search ? 'Results' : 'All Categories')}
            </p>
            <div className="space-y-1">
              {filteredPreset.map((cat) => <CatButton key={cat} cat={cat} />)}
            </div>
          </>
        )}
        {filteredCustom.length === 0 && filteredPreset.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">No categories found</p>
        )}
      </div>
      <SheetFooter
        onClear={() => { setDraft([]); onChange([]); onClose(); setSearch(''); }}
        onApply={() => { onChange(draft); onClose(); setSearch(''); }}
      />
    </BottomSheet>
  );
}

// ── Payment Mode Filter ───────────────────────────────────────────────────

export const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  direct_debit: 'Direct Debit',
  online: 'Online',
  standing_order: 'Standing Order',
  wallet: 'Wallet',
  other: 'Other',
};

interface PaymentModeFilterSheetProps {
  open: boolean;
  onClose: () => void;
  value: string[];
  onChange: (v: string[]) => void;
}

export function PaymentModeFilterSheet({ open, onClose, value, onChange }: PaymentModeFilterSheetProps) {
  const [draft, setDraft] = useState<string[]>(value);

  const modes = Object.entries(PAYMENT_MODE_LABELS);
  const toggle = (m: string) =>
    setDraft((d) => (d.includes(m) ? d.filter((x) => x !== m) : [...d, m]));

  return (
    <BottomSheet open={open} onClose={onClose} title="Payment Mode">
      <div className="px-4 pt-3 pb-2 space-y-1.5">
        {modes.map(([id, label]) => (
          <button
            key={id}
            onClick={() => toggle(id)}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-sm font-medium transition-all ${
              draft.includes(id)
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'border-slate-100 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {label}
            {draft.includes(id) && <CheckIcon />}
          </button>
        ))}
      </div>
      <SheetFooter
        onClear={() => { setDraft([]); onChange([]); onClose(); }}
        onApply={() => { onChange(draft); onClose(); }}
      />
    </BottomSheet>
  );
}

// ── Status Filter ─────────────────────────────────────────────────────────

interface StatusFilterSheetProps {
  open: boolean;
  onClose: () => void;
  value: string[];
  onChange: (v: string[]) => void;
}

export function StatusFilterSheet({ open, onClose, value, onChange }: StatusFilterSheetProps) {
  const [draft, setDraft] = useState<string[]>(value);

  const options = [
    { id: 'completed', label: 'Completed', desc: 'Transactions already done' },
    { id: 'scheduled', label: 'Scheduled / Pending', desc: 'Future or no-date payments' },
  ];
  const toggle = (id: string) =>
    setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  return (
    <BottomSheet open={open} onClose={onClose} title="Status">
      <div className="px-4 pt-3 pb-2 space-y-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => toggle(opt.id)}
            className={`w-full flex items-start gap-3 px-4 py-3.5 rounded-xl border text-left transition-all ${
              draft.includes(opt.id)
                ? 'bg-blue-50 border-blue-200'
                : 'border-slate-100 hover:bg-slate-50'
            }`}
          >
            <div className="flex-1">
              <p className={`text-sm font-semibold ${draft.includes(opt.id) ? 'text-blue-700' : 'text-slate-800'}`}>
                {opt.label}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
            </div>
            {draft.includes(opt.id) && <span className="text-blue-600 mt-0.5"><CheckIcon /></span>}
          </button>
        ))}
      </div>
      <SheetFooter
        onClear={() => { setDraft([]); onChange([]); onClose(); }}
        onApply={() => { onChange(draft); onClose(); }}
      />
    </BottomSheet>
  );
}

// ── Tags Filter ────────────────────────────────────────────────────────────

interface TagsFilterSheetProps {
  open: boolean;
  onClose: () => void;
  value: string[];
  onChange: (v: string[]) => void;
  allTags: string[];
}

export function TagsFilterSheet({ open, onClose, value, onChange, allTags }: TagsFilterSheetProps) {
  const [draft, setDraft] = useState<string[]>(value);
  const [search, setSearch] = useState('');

  const filtered = search
    ? allTags.filter((t) => t.toLowerCase().includes(search.toLowerCase()))
    : allTags;

  const toggle = (t: string) =>
    setDraft((d) => (d.includes(t) ? d.filter((x) => x !== t) : [...d, t]));

  return (
    <BottomSheet open={open} onClose={onClose} title="Tags">
      <div className="px-4 pt-3 pb-1 border-b border-slate-100">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tags..."
          className="w-full px-4 py-2.5 bg-slate-50 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-transparent"
        />
      </div>
      <div className="px-4 pt-3 pb-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No tags found</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filtered.map((tag) => (
              <button
                key={tag}
                onClick={() => toggle(tag)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  draft.includes(tag)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>
      <SheetFooter
        onClear={() => { setDraft([]); onChange([]); onClose(); setSearch(''); }}
        onApply={() => { onChange(draft); onClose(); setSearch(''); }}
      />
    </BottomSheet>
  );
}
