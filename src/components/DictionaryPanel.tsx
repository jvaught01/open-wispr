import { useState } from 'react';

export interface DictionaryEntry {
  id: string;
  original: string;
  corrected: string;
  caseSensitive: boolean;
  enabled: boolean;
  createdAt: number;
}

interface DictionaryPanelProps {
  dictionary: DictionaryEntry[];
  onAddEntry: (entry: Omit<DictionaryEntry, 'id' | 'createdAt'>) => void;
  onUpdateEntry: (id: string, updates: Partial<DictionaryEntry>) => void;
  onDeleteEntry: (id: string) => void;
}

export function DictionaryPanel({
  dictionary,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
}: DictionaryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DictionaryEntry | null>(null);

  const filteredDictionary = dictionary.filter(entry =>
    entry.original.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.corrected.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddClick = () => {
    setEditingEntry(null);
    setShowModal(true);
  };

  const handleEditClick = (entry: DictionaryEntry) => {
    setEditingEntry(entry);
    setShowModal(true);
  };

  const handleSave = (original: string, corrected: string, caseSensitive: boolean) => {
    if (editingEntry) {
      onUpdateEntry(editingEntry.id, { original, corrected, caseSensitive });
    } else {
      onAddEntry({ original, corrected, caseSensitive, enabled: true });
    }
    setShowModal(false);
    setEditingEntry(null);
  };

  const handleToggle = (entry: DictionaryEntry) => {
    onUpdateEntry(entry.id, { enabled: !entry.enabled });
  };

  if (dictionary.length === 0 && !searchQuery) {
    return (
      <div className="flex-1 flex items-center justify-center p-10 min-h-[400px]">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-white mb-3">Dictionary</h2>
          <p className="text-white/40 text-base mb-6">
            Add custom words to improve transcription accuracy. When the AI sees the original word, it will use your preferred spelling.
          </p>
          <button
            onClick={handleAddClick}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-lg font-semibold text-sm hover:bg-white/90 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Add Your First Word
          </button>
        </div>

        {showModal && (
          <DictionaryModal
            entry={editingEntry}
            onSave={handleSave}
            onClose={() => {
              setShowModal(false);
              setEditingEntry(null);
            }}
            existingOriginals={dictionary.map(e => e.original.toLowerCase())}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-10">
      <div className="max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Dictionary</h1>
            <p className="text-white/40 text-sm mt-1">
              {dictionary.length} word{dictionary.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={handleAddClick}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg font-semibold text-sm hover:bg-white/90 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Add Word
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search words..."
            className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors text-sm"
          />
        </div>

        {/* Dictionary entries */}
        <div className="space-y-2">
          {filteredDictionary.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-white/40">No words match your search.</p>
            </div>
          ) : (
            filteredDictionary.map((entry) => (
              <DictionaryItem
                key={entry.id}
                entry={entry}
                onToggle={() => handleToggle(entry)}
                onEdit={() => handleEditClick(entry)}
                onDelete={() => onDeleteEntry(entry.id)}
              />
            ))
          )}
        </div>
      </div>

      {showModal && (
        <DictionaryModal
          entry={editingEntry}
          onSave={handleSave}
          onClose={() => {
            setShowModal(false);
            setEditingEntry(null);
          }}
          existingOriginals={dictionary
            .filter(e => e.id !== editingEntry?.id)
            .map(e => e.original.toLowerCase())}
        />
      )}
    </div>
  );
}

function DictionaryItem({
  entry,
  onToggle,
  onEdit,
  onDelete,
}: {
  entry: DictionaryEntry;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className={`group flex items-center gap-4 p-4 rounded-lg border transition-colors ${
        entry.enabled
          ? 'bg-white/5 border-white/10 hover:bg-white/[0.07]'
          : 'bg-white/[0.02] border-white/5 opacity-60'
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Toggle */}
      <button
        onClick={onToggle}
        className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          entry.enabled
            ? 'bg-white border-white'
            : 'border-white/30 hover:border-white/50'
        }`}
      >
        {entry.enabled && <CheckIcon className="w-3 h-3 text-black" />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className={entry.enabled ? 'text-white' : 'text-white/50'}>
            "{entry.original}"
          </span>
          <ArrowRightIcon className="w-4 h-4 text-white/30 flex-shrink-0" />
          <span className={entry.enabled ? 'text-white font-medium' : 'text-white/50'}>
            "{entry.corrected}"
          </span>
          {entry.caseSensitive && (
            <span className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-white/50 font-medium uppercase">
              Aa
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className={`flex items-center gap-1 transition-opacity duration-150 ${showActions ? 'opacity-100' : 'opacity-0'}`}>
        <button
          onClick={onEdit}
          className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
          title="Edit"
        >
          <EditIcon className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
          title="Delete"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function DictionaryModal({
  entry,
  onSave,
  onClose,
  existingOriginals,
}: {
  entry: DictionaryEntry | null;
  onSave: (original: string, corrected: string, caseSensitive: boolean) => void;
  onClose: () => void;
  existingOriginals: string[];
}) {
  const [original, setOriginal] = useState(entry?.original || '');
  const [corrected, setCorrected] = useState(entry?.corrected || '');
  const [caseSensitive, setCaseSensitive] = useState(entry?.caseSensitive || false);
  const [error, setError] = useState('');

  const isEditing = !!entry;
  const canSave = original.trim() && corrected.trim() && original.trim() !== corrected.trim();

  const handleSave = () => {
    const trimmedOriginal = original.trim();
    const trimmedCorrected = corrected.trim();

    if (!trimmedOriginal || !trimmedCorrected) {
      setError('Both fields are required.');
      return;
    }

    if (trimmedOriginal === trimmedCorrected) {
      setError('Original and corrected must be different.');
      return;
    }

    if (existingOriginals.includes(trimmedOriginal.toLowerCase())) {
      setError('This word already exists in your dictionary.');
      return;
    }

    onSave(trimmedOriginal, trimmedCorrected, caseSensitive);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">
            {isEditing ? 'Edit Word' : 'Add to Dictionary'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              When I say:
            </label>
            <input
              type="text"
              value={original}
              onChange={(e) => {
                setOriginal(e.target.value);
                setError('');
              }}
              placeholder="e.g., tally"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              Use this spelling:
            </label>
            <input
              type="text"
              value={corrected}
              onChange={(e) => {
                setCorrected(e.target.value);
                setError('');
              }}
              placeholder="e.g., tallie"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <button
              type="button"
              onClick={() => setCaseSensitive(!caseSensitive)}
              className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                caseSensitive
                  ? 'bg-white border-white'
                  : 'border-white/30 hover:border-white/50'
              }`}
            >
              {caseSensitive && <CheckIcon className="w-3 h-3 text-black" />}
            </button>
            <span className="text-sm text-white/60">Case sensitive</span>
          </label>

          {/* Preview */}
          {original.trim() && corrected.trim() && (
            <div className="p-3 bg-white/5 rounded-lg">
              <span className="text-xs text-white/40 uppercase tracking-wide font-medium">Preview</span>
              <div className="mt-1 text-sm text-white">
                "{original.trim()}" <ArrowRightIcon className="w-3 h-3 inline text-white/30" /> "{corrected.trim()}"
                {caseSensitive && <span className="text-white/40 ml-2">(case-sensitive)</span>}
              </div>
            </div>
          )}

          {error && (
            <div className="text-red-400 text-sm">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${
              canSave
                ? 'bg-white text-black hover:bg-white/90'
                : 'bg-white/20 text-white/40 cursor-not-allowed'
            }`}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// Icons
function PlusIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function SearchIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function CheckIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ArrowRightIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  );
}

function EditIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function TrashIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function CloseIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
