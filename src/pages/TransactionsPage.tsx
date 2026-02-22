import { useEffect, useState } from 'react';
import { useTransactionStore } from '../store/useTransactionStore';
import { useAccountStore } from '../store/useAccountStore';
import type { Transaction } from '../core/types';
import { formatCurrency } from '../core/types';
import { format } from 'date-fns';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import TransactionForm from '../components/transactions/TransactionForm';
import Input from '../components/ui/Input';

function TypeBadge({ type }: { type: Transaction['type'] }) {
  if (type === 'income') return <Badge variant="success">Income</Badge>;
  if (type === 'expense') return <Badge variant="danger">Expense</Badge>;
  return <Badge variant="info">Transfer</Badge>;
}

export default function TransactionsPage() {
  const { transactions, load, remove } = useTransactionStore();
  const { accounts, load: loadAccounts } = useAccountStore();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Transaction | undefined>();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    load();
    loadAccounts();
  }, []);

  const filtered = transactions.filter((t) => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.merchant?.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.notes?.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }
    return true;
  });

  function openEdit(txn: Transaction) {
    setEditing(txn);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(undefined);
  }

  async function handleDelete(id: string) {
    await remove(id);
    setConfirmDelete(null);
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-slate-100">Transactions</h1>
        <Button
          onClick={() => { setEditing(undefined); setShowForm(true); }}
          size="sm"
          icon={<span aria-hidden="true">+</span>}
        >
          Add
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex-1 min-w-48">
          <Input
            placeholder="Search merchant, category, tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search transactions"
          />
        </div>
        <div className="flex gap-1">
          {['all', 'income', 'expense', 'transfer'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-2 text-xs rounded-lg font-medium transition-colors ${
                filterType === type
                  ? 'bg-sky-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <p className="text-slate-500 text-sm text-center py-8">
            {transactions.length === 0
              ? 'No transactions yet. Add your first one!'
              : 'No transactions match your filters.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((txn) => (
            <Card key={txn.id} className="flex items-center gap-3">
              {/* Type indicator */}
              <div
                className={`w-2 h-10 rounded-full shrink-0 ${
                  txn.type === 'income'
                    ? 'bg-emerald-500'
                    : txn.type === 'expense'
                      ? 'bg-red-500'
                      : 'bg-sky-500'
                }`}
                aria-hidden="true"
              />

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-sm font-medium truncate ${txn.paymentTiming === 'future' ? 'text-slate-400' : 'text-slate-200'}`}>
                    {txn.merchant ?? txn.category}
                  </p>
                  <TypeBadge type={txn.type} />
                  {txn.paymentTiming === 'future' && (
                    <Badge variant="info">⏳ Scheduled</Badge>
                  )}
                  {txn.isRecurring && (
                    <Badge variant="purple">Recurring</Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {txn.category}
                  {' · '}
                  {txn.paymentTiming === 'future'
                    ? `Expected ${format(new Date(txn.date), 'd MMM yyyy')}`
                    : format(new Date(txn.date), 'd MMM yyyy')}
                  {txn.paymentMethod && ` · ${txn.paymentMethod.replace('_', ' ')}`}
                </p>
                {txn.tags.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {txn.tags.map((tag) => (
                      <span key={tag} className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Amount */}
              <div className="text-right shrink-0">
                <p
                  className={`text-sm font-bold ${
                    txn.type === 'income' ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {txn.type === 'income' ? '+' : '-'}
                  {formatCurrency(txn.amountMinorUnits, txn.currency)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => openEdit(txn)}
                  className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
                  aria-label={`Edit ${txn.merchant ?? txn.category}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
                <button
                  onClick={() => setConfirmDelete(txn.id)}
                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950 rounded-lg transition-colors"
                  aria-label={`Delete ${txn.merchant ?? txn.category}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      <Modal
        open={showForm}
        onClose={closeForm}
        title={editing ? 'Edit Transaction' : 'Add Transaction'}
      >
        <TransactionForm initial={editing} onDone={closeForm} />
      </Modal>

      {/* Confirm delete */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Transaction?"
        size="sm"
      >
        <p className="text-slate-400 text-sm mb-4">
          This will soft-delete the transaction. You can restore it via a JSON export.
        </p>
        <div className="flex gap-2">
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => confirmDelete && handleDelete(confirmDelete)}
          >
            Delete
          </Button>
          <Button variant="ghost" onClick={() => setConfirmDelete(null)} className="flex-1">
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}
