import { useState } from 'react';
import { TranscriptionRecord } from './Overlay';

interface HistoryPanelProps {
  history: TranscriptionRecord[];
  onClearHistory: () => void;
  onDeleteItem: (id: string) => void;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === now.toDateString()) {
    return 'TODAY';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'YESTERDAY';
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).toUpperCase();
  }
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function groupByDate(history: TranscriptionRecord[]): Map<string, TranscriptionRecord[]> {
  const groups = new Map<string, TranscriptionRecord[]>();
  const sorted = [...history].sort((a, b) => b.timestamp - a.timestamp);

  sorted.forEach((item) => {
    const dateKey = formatDate(item.timestamp);
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(item);
  });

  return groups;
}

export function HistoryPanel({ history, onClearHistory, onDeleteItem }: HistoryPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const groupedHistory = groupByDate(history);

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (history.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-10 min-h-[400px]">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-white mb-3">No transcriptions yet</h2>
          <p className="text-white/40 text-base">
            Your transcription history will appear here. Start dictating to see your transcripts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-10">
      <div className="max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">History</h1>
            <p className="text-white/40 text-sm mt-1">
              {history.length} transcription{history.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClearHistory}
            className="px-4 py-2 text-sm font-semibold text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            Clear all
          </button>
        </div>

        {/* History grouped by date */}
        <div className="space-y-8">
          {Array.from(groupedHistory.entries()).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              {/* Date header */}
              <div className="text-xs font-semibold tracking-wider text-white/40 mb-4 pb-2 border-b border-white/10">
                {dateLabel}
              </div>

              {/* Items for this date */}
              <div className="space-y-1">
                {items.map((item) => (
                  <HistoryItem
                    key={item.id}
                    item={item}
                    onCopy={() => handleCopy(item.text, item.id)}
                    onDelete={() => onDeleteItem(item.id)}
                    isCopied={copiedId === item.id}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HistoryItem({
  item,
  onCopy,
  onDelete,
  isCopied,
}: {
  item: TranscriptionRecord;
  onCopy: () => void;
  onDelete: () => void;
  isCopied: boolean;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className="group flex gap-6 py-4 px-2 -mx-2 rounded-lg hover:bg-white/[0.03] transition-colors"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Time */}
      <div className="flex-shrink-0 w-20 pt-0.5">
        <span className="text-sm text-white/40 font-medium tabular-nums">
          {formatTime(item.timestamp)}
        </span>
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          {item.text}
        </p>
      </div>

      {/* Actions */}
      <div className={`flex-shrink-0 flex items-start gap-1 transition-opacity duration-150 ${showActions ? 'opacity-100' : 'opacity-0'}`}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCopy();
          }}
          className={`p-2 rounded-lg transition-colors ${
            isCopied ? 'bg-white/10 text-white' : 'hover:bg-white/10 text-white/40 hover:text-white'
          }`}
          title={isCopied ? 'Copied!' : 'Copy'}
        >
          {isCopied ? <CheckIcon /> : <CopyIcon />}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
          title="Delete"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
