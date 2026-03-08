import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Smartphone, MessageSquare, Mail, FileText, Cloud,
  MessageCircle, Calendar, Send, CheckCircle2, AlertCircle,
  Plug, RefreshCw, Unplug, Linkedin
} from 'lucide-react';
import { api } from '../api';

// ── Connector definitions ────────────────────────────────────────────────────

const CONNECTORS = [
  {
    id: 'google_calendar',
    provider: 'google',
    name: 'Google Calendar',
    description: 'Fetch meetings with multiple attendees and log them as interactions on your contacts.',
    icon: Calendar,
    color: 'bg-blue-500',
    category: 'Calendar',
    status: 'available',
  },
  {
    id: 'imessage',
    name: 'iMessage',
    description: "Import contacts and last-contacted dates from your Mac Messages history.",
    icon: MessageSquare,
    color: 'bg-blue-400',
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

// ── Google Calendar Card ─────────────────────────────────────────────────────

function GoogleCalendarCard({ connector, connected, onDisconnect }) {
  const { icon: Icon, color, name, description, category } = connector;
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function handleConnect() {
    setLoading(true);
    try {
      const { url } = await api.getGoogleAuthUrl();
      window.location.href = url;
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true); setError(''); setResult(null);
    try {
      const r = await api.syncGoogleCalendar();
      if (r.error) setError(r.error);
      else setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    try {
      await api.disconnectGoogle();
      onDisconnect();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`${color} p-2.5 rounded-xl flex items-center justify-center shrink-0`}>
            <Icon size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{name}</h3>
            <span className="text-xs text-gray-400">{category}</span>
          </div>
        </div>
        {connected && (
          <span className="flex items-center gap-1 text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-full shrink-0">
            <CheckCircle2 size={12} /> Connected
          </span>
        )}
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>

      {connected ? (
        <div className="flex flex-col gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors w-full"
          >
            {syncing
              ? <><RefreshCw size={13} className="animate-spin" /> Syncing…</>
              : <><RefreshCw size={13} /> Sync now</>
            }
          </button>
          <button
            onClick={handleDisconnect}
            className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors w-full"
          >
            <Unplug size={13} /> Disconnect
          </button>

          {result && (
            <div className="px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs">
              <p className="font-medium mb-1">Sync complete</p>
              <p>{result.total_events} meetings scanned · {result.matched} interactions logged · {result.skipped} unmatched attendees</p>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
              <AlertCircle size={13} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            onClick={handleConnect}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors w-full"
          >
            {loading
              ? <><RefreshCw size={13} className="animate-spin" /> Redirecting…</>
              : <><Plug size={13} /> Connect with Google</>
            }
          </button>
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
              <AlertCircle size={13} /> {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Generic file/action connector card ───────────────────────────────────────

function GenericCard({ connector }) {
  const { id, name, description, icon: Icon, color, category, status } = connector;
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
    <div className={`bg-white rounded-xl border p-5 flex flex-col gap-3 transition-shadow ${isAvailable ? 'border-gray-200 hover:shadow-md' : 'border-gray-100 opacity-55'}`}>
      <div className="flex items-center gap-3">
        <div className={`${color} p-2.5 rounded-xl flex items-center justify-center shrink-0`}>
          <Icon size={18} className="text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">{name}</h3>
          <span className="text-xs text-gray-400">{category}</span>
        </div>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>

      {isAvailable ? (
        <>
          {(id === 'vcf' || id === 'csv') && (
            <input ref={fileRef} type="file" accept={id === 'vcf' ? '.vcf' : '.csv'} className="hidden"
              onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
          )}
          <button onClick={handleConnect} disabled={loading}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors w-full">
            {loading
              ? <><RefreshCw size={13} className="animate-spin" /> Importing…</>
              : <><Plug size={13} /> {result ? 'Import again' : 'Connect'}</>
            }
          </button>
          {result && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs">
              <CheckCircle2 size={13} /> {result.imported} added, {result.merged} merged{result.skipped ? `, ${result.skipped} skipped` : ''}.
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
              <AlertCircle size={13} /> {error}
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center px-3 py-2 bg-gray-100 text-gray-400 rounded-lg text-xs font-medium">
          Coming soon
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const CATEGORIES = ['All', 'Calendar', 'Contacts', 'Email', 'Messaging', 'Social'];

export default function Connectors() {
  const [filter, setFilter] = useState('All');
  const [connectorStatus, setConnectorStatus] = useState({});
  const [searchParams, setSearchParams] = useSearchParams();
  const [banner, setBanner] = useState(null); // { type: 'success'|'error', message }

  useEffect(() => {
    api.getConnectorStatus().then(setConnectorStatus).catch(() => {});

    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected === 'google') {
      setBanner({ type: 'success', message: 'Google Calendar connected successfully.' });
      setConnectorStatus(s => ({ ...s, google: { connected: true } }));
    } else if (error) {
      const msgs = {
        access_denied: 'Google access was denied.',
        invalid_state: 'Invalid OAuth state. Please try again.',
        token_exchange: 'Failed to exchange token. Please try again.',
      };
      setBanner({ type: 'error', message: msgs[error] || 'Connection failed.' });
    }
    if (connected || error) setSearchParams({}, { replace: true });
  }, []);

  const filtered = CONNECTORS.filter(c => filter === 'All' || c.category === filter);
  const available = filtered.filter(c => c.status === 'available');
  const soon = filtered.filter(c => c.status === 'soon');

  function renderCard(connector) {
    if (connector.id === 'google_calendar') {
      return (
        <GoogleCalendarCard
          key={connector.id}
          connector={connector}
          connected={!!connectorStatus.google?.connected}
          onDisconnect={() => setConnectorStatus(s => ({ ...s, google: undefined }))}
        />
      );
    }
    return <GenericCard key={connector.id} connector={connector} />;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Connectors</h2>
        <p className="text-gray-500 mt-1">Connect your apps and services to automatically sync contacts and interactions.</p>
      </div>

      {banner && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm mb-5 ${
          banner.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-rose-50 border border-rose-200 text-rose-700'
        }`}>
          {banner.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {banner.message}
          <button onClick={() => setBanner(null)} className="ml-auto text-current opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === cat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {cat}
          </button>
        ))}
      </div>

      {available.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Available now</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {available.map(renderCard)}
          </div>
        </div>
      )}

      {soon.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Coming soon</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {soon.map(renderCard)}
          </div>
        </div>
      )}
    </div>
  );
}
