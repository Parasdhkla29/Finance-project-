import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { useUIStore } from '../store/useUIStore';
import { useAccountStore } from '../store/useAccountStore';
import { useForm } from 'react-hook-form';
import { exportAllData, downloadJSON, downloadCSV, importData, deleteAllData } from '../core/exportImport';
import { encryptData, decryptData } from '../core/crypto';
import { db } from '../core/db';
import Card, { CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';

const CURRENCIES = [
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'NGN', label: 'NGN — Nigerian Naira' },
  { value: 'ZAR', label: 'ZAR — South African Rand' },
  { value: 'BRL', label: 'BRL — Brazilian Real' },
  { value: 'MXN', label: 'MXN — Mexican Peso' },
  { value: 'CHF', label: 'CHF — Swiss Franc' },
  { value: 'SEK', label: 'SEK — Swedish Krona' },
  { value: 'NOK', label: 'NOK — Norwegian Krone' },
  { value: 'SGD', label: 'SGD — Singapore Dollar' },
];

const THEMES = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
];

interface AccountFormData {
  name: string;
  type: string;
  currency: string;
  color: string;
}

export default function SettingsPage() {
  const { theme, currency, defaultAccountId, setTheme, setCurrency, setDefaultAccountId } = useUIStore();
  const { accounts, load: loadAccounts, add: addAccount, remove: removeAccount } = useAccountStore();

  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showEncryptExport, setShowEncryptExport] = useState(false);
  const [encryptPassphrase, setEncryptPassphrase] = useState('');
  const [encryptResult, setEncryptResult] = useState<string | null>(null);
  const [showDecryptImport, setShowDecryptImport] = useState(false);
  const [decryptPassphrase, setDecryptPassphrase] = useState('');
  const [decryptInput, setDecryptInput] = useState('');
  const [decryptResult, setDecryptResult] = useState<string | null>(null);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { register: regAccount, handleSubmit: handleAccountSubmit, formState: { isSubmitting: isAddingAccount }, reset: resetAccount } = useForm<AccountFormData>({
    defaultValues: { name: '', type: 'checking', currency: 'GBP', color: '#0ea5e9' },
  });

  async function handleExportJSON() {
    setExportLoading(true);
    try {
      const data = await exportAllData();
      downloadJSON(data, `privyledger-export-${format(new Date(), 'yyyy-MM-dd')}.json`);
    } finally {
      setExportLoading(false);
    }
  }

  async function handleExportTransactionsCSV() {
    const txns = await db.transactions.toArray();
    downloadCSV(
      txns.map((t) => ({
        id: t.id,
        date: t.date,
        type: t.type,
        amount: (t.amountMinorUnits / 100).toFixed(2),
        currency: t.currency,
        category: t.category,
        merchant: t.merchant ?? '',
        notes: t.notes ?? '',
        tags: t.tags.join(';'),
      })),
      `privyledger-transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`,
    );
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const text = await file.text();
      await importData(text);
      setImportResult('Import successful!');
    } catch (err) {
      setImportResult(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setImportLoading(false);
      e.target.value = '';
    }
  }

  async function handleEncryptedExport() {
    if (!encryptPassphrase) return;
    try {
      const data = await exportAllData();
      const encrypted = await encryptData(data, encryptPassphrase);
      downloadJSON(
        JSON.stringify({ encrypted, version: 1 }),
        `privyledger-encrypted-${format(new Date(), 'yyyy-MM-dd')}.json`,
      );
      setEncryptResult('Encrypted export downloaded!');
      setEncryptPassphrase('');
    } catch {
      setEncryptResult('Encryption failed. Please try again.');
    }
  }

  async function handleDecryptedImport() {
    if (!decryptPassphrase || !decryptInput) return;
    try {
      const parsed = JSON.parse(decryptInput) as { encrypted: string };
      const decrypted = await decryptData(parsed.encrypted, decryptPassphrase);
      await importData(decrypted);
      setDecryptResult('Decrypted and imported successfully!');
    } catch {
      setDecryptResult('Decryption failed. Wrong passphrase or corrupted file.');
    }
  }

  async function handleDeleteAll() {
    if (deleteConfirmText !== 'DELETE ALL') return;
    await deleteAllData();
    setShowDeleteConfirm(false);
    setDeleteConfirmText('');
    window.location.reload();
  }

  async function handleDeleteAccount() {
    if (!deleteAccountId) return;
    await removeAccount(deleteAccountId);
    setDeleteAccountId(null);
    loadAccounts();
  }

  async function handleAddAccount(data: AccountFormData) {
    await addAccount({
      name: data.name,
      type: data.type as 'checking' | 'savings' | 'cash' | 'credit' | 'investment',
      currency: data.currency,
      color: data.color,
      isArchived: false,
    });
    resetAccount();
    setShowAddAccount(false);
    loadAccounts();
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-slate-100">Settings</h1>

      {/* Privacy notice */}
      <Card className="border-emerald-800 bg-emerald-950/30">
        <div className="flex items-start gap-3">
          <span className="text-emerald-400 text-xl" aria-hidden="true">🔒</span>
          <div>
            <p className="text-sm font-semibold text-emerald-400">Your data is private</p>
            <p className="text-xs text-slate-400 mt-1">
              All data is stored locally in your browser's IndexedDB. Nothing is sent to any server.
              On iOS, open this page in Safari and use <strong className="text-slate-300">"Share → Add to Home Screen"</strong> to install it as an app.
            </p>
          </div>
        </div>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader><CardTitle>Preferences</CardTitle></CardHeader>
        <div className="space-y-4">
          <Select
            label="Theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'dark' | 'light' | 'system')}
            options={THEMES}
          />
          <Select
            label="Default Currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            options={CURRENCIES}
          />
        </div>
      </Card>

      {/* Accounts */}
      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <Button size="sm" variant="secondary" onClick={() => setShowAddAccount(true)}>+ Add</Button>
        </CardHeader>
        {accounts.filter((a) => !a.isArchived && !a.deletedAt).length === 0 ? (
          <p className="text-slate-500 text-sm">No accounts. Add one to link transactions.</p>
        ) : (
          <ul className="divide-y divide-slate-700/50">
            {accounts.filter((a) => !a.isArchived && !a.deletedAt).map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5 relative">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: a.color }} aria-hidden="true" />
                <span className="text-sm text-slate-200 flex-1 truncate">{a.name}</span>
                {defaultAccountId === a.id && (
                  <Badge variant="success">Default</Badge>
                )}
                <Badge variant="info">{a.type}</Badge>
                <Badge>{a.currency}</Badge>

                {/* ── Three-dot menu ── */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => setOpenMenuId(openMenuId === a.id ? null : a.id)}
                    className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                    aria-label={`Options for ${a.name}`}
                    aria-expanded={openMenuId === a.id}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path d="M10 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM10 8.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM11.5 15.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z" />
                    </svg>
                  </button>

                  {openMenuId === a.id && (
                    <>
                      {/* Backdrop to close */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setOpenMenuId(null)}
                        aria-hidden="true"
                      />
                      <div className="absolute right-0 top-full mt-1 z-20 w-44 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                        <button
                          onClick={() => {
                            setDefaultAccountId(defaultAccountId === a.id ? null : a.id);
                            setOpenMenuId(null);
                          }}
                          className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors text-left"
                        >
                          <span className="text-base">{defaultAccountId === a.id ? '☆' : '★'}</span>
                          <span>{defaultAccountId === a.id ? 'Remove default' : 'Set as default'}</span>
                        </button>
                        <div className="h-px bg-slate-700" />
                        <button
                          onClick={() => { setDeleteAccountId(a.id); setOpenMenuId(null); }}
                          className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                            <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z" clipRule="evenodd" />
                          </svg>
                          <span>Delete account</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Export */}
      <Card>
        <CardHeader><CardTitle>Export Data</CardTitle></CardHeader>
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Download all your data as a portable file.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={exportLoading}
              onClick={handleExportJSON}
            >
              Export JSON (full backup)
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportTransactionsCSV}
            >
              Export Transactions CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowEncryptExport(true)}
            >
              Encrypted export
            </Button>
          </div>
        </div>
      </Card>

      {/* Import */}
      <Card>
        <CardHeader><CardTitle>Import Data</CardTitle></CardHeader>
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Import from a previous JSON export. Existing records are preserved (upsert by ID).</p>
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer">
              <span className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 transition-colors ${importLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {importLoading ? 'Importing...' : 'Import JSON'}
              </span>
              <input
                type="file"
                accept=".json"
                className="sr-only"
                onChange={handleImport}
                disabled={importLoading}
              />
            </label>
            <Button variant="secondary" size="sm" onClick={() => setShowDecryptImport(true)}>
              Decrypt and import
            </Button>
          </div>
          {importResult && (
            <p className={`text-xs ${importResult.startsWith('Import successful') ? 'text-emerald-400' : 'text-red-400'}`}>
              {importResult}
            </p>
          )}
        </div>
      </Card>

      {/* iOS Installation tip */}
      <Card>
        <CardHeader><CardTitle>iOS Installation</CardTitle></CardHeader>
        <div className="space-y-2 text-sm text-slate-400">
          <p>To use PrivyLedger as a native-feeling app on your iPhone or iPad:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Open this app in <strong className="text-slate-300">Safari</strong> (not Chrome or other browsers)</li>
            <li>Tap the <strong className="text-slate-300">Share button</strong> (box with arrow icon)</li>
            <li>Select <strong className="text-slate-300">"Add to Home Screen"</strong></li>
            <li>Tap <strong className="text-slate-300">Add</strong></li>
          </ol>
          <p className="text-xs">The app will run offline and your data stays on your device.</p>
        </div>
      </Card>

      {/* Danger zone */}
      <Card className="border-red-900">
        <CardHeader><CardTitle>Danger Zone</CardTitle></CardHeader>
        <p className="text-xs text-slate-500 mb-3">Permanently deletes all data from this device. Export first!</p>
        <Button variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)}>
          Delete All Data
        </Button>
      </Card>

      {/* Encrypted Export modal */}
      <Modal open={showEncryptExport} onClose={() => { setShowEncryptExport(false); setEncryptResult(null); setEncryptPassphrase(''); }} title="Encrypted Export" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Your data will be encrypted with AES-256-GCM using your passphrase before download.
            <strong className="text-slate-200"> Keep the passphrase safe — it cannot be recovered.</strong>
          </p>
          <Input
            label="Passphrase"
            type="password"
            placeholder="Enter a strong passphrase"
            value={encryptPassphrase}
            onChange={(e) => setEncryptPassphrase(e.target.value)}
          />
          {encryptResult && <p className="text-xs text-emerald-400">{encryptResult}</p>}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleEncryptedExport} disabled={!encryptPassphrase}>Download Encrypted</Button>
            <Button variant="ghost" onClick={() => setShowEncryptExport(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Decrypt Import modal */}
      <Modal open={showDecryptImport} onClose={() => { setShowDecryptImport(false); setDecryptResult(null); }} title="Decrypt & Import" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">Paste the contents of your encrypted export file below.</p>
          <textarea
            className="w-full h-24 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
            placeholder='{"encrypted": "..."}'
            value={decryptInput}
            onChange={(e) => setDecryptInput(e.target.value)}
          />
          <Input
            label="Passphrase"
            type="password"
            value={decryptPassphrase}
            onChange={(e) => setDecryptPassphrase(e.target.value)}
          />
          {decryptResult && (
            <p className={`text-xs ${decryptResult.includes('success') ? 'text-emerald-400' : 'text-red-400'}`}>
              {decryptResult}
            </p>
          )}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleDecryptedImport} disabled={!decryptPassphrase || !decryptInput}>
              Decrypt & Import
            </Button>
            <Button variant="ghost" onClick={() => setShowDecryptImport(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete All Data?" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            This will permanently delete <strong className="text-red-400">all transactions, loans, subscriptions, budgets, and goals</strong> from this device. This cannot be undone.
          </p>
          <p className="text-xs text-slate-500">
            Export your data first using the Export section above.
          </p>
          <Input
            label='Type "DELETE ALL" to confirm'
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              variant="danger"
              className="flex-1"
              onClick={handleDeleteAll}
              disabled={deleteConfirmText !== 'DELETE ALL'}
            >
              Delete Everything
            </Button>
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Account confirmation modal */}
      <Modal
        open={!!deleteAccountId}
        onClose={() => setDeleteAccountId(null)}
        title="Delete Account?"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            This will remove{' '}
            <strong className="text-slate-200">
              {accounts.find((a) => a.id === deleteAccountId)?.name ?? 'this account'}
            </strong>{' '}
            from your list. Existing transactions linked to it are preserved.
          </p>
          <div className="flex gap-2">
            <Button variant="danger" className="flex-1" onClick={handleDeleteAccount}>
              Delete
            </Button>
            <Button variant="ghost" onClick={() => setDeleteAccountId(null)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Account modal */}
      <Modal open={showAddAccount} onClose={() => setShowAddAccount(false)} title="Add Account" size="sm">
        <form onSubmit={handleAccountSubmit(handleAddAccount)} className="space-y-4">
          <Input label="Account Name" placeholder="e.g. Barclays Current" required {...regAccount('name', { required: true })} />
          <Select
            label="Type"
            options={[
              { value: 'checking', label: 'Checking / Current' },
              { value: 'savings', label: 'Savings' },
              { value: 'cash', label: 'Cash' },
              { value: 'credit', label: 'Credit Card' },
              { value: 'investment', label: 'Investment' },
            ]}
            {...regAccount('type')}
          />
          <Select label="Currency" options={CURRENCIES} {...regAccount('currency')} />
          <div>
            <label className="text-sm font-medium text-slate-300">Color</label>
            <input type="color" {...regAccount('color')} className="mt-1 block w-12 h-8 rounded cursor-pointer border border-slate-600 bg-transparent" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" loading={isAddingAccount} className="flex-1">Add Account</Button>
            <Button type="button" variant="ghost" onClick={() => setShowAddAccount(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
