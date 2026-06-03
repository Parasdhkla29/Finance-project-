import { useState, useMemo } from 'react';
import BottomSheet from '../ui/BottomSheet';

// ── Built-in categories ────────────────────────────────────────────────────

export const CATEGORY_EMOJIS: Record<string, string> = {
  Groceries: '🛒',
  'Eating Out': '🍔',
  Transport: '🚗',
  Entertainment: '🎬',
  Health: '💊',
  Shopping: '🛍️',
  Utilities: '💡',
  Bills: '📄',
  Finance: '🏦',
  Income: '💰',
  Salary: '💵',
  Travel: '✈️',
  Education: '📚',
  Charity: '❤️',
  Savings: '🐷',
  Rent: '🏠',
  Gym: '💪',
  Petrol: '⛽',
  Subscriptions: '🔁',
  'Credit Card': '💳',
  Loan: '🏦',
  'Eating In': '🥘',
  Gifts: '🎁',
  Clothing: '👗',
  Technology: '💻',
  Business: '💼',
  Other: '📌',
  Uncategorized: '❓',
};

export const PRESET_CATEGORIES = [
  'Groceries',
  'Eating Out',
  'Transport',
  'Shopping',
  'Bills',
  'Utilities',
  'Health',
  'Entertainment',
  'Salary',
  'Travel',
  'Gym',
  'Petrol',
  'Rent',
  'Subscriptions',
  'Credit Card',
  'Loan',
  'Savings',
  'Finance',
  'Education',
  'Gifts',
  'Clothing',
  'Business',
  'Other',
  'Uncategorized',
];

const CUSTOM_CATS_KEY = 'pl_custom_categories';

interface CustomCategory {
  name: string;
  emoji?: string;
}

export function loadCustomCategories(): CustomCategory[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_CATS_KEY) ?? '[]') as CustomCategory[];
  } catch {
    return [];
  }
}

function saveCustomCategory(cat: CustomCategory): void {
  const existing = loadCustomCategories();
  if (!existing.find((c) => c.name.toLowerCase() === cat.name.toLowerCase())) {
    existing.push(cat);
    localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(existing));
  }
}

// ── AddCategorySheet ───────────────────────────────────────────────────────

interface AddCategorySheetProps {
  open: boolean;
  onClose: () => void;
  onAdded: (name: string) => void;
}

function AddCategorySheet({ open, onClose, onAdded }: AddCategorySheetProps) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    saveCustomCategory({ name: trimmed, emoji: emoji.trim() || undefined });
    onAdded(trimmed);
    setName('');
    setEmoji('');
    onClose();
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Add New Category" zIndex={65}>
      <div className="p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Category Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pet Expenses"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Emoji (optional)
          </label>
          <input
            type="text"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="🐾"
            className="w-24 px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-2xl"
            maxLength={2}
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed active:bg-blue-700 transition-colors"
          >
            Save Category
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3 text-slate-500 font-medium rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

// ── CategorySheet ──────────────────────────────────────────────────────────

interface CategorySheetProps {
  open: boolean;
  onClose: () => void;
  selected: string;
  onSelect: (category: string) => void;
}

export default function CategorySheet({ open, onClose, selected, onSelect }: CategorySheetProps) {
  const [search, setSearch] = useState('');
  const [customCats, setCustomCats] = useState<CustomCategory[]>(() => loadCustomCategories());
  const [showAdd, setShowAdd] = useState(false);

  const allCategories = useMemo(() => {
    const custom = customCats.map((c) => c.name);
    const merged = [...new Set([...custom, ...PRESET_CATEGORIES])];
    return merged;
  }, [customCats]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allCategories;
    const q = search.toLowerCase();
    return allCategories.filter((c) => c.toLowerCase().includes(q));
  }, [allCategories, search]);

  function handleSelect(cat: string) {
    onSelect(cat);
    onClose();
    setSearch('');
  }

  function handleAdded(name: string) {
    setCustomCats(loadCustomCategories());
    onSelect(name);
    onClose();
    setSearch('');
  }

  const frequent = useMemo(() => {
    return PRESET_CATEGORIES.slice(0, 8);
  }, []);

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title="Choose Category" zIndex={60}>
        {/* Search */}
        <div className="px-4 pt-3 pb-2 border-b border-slate-100">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-transparent focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-y-auto pb-6">
          {/* No Category option */}
          <div className="px-4 pt-3 pb-1">
            <button
              onClick={() => handleSelect('')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                selected === ''
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'border-slate-100 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="text-xl">❓</span>
              <span className="text-sm font-medium">No Category</span>
              {selected === '' && (
                <span className="ml-auto text-blue-600">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              )}
            </button>
          </div>

          {/* Frequently used (only when not searching) */}
          {!search && (
            <div className="px-4 pt-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Frequently Used
              </p>
              <div className="grid grid-cols-4 gap-2">
                {frequent.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleSelect(cat)}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all text-center ${
                      selected === cat
                        ? 'bg-blue-50 border-blue-200'
                        : 'border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xl leading-none">
                      {CATEGORY_EMOJIS[cat] ?? '📌'}
                    </span>
                    <span
                      className={`text-xs font-medium leading-tight ${
                        selected === cat ? 'text-blue-700' : 'text-slate-600'
                      }`}
                    >
                      {cat.length > 8 ? cat.slice(0, 8) + '…' : cat}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* All categories list */}
          <div className="px-4 pt-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              {search ? `Results (${filtered.length})` : 'All Categories'}
            </p>
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No categories found</p>
            ) : (
              <div className="space-y-1">
                {filtered.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleSelect(cat)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                      selected === cat
                        ? 'bg-blue-50 border-blue-200'
                        : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-lg w-7 text-center shrink-0">
                      {CATEGORY_EMOJIS[cat] ?? '📌'}
                    </span>
                    <span
                      className={`text-sm font-medium flex-1 ${
                        selected === cat ? 'text-blue-700' : 'text-slate-700'
                      }`}
                    >
                      {cat}
                    </span>
                    {selected === cat && (
                      <span className="text-blue-600 shrink-0">
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add new button */}
          <div className="px-4 pt-3">
            <button
              onClick={() => setShowAdd(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-colors font-medium text-sm"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add New Category
            </button>
          </div>
        </div>
      </BottomSheet>

      <AddCategorySheet
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={handleAdded}
      />
    </>
  );
}
