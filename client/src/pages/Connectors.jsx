import { useState, useRef } from 'react';
import {
  Smartphone, MessageSquare, Mail, FileText, Cloud,
  MessageCircle, Calendar, Linkedin, Send, CheckCircle2,
  AlertCircle, Plug, RefreshCw
} from 'lucide-react';
import { api } from '../api';

// ── Connector definitions ────────────────────────────────────────────────────

const CONNECTORS = [
  {
    id: 'imessage',
    name: 'iMessage',
    description: "Import contacts and last-contacted dates from your Mac Messages history.",
    icon: MessageSquare,
    color: 'bg-blue-500',
    category: 'Messaging',
    status: 'available',
  },
  {
    id: 'vcf',
    name: 'Phone Contacts',
    description: 'Import from iPhone, Android, iCloud, or any app that exports .vcf files.',
    icon: Smartphone,
    color: 'bg-indigo-500',
    category: 'Contacts',
    status: 'available',
  },
  {
    id: 'csv',
    name: 'CSV / Google Contacts',
    description: 'Import from Google Contacts, Outlook, LinkedIn, or any spreadsheet.',
    icon: FileText,
    color: 'bg-emerald-500',
    category: 'Contacts',
    status: 'available',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Sync contacts and email interactions directly from your Gmail account.',
    icon: Mail,
    color: 'bg-red-500',
    category: 'Email',
    status: 'soon',
  },
  {
    id: 'outlook',
    name: 'Outlook',
    description: 'Connect your Microsoft 365 or Outlook account to sync contacts and emails.',
    icon: Mail,
    color: 'bg-blue-600',
    category: 'Email',
    status: 'soon',
  },
  {
    id: 'google-contacts',
    name: 'Google Contacts',
    description: 'Live sync with Google Contacts — changes update automatically.',
    icon: Cloud,
    color: 'bg-sky-500',
    category: 'Contacts',
    status: 'soon',
  },
  {
    id: 'icloud',
    name: 'iCloud Contacts',
    description: 'Sync contacts directly from your Apple ID / iCloud account.',
    icon: Cloud,
    color: 'bg-gray-600',
    category: 'Contacts',
    status: 'soon',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Log meetings as interactions and sync reminders with your calendar.',
    icon: Calendar,
    color: 'bg-blue-400',
    category: 'Calendar',
    status: 'soon',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Import contacts and track last-contacted dates from WhatsApp.',
    icon: MessageCircle,
    color: 'bg-green-500',
    category: 'Messaging',
    status: 'soon',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Sync Telegram contacts and conversation history.',
    icon: Send,
    color: 'bg-cyan-500',
    category: 'Messaging',
    status: 'soon',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Import your LinkedIn connections with their profiles and job info.',
    icon: Linkedin,
    color: 'bg-blue-700',
    category: 'Social',
    status: 'soon',
  },
];

// ── Sub-components ───────────────────────────────────────────────────────────

function ResultBanner({ result, error }) {
  if (error) return (
    <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs mt-3">
      <AlertCircle size={14} /> {error}
    </div>
  );
  if (!result) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs mt-3">
      <CheckCircle2 size={14} />
      {result.imported} added, {result.merged} merged{result.skipped ? `, ${result.skipped} skipped` : ''}.
    </div>
  );
}

function ConnectorCard({ connector }) {
  const { id, name, description, icon: Icon, color, status } = connector;

  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  async function handleConnect() {
    if (id === 'imessage') {
      setLoading(true); setError(''); setResult(null);
      try {
        const r = await api.importiMessage();
        if (r.error) setError(r.error); else setResult(r);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    } else if (id === 'vcf' || id === 'csv') {
      fileRef.current?.click();
    }
  }

  async function handleFile(file) {
    setLoading(true); setError(''); setResult(null);
    try {
      const r = id === 'vcf' ? await api.importVCF(file) : await api.importCSV(file);
      if (r.error) setError(r.error); else setResult(r);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  const isAvailable = status === 'available';

  return (
    <div className={`bg-white rounded-xl border p-5 flex flex-col gap-3 transition-shadow ${isAvailable ? 'border-gray-200 hover:shadow-md' : 'border-gray-100 opacity-60'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`${color} p-2.5 rounded-xl flex items-center justify-center shrink-0`}>
            <Icon size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{name}</h3>
            <span className="text-xs text-gray-400">{connector.category}</span>
          </div>
        </div>
        {result && <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-1" />}
      </div>

      {/* Description */}
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>

      {/* Action */}
      {isAvailable ? (
        <>
          {(id === 'vcf' || id === 'csv') && (
            <input
              ref={fileRef}
              type="file"
              accept={id === 'vcf' ? '.vcf' : '.csv'}
              className="hidden"
              onChange={e => e.target.files[0] && handleFile(e.target.files[0])}
            />
          )}
          <button
            onClick={handleConnect}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors w-full"
          >
            {loading
              ? <><RefreshCw size={13} className="animate-spin" /> Importing…</>
              : <><Plug size={13} /> {result ? 'Import again' : 'Connect'}</>
            }
          </button>
          <ResultBanner result={result} error={error} />
        </>
      ) : (
        <div className="flex items-center justify-center px-3 py-2 bg-gray-100 text-gray-400 rounded-lg text-xs font-medium w-full">
          Coming soon
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const CATEGORIES = ['All', 'Contacts', 'Email', 'Messaging', 'Calendar', 'Social'];

export default function Connectors() {
  const [filter, setFilter] = useState('All');

  const filtered = CONNECTORS.filter(c => filter === 'All' || c.category === filter);
  const available = filtered.filter(c => c.status === 'available');
  const soon = filtered.filter(c => c.status === 'soon');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Connectors</h2>
        <p className="text-gray-500 mt-1">Connect your apps and services to automatically sync contacts and interactions.</p>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === cat
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Available */}
      {available.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Available now</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {available.map(c => <ConnectorCard key={c.id} connector={c} />)}
          </div>
        </div>
      )}

      {/* Coming soon */}
      {soon.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Coming soon</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {soon.map(c => <ConnectorCard key={c.id} connector={c} />)}
          </div>
        </div>
      )}
    </div>
  );
}
