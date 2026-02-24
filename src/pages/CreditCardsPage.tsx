import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { useCreditCardStore } from '../store/useCreditCardStore';
import type { CreditCard } from '../core/types';
import { formatCurrency, toMinor } from '../core/types';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';

// ── Utility ring gauge ────────────────────────────────────────────────────────

function UtilRing({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const r = 22;
  const circ = 2 * Math.PI * r;
  const fill = (pct / 100) * circ;
  const color = pct >= 80 ? '#f87171' : pct >= 30 ? '#fbbf24' : '#34d399';
  return (
    <div className="relative w-[60px] h-[60px] shrink-0">
      <svg width="60" height="60" viewBox="0 0 60 60" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="30" cy="30" r={r} fill="none" stroke="#334155" strokeWidth="5" />
        <circle
          cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center text-xs font-bold font-mono"
        style={{ color }}
      >
        {pct}%
      </div>
    </div>
  );
}

// ── Card visual ───────────────────────────────────────────────────────────────

function CardVisual({ card }: { card: CreditCard }) {
  const networkLabel =
    card.network === 'visa' ? 'VISA' :
    card.network === 'mastercard' ? 'MC' :
    card.network === 'amex' ? 'AMEX' : '●●';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-600 p-5 min-h-[140px] bg-gradient-to-br from-slate-700 to-slate-900">
      {/* Decorative circles */}
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-sky-500/5 pointer-events-none" />
      <div className="absolute -bottom-8 right-8 w-24 h-24 rounded-full bg-purple-500/5 pointer-events-none" />

      {/* Chip */}
      <div className="w-8 h-6 rounded bg-gradient-to-br from-amber-400 to-amber-600 mb-5 relative z-10" />

      {/* Masked number */}
      <p className="font-mono text-sm tracking-widest text-slate-400 mb-3 relative z-10">
        •••• •••• •••• {card.last4}
      </p>

      {/* Bottom row */}
      <div className="flex items-end justify-between relative z-10">
        <div>
          <p className="text-sm font-semibold tracking-wide text-slate-100 uppercase">{card.name}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">
            <span className="opacity-60">EXPIRES</span> {card.expiry}
          </p>
        </div>
        <p className="text-xl font-bold text-slate-400 opacity-50">{networkLabel}</p>
      </div>

      {/* Overdue badge */}
      {card.status === 'overdue' && (
        <div className="absolute top-3 right-3 bg-red-900/40 border border-red-700 rounded px-2 py-0.5 text-[9px] font-bold text-red-400 tracking-widest uppercase">
          Payment Due
        </div>
      )}
    </div>
  );
}

// ── Add / Edit card form ──────────────────────────────────────────────────────

interface CardFormData {
  name: string;
  last4: string;
  expiry: string;
  network: CreditCard['network'];
  limit: string;
  balance: string;
  minPayment: string;
  dueDate: string;
  apr: string;
  currency: string;
  color: string;
  notes: string;
}

function CardForm({ initial, onDone }: { initial?: CreditCard; onDone: () => void }) {
  const { add, update } = useCreditCardStore();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CardFormData>({
    defaultValues: {
      name: initial?.name ?? '',
      last4: initial?.last4 ?? '',
      expiry: initial?.expiry ?? '',
      network: initial?.network ?? 'visa',
      limit: initial ? String(initial.limitMinorUnits / 100) : '',
      balance: initial ? String(initial.balanceMinorUnits / 100) : '',
      minPayment: initial ? String(initial.minPaymentMinorUnits / 100) : '',
      dueDate: initial?.dueDate ?? '',
      apr: initial ? String(initial.apr) : '',
      currency: initial?.currency ?? 'GBP',
      color: initial?.color ?? '#38bdf8',
      notes: initial?.notes ?? '',
    },
  });

  async function onSubmit(data: CardFormData) {
    const payload = {
      name: data.name,
      last4: data.last4.replace(/\D/g, '').slice(-4),
      expiry: data.expiry,
      network: data.network,
      limitMinorUnits: toMinor(parseFloat(data.limit) || 0),
      balanceMinorUnits: toMinor(parseFloat(data.balance) || 0),
      minPaymentMinorUnits: toMinor(parseFloat(data.minPayment) || 0),
      dueDate: data.dueDate,
      apr: parseFloat(data.apr) || 0,
      cashbackMinorUnits: initial?.cashbackMinorUnits ?? 0,
      status: (initial?.status ?? 'active') as CreditCard['status'],
      color: data.color,
      currency: data.currency || 'GBP',
      notes: data.notes || undefined,
    };
    if (initial) {
      await update(initial.id, payload);
    } else {
      await add(payload);
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Card Name" placeholder="e.g. Barclaycard Avios" required error={errors.name?.message}
        {...register('name', { required: 'Required' })} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Last 4 Digits" placeholder="4321" maxLength={4} required error={errors.last4?.message}
          {...register('last4', { required: 'Required', pattern: { value: /^\d{4}$/, message: '4 digits' } })} />
        <Input label="Expiry (MM/YY)" placeholder="09/27" required error={errors.expiry?.message}
          {...register('expiry', { required: 'Required' })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select label="Network"
          options={[
            { value: 'visa', label: 'Visa' },
            { value: 'mastercard', label: 'Mastercard' },
            { value: 'amex', label: 'Amex' },
            { value: 'other', label: 'Other' },
          ]}
          {...register('network')}
        />
        <Input label="Currency" placeholder="GBP" {...register('currency')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Credit Limit (£)" type="number" step="0.01" min="0" required error={errors.limit?.message}
          {...register('limit', { required: 'Required' })} />
        <Input label="Current Balance (£)" type="number" step="0.01" min="0"
          {...register('balance')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Min. Payment (£)" type="number" step="0.01" min="0"
          {...register('minPayment')} />
        <Input label="APR (%)" type="number" step="0.1" min="0"
          {...register('apr')} />
      </div>
      <Input label="Payment Due Date" type="date" required error={errors.dueDate?.message}
        {...register('dueDate', { required: 'Required' })} />
      <Textarea label="Notes" {...register('notes')} />
      <div className="flex gap-2 pt-2">
        <Button type="submit" loading={isSubmitting} className="flex-1">
          {initial ? 'Update Card' : 'Add Card'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

// ── Record payment form ───────────────────────────────────────────────────────

interface PaymentFormData {
  amount: string;
}

function RecordPaymentForm({ card, onDone }: { card: CreditCard; onDone: () => void }) {
  const { recordPayment } = useCreditCardStore();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<PaymentFormData>({
    defaultValues: { amount: '' },
  });

  async function onSubmit(data: PaymentFormData) {
    await recordPayment(card.id, toMinor(parseFloat(data.amount)));
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <p className="text-sm text-slate-400">
        Current balance:{' '}
        <span className="text-red-400 font-semibold">
          {formatCurrency(card.balanceMinorUnits, card.currency)}
        </span>
      </p>
      <Input label="Payment Amount (£)" type="number" step="0.01" min="0.01" required
        {...register('amount', { required: true })} />
      <div className="flex gap-2 pt-2">
        <Button type="submit" loading={isSubmitting} variant="success" className="flex-1">
          Record Payment
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

// ── Add spend form ────────────────────────────────────────────────────────────

interface SpendFormData {
  merchant: string;
  category: string;
  amount: string;
  date: string;
  notes: string;
}

function AddSpendForm({ card, onDone }: { card: CreditCard; onDone: () => void }) {
  const { addTransaction } = useCreditCardStore();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<SpendFormData>({
    defaultValues: { merchant: '', category: 'Shopping', amount: '', date: new Date().toISOString().split('T')[0], notes: '' },
  });

  async function onSubmit(data: SpendFormData) {
    await addTransaction(card.id, {
      merchant: data.merchant,
      category: data.category,
      amountMinorUnits: toMinor(parseFloat(data.amount)),
      currency: card.currency,
      date: data.date,
      notes: data.notes || undefined,
    });
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Merchant" placeholder="e.g. Tesco" required {...register('merchant', { required: true })} />
      <Input label="Category" placeholder="e.g. Groceries" required {...register('category', { required: true })} />
      <Input label="Amount (£)" type="number" step="0.01" min="0.01" required
        {...register('amount', { required: true })} />
      <Input label="Date" type="date" required {...register('date', { required: true })} />
      <Textarea label="Notes" {...register('notes')} />
      <div className="flex gap-2 pt-2">
        <Button type="submit" loading={isSubmitting} className="flex-1">Add Spend</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = (msg: string) => {
    clearTimeout(timer.current);
    setToast(msg);
    timer.current = setTimeout(() => setToast(null), 2200);
  };
  return { toast, show };
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CreditCardsPage() {
  const { cards, load, remove } = useCreditCardStore();
  const [activeIdx, setActiveIdx] = useState(0);
  const [showAddCard, setShowAddCard] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | undefined>();
  const [payingCard, setPayingCard] = useState<CreditCard | undefined>();
  const [spendCard, setSpendCard] = useState<CreditCard | undefined>();
  const { toast, show: showToast } = useToast();

  useEffect(() => { load(); }, []);

  // Keep activeIdx in bounds when cards change
  useEffect(() => {
    if (activeIdx >= cards.length && cards.length > 0) setActiveIdx(cards.length - 1);
  }, [cards.length]);

  const totalBalance = cards.reduce((s, c) => s + c.balanceMinorUnits, 0);
  const totalMinPayment = cards.reduce((s, c) => s + c.minPaymentMinorUnits, 0);

  const card = cards[activeIdx];

  function handleDelete(id: string) {
    remove(id);
    showToast('Card removed');
    setActiveIdx(0);
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Credit Cards</h1>
        <Button size="sm" icon={<span>+</span>} onClick={() => { setEditingCard(undefined); setShowAddCard(true); }}>
          Add Card
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Balance</p>
          <p className="text-lg font-bold text-red-400 mt-1">{formatCurrency(totalBalance, 'GBP')}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Min. Due</p>
          <p className="text-lg font-bold text-amber-400 mt-1">{formatCurrency(totalMinPayment, 'GBP')}</p>
        </Card>
      </div>

      {/* Empty state */}
      {cards.length === 0 && (
        <Card>
          <p className="text-slate-500 text-sm text-center py-10">
            No credit cards added yet.{' '}
            <button className="text-sky-400 hover:underline" onClick={() => setShowAddCard(true)}>
              Add your first card
            </button>
          </p>
        </Card>
      )}

      {cards.length > 0 && (
        <>
          {/* Card selector tabs */}
          {cards.length > 1 && (
            <div className="flex gap-2">
              {cards.map((cc, i) => (
                <button
                  key={cc.id}
                  onClick={() => setActiveIdx(i)}
                  className={`flex-1 px-3 py-2 rounded-xl border text-left transition-all ${
                    activeIdx === i
                      ? 'border-sky-500 bg-sky-500/10'
                      : 'border-slate-700 bg-transparent hover:border-slate-500'
                  }`}
                >
                  <p className={`text-xs font-bold ${activeIdx === i ? 'text-sky-400' : 'text-slate-400'}`}>
                    {cc.name.split(' ')[0]}
                  </p>
                  <p className="text-[10px] text-slate-500">···· {cc.last4}</p>
                </button>
              ))}
            </div>
          )}

          {card && (
            <>
              {/* Card visual */}
              <CardVisual card={card} />

              {/* Utilisation ring */}
              <Card>
                <div className="flex items-center gap-4">
                  <UtilRing used={card.balanceMinorUnits} limit={card.limitMinorUnits} />
                  <div>
                    <p className="text-sm font-semibold text-slate-200 mb-1">Credit Utilisation</p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {formatCurrency(card.balanceMinorUnits, card.currency)} of{' '}
                      {formatCurrency(card.limitMinorUnits, card.currency)} used
                    </p>
                    {card.limitMinorUnits > 0 && (
                      <p className={`text-xs mt-0.5 ${
                        (card.balanceMinorUnits / card.limitMinorUnits) >= 0.3
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}>
                        {(card.balanceMinorUnits / card.limitMinorUnits) >= 0.3
                          ? '⚠ High utilisation hurts your credit score'
                          : '✓ Healthy utilisation'}
                      </p>
                    )}
                  </div>
                </div>
              </Card>

              {/* Key details */}
              <Card className="space-y-1">
                <DetailRow label="Current Balance">
                  <span className="text-red-400">{formatCurrency(card.balanceMinorUnits, card.currency)}</span>
                </DetailRow>
                <Divider />
                <DetailRow label="Credit Limit">
                  <span className="text-slate-200">{formatCurrency(card.limitMinorUnits, card.currency)}</span>
                </DetailRow>
                <DetailRow label="Available Credit">
                  <span className="text-emerald-400">
                    {formatCurrency(Math.max(0, card.limitMinorUnits - card.balanceMinorUnits), card.currency)}
                  </span>
                </DetailRow>
                <Divider />
                <DetailRow label="Min. Payment">
                  <span className="text-amber-400">{formatCurrency(card.minPaymentMinorUnits, card.currency)}</span>
                </DetailRow>
                <DetailRow label="Payment Due">
                  <span className={card.status === 'overdue' ? 'text-red-400' : 'text-slate-200'}>
                    {card.dueDate ? format(new Date(card.dueDate), 'd MMM yyyy') : '—'}
                  </span>
                </DetailRow>
                <DetailRow label="Purchase APR">
                  <span className="text-slate-200">{card.apr}%</span>
                </DetailRow>
                {card.cashbackMinorUnits > 0 && (
                  <DetailRow label="Cashback Earned">
                    <span className="text-emerald-400">{formatCurrency(card.cashbackMinorUnits, card.currency)}</span>
                  </DetailRow>
                )}
              </Card>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => setPayingCard(card)}>
                  💸 Record Payment
                </Button>
                <Button variant="secondary" className="flex-1" onClick={() => setSpendCard(card)}>
                  + Add Spend
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setEditingCard(card); setShowAddCard(true); }}>
                  Edit Card
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(card.id)}>
                  Remove
                </Button>
              </div>

              {/* Recent transactions */}
              {card.transactions.length > 0 && (
                <>
                  <SectionLabel>Recent Transactions</SectionLabel>
                  <Card className="divide-y divide-slate-700/50">
                    {[...card.transactions]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .slice(0, 10)
                      .map((t) => (
                        <div key={t.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center text-base shrink-0">
                              {t.icon ?? '💳'}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-200">{t.merchant}</p>
                              <p className="text-[10px] text-slate-500">
                                {t.category} · {t.date ? format(new Date(t.date), 'd MMM') : ''}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-red-400 font-mono">
                            -{formatCurrency(t.amountMinorUnits, t.currency)}
                          </span>
                        </div>
                      ))}
                  </Card>
                </>
              )}

              {/* Payoff scenarios */}
              <SectionLabel>💡 Payoff Scenarios</SectionLabel>
              {[
                {
                  icon: '🐢',
                  title: 'Minimum payments only',
                  desc: card.minPaymentMinorUnits > 0
                    ? `At min ${formatCurrency(card.minPaymentMinorUnits, card.currency)}/mo, cleared in ~${Math.ceil(card.balanceMinorUnits / card.minPaymentMinorUnits)} months. Estimated interest: ${formatCurrency(Math.round(card.balanceMinorUnits * 0.35), card.currency)}.`
                    : 'Set a minimum payment to see this estimate.',
                  accent: 'text-red-400',
                  border: 'hover:border-red-800',
                },
                {
                  icon: '⚡',
                  title: `Pay ${formatCurrency(15000, card.currency)}/month`,
                  desc: `Cleared in ~${Math.ceil(card.balanceMinorUnits / 15000)} months. Estimated interest: ${formatCurrency(Math.round(card.balanceMinorUnits * 0.12), card.currency)}.`,
                  accent: 'text-amber-400',
                  border: 'hover:border-amber-800',
                },
                {
                  icon: '🚀',
                  title: 'Pay full balance now',
                  desc: `Clear ${formatCurrency(card.balanceMinorUnits, card.currency)} today — zero interest. Frees ${formatCurrency(Math.max(0, card.limitMinorUnits - card.balanceMinorUnits), card.currency)} in available credit.`,
                  accent: 'text-emerald-400',
                  border: 'hover:border-emerald-800',
                },
              ].map((s, i) => (
                <Card
                  key={i}
                  onClick={() => showToast(`Scenario: ${s.title}`)}
                  className={`cursor-pointer transition-colors ${s.border}`}
                >
                  <p className={`text-sm font-semibold mb-1 flex items-center gap-2 ${s.accent}`}>
                    <span>{s.icon}</span>
                    <span>{s.title}</span>
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed">{s.desc}</p>
                </Card>
              ))}

              {/* Interest tracker */}
              <SectionLabel>📅 Interest Tracker</SectionLabel>
              <Card className="space-y-1">
                <DetailRow label="Daily interest charge">
                  <span className="text-amber-400 font-mono text-xs">
                    {formatCurrency(Math.round((card.balanceMinorUnits * card.apr) / 100 / 365), card.currency)}
                  </span>
                </DetailRow>
                <DetailRow label="Monthly interest (est.)">
                  <span className="text-amber-400 font-mono text-xs">
                    {formatCurrency(Math.round((card.balanceMinorUnits * card.apr) / 100 / 12), card.currency)}
                  </span>
                </DetailRow>
                <DetailRow label="Interest-free period">
                  <span className="text-emerald-400 text-xs">Up to 56 days</span>
                </DetailRow>
              </Card>

              {/* Status & notes */}
              <div className="flex items-center gap-2">
                <Badge variant={card.status === 'active' ? 'info' : card.status === 'overdue' ? 'danger' : 'default'}>
                  {card.status.charAt(0).toUpperCase() + card.status.slice(1)}
                </Badge>
                {card.notes && (
                  <p className="text-xs text-slate-500 italic">{card.notes}</p>
                )}
              </div>

              {/* Feature list */}
              <SectionLabel>🗂 Features</SectionLabel>
              {[
                ['Balance transfers', 'Track promotional 0% periods and fees'],
                ['Cash advances', 'Flag high-APR cash withdrawals separately'],
                ['Foreign transactions', 'Mark FX fees; show in original currency'],
                ['Rewards & points', 'Track cashback, Avios, Nectar, or points'],
                ['Direct debit setup', 'Log full/min/custom DD amount and date'],
                ['Statement history', 'Monthly statements with export'],
                ['Credit score impact', 'Utilisation warning when above 30%'],
                ['Fraud alerts', 'Flag unusual transactions for review'],
              ].map(([title, desc], i) => (
                <Card key={i} onClick={() => showToast(`${title} — coming soon`)} className="cursor-pointer py-3">
                  <p className="text-xs font-semibold text-slate-300">{title}</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{desc}</p>
                </Card>
              ))}
            </>
          )}
        </>
      )}

      {/* Modals */}
      <Modal
        open={showAddCard}
        onClose={() => { setShowAddCard(false); setEditingCard(undefined); }}
        title={editingCard ? 'Edit Card' : 'Add Credit Card'}
      >
        <CardForm
          initial={editingCard}
          onDone={() => { setShowAddCard(false); setEditingCard(undefined); }}
        />
      </Modal>

      <Modal open={!!payingCard} onClose={() => setPayingCard(undefined)} title="Record Payment" size="sm">
        {payingCard && (
          <RecordPaymentForm card={payingCard} onDone={() => { setPayingCard(undefined); showToast('Payment recorded'); }} />
        )}
      </Modal>

      <Modal open={!!spendCard} onClose={() => setSpendCard(undefined)} title="Add Spend" size="sm">
        {spendCard && (
          <AddSpendForm card={spendCard} onDone={() => { setSpendCard(undefined); showToast('Spend added'); }} />
        )}
      </Modal>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-100 z-[200] shadow-xl whitespace-nowrap animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Small shared helpers ──────────────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-1 rounded-lg hover:bg-slate-700/30 transition-colors">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-semibold font-mono">{children}</span>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-slate-700/50 my-1" />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold tracking-widest text-slate-500 uppercase mt-2">{children}</p>
  );
}
