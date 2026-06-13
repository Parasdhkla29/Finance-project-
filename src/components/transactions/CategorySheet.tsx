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
const HIDDEN_PRESETS_KEY = 'pl_hidden_preset_categories';

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

function saveCustomCategories(cats: CustomCategory[]): void {
  localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(cats));
}

function loadHiddenPresets(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HIDDEN_PRESETS_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function saveHiddenPresets(hidden: string[]): void {
  localStorage.setItem(HIDDEN_PRESETS_KEY, JSON.stringify(hidden));
}

// ── Emoji picker options ───────────────────────────────────────────────────

const EMOJI_PICKS = [
  '🛒', '🍔', '🚗', '🎬', '💊', '🛍️', '💡', '📄',
  '🏦', '💰', '💵', '✈️', '📚', '❤️', '🐷', '🏠',
  '💪', '⛽', '🔁', '💳', '🎁', '👗', '💻', '💼',
  '📌', '🐾', '🎮', '🍕', '☕', '🎵', '📱', '🌍',
  '🐶', '⚽', '🎉', '🎯', '🔑', '📦', '🍎', '🌸',
  '🏋️', '🏖️', '🚿', '🧴', '🧺', '🏃', '🎪', '🥘',
];

// ── CategoryFormSheet (Add / Edit) ─────────────────────────────────────────

interface CategoryFormSheetProps {
  open: boolean;
  onClose: () => void;
  onSaved: (name: string, isEdit: boolean) => void;
  initial?: CustomCategory;
}

function CategoryFormSheet({ open, onClose, onSaved, initial }: CategoryFormSheetProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? '');

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = loadCustomCategories();
    if (initial) {
      const updated = existing.map((c) =>
        c.name === initial.name
          ? { name: trimmed, emoji: emoji.trim() || undefined }
          : c
      );
      saveCustomCategories(updated);
    } else {
      if (!existing.find((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
        existing.push({ name: trimmed, emoji: emoji.trim() || undefined });
        saveCustomCategories(existing);
      }
    }
    onSaved(trimmed, !!initial);
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={initial ? 'Edit Category' : 'Add Category'} zIndex={65}>
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
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Pick an Emoji
          </label>
          {/* Emoji grid */}
          <div className="grid grid-cols-8 gap-1.5 mb-3 max-h-36 overflow-y-auto rounded-xl border border-slate-100 p-2 bg-slate-50">
            {EMOJI_PICKS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={`text-xl py-1.5 rounded-lg border transition-all active:scale-90 ${
                  emoji === e
                    ? 'bg-blue-100 border-blue-300'
                    : 'border-transparent hover:bg-white hover:border-slate-200'
                }`}
              >
                {e}
              </button>
            ))}
          </div>

          {/* Custom text input */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="Or type / paste any emoji…"
              className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            {emoji && (
              <div className="w-11 h-11 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200 shrink-0">
                <span className="text-2xl leading-none">{emoji}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed active:bg-blue-700 transition-colors"
          >
            {initial ? 'Save Changes' : 'Add Category'}
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

// ── CategoryRow ────────────────────────────────────────────────────────────

function CategoryRow({
  cat,
  selected,
  emojiMap,
  onSelect,
  isCustom,
  onEdit,
  onDelete,
}: {
  cat: string;
  selected: string;
  emojiMap: Record<string, string>;
  onSelect: (c: string) => void;
  isCustom: boolean;
  onEdit?: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`flex items-center rounded-xl border transition-all ${
        selected === cat ? 'bg-blue-50 border-blue-200' : 'border-transparent hover:bg-slate-50'
      }`}
    >
      <button
        onClick={() => onSelect(cat)}
        className="flex-1 flex items-center gap-3 px-4 py-3 text-left min-w-0"
      >
        <span className="text-lg w-7 text-center shrink-0">{emojiMap[cat] ?? '📌'}</span>
        <span
          className={`text-sm font-medium flex-1 truncate ${
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

      {/* Action buttons */}
      <div className="flex items-center gap-0.5 pr-2 shrink-0">
        {isCustom && onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
            aria-label="Edit category"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
          aria-label="Delete category"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
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
  const [hiddenPresets, setHiddenPresets] = useState<string[]>(() => loadHiddenPresets());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CustomCategory | undefined>();

  const emojiMap = useMemo(() => {
    const map: Record<string, string> = { ...CATEGORY_EMOJIS };
    customCats.forEach((c) => { if (c.emoji) map[c.name] = c.emoji; });
    return map;
  }, [customCats]);

  const allCategories = useMemo(() => {
    const customNames = customCats.map((c) => c.name);
    const visiblePresets = PRESET_CATEGORIES.filter((p) => !hiddenPresets.includes(p));
    return [...new Set([...customNames, ...visiblePresets])];
  }, [customCats, hiddenPresets]);

  const customNames = useMemo(() => customCats.map((c) => c.name), [customCats]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allCategories;
    const q = search.toLowerCase();
    return allCategories.filter((c) => c.toLowerCase().includes(q));
  }, [allCategories, search]);

  const filteredCustom = filtered.filter((c) => customNames.includes(c));
  const filteredPreset = filtered.filter((c) => !customNames.includes(c));

  function handleSelect(cat: string) {
    onSelect(cat);
    onClose();
    setSearch('');
  }

  function handleSaved(name: string, isEdit: boolean) {
    const cats = loadCustomCategories();
    cats.forEach((c) => { if (c.emoji) CATEGORY_EMOJIS[c.name] = c.emoji; });
    setCustomCats(cats);
    setShowForm(false);
    setEditing(undefined);
    if (!isEdit) {
      onSelect(name);
      onClose();
      setSearch('');
    }
  }

  function handleDeleteCustom(name: string) {
    const updated = loadCustomCategories().filter((c) => c.name !== name);
    saveCustomCategories(updated);
    setCustomCats(updated);
    if (selected === name) onSelect('');
  }

  function handleDeletePreset(name: string) {
    const updated = [...hiddenPresets, name];
    saveHiddenPresets(updated);
    setHiddenPresets(updated);
    if (selected === name) onSelect('');
  }

  function openEdit(cat: string) {
    const found = customCats.find((c) => c.name === cat);
    if (found) {
      setEditing(found);
      setShowForm(true);
    }
  }

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
              placeholder="Search categories…"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-transparent"
            />
          </div>
        </div>

        <div className="overflow-y-auto pb-6">
          {/* No Category */}
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

          {filtered.length === 0 ? (
            <div className="px-4 pt-3">
              <p className="text-sm text-slate-400 text-center py-6">No categories found</p>
            </div>
          ) : (
            <>
              {/* My Categories (custom) */}
              {filteredCustom.length > 0 && (
                <div className="px-4 pt-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    My Categories
                  </p>
                  <div className="space-y-1">
                    {filteredCustom.map((cat) => (
                      <CategoryRow
                        key={cat}
                        cat={cat}
                        selected={selected}
                        emojiMap={emojiMap}
                        onSelect={handleSelect}
                        isCustom
                        onEdit={() => openEdit(cat)}
                        onDelete={() => handleDeleteCustom(cat)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* All preset categories */}
              {filteredPreset.length > 0 && (
                <div className="px-4 pt-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    {search.trim() ? `Results (${filteredPreset.length})` : 'All Categories'}
                  </p>
                  <div className="space-y-1">
                    {filteredPreset.map((cat) => (
                      <CategoryRow
                        key={cat}
                        cat={cat}
                        selected={selected}
                        emojiMap={emojiMap}
                        onSelect={handleSelect}
                        isCustom={false}
                        onDelete={() => handleDeletePreset(cat)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Add new category */}
          <div className="px-4 pt-4">
            <button
              onClick={() => { setEditing(undefined); setShowForm(true); }}
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

      <CategoryFormSheet
        key={editing ? editing.name : '__add__'}
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(undefined); }}
        onSaved={handleSaved}
        initial={editing}
      />
    </>
  );
}
