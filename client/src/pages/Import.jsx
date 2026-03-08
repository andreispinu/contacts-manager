import { useState, useRef } from 'react';
import { Upload, Smartphone, MessageSquare, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { api } from '../api';

function ImportCard({ icon: Icon, title, description, children, accent = 'indigo' }) {
  const colors = {
    indigo: 'border-indigo-200 bg-indigo-50',
    green: 'border-green-200 bg-green-50',
    blue: 'border-blue-200 bg-blue-50',
    purple: 'border-purple-200 bg-purple-50',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start gap-4 mb-4">
        <div className={`p-3 rounded-lg border ${colors[accent]}`}>
          <Icon size={22} className={`text-${accent}-600`} />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function ResultBanner({ result, error }) {
  if (error) return (
    <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm mt-3">
      <AlertCircle size={16} /> {error}
    </div>
  );
  if (!result) return null;
  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm mt-3">
      <CheckCircle2 size={16} />
      {result.imported} new contacts added, {result.merged} merged with existing.
      {result.skipped ? ` ${result.skipped} skipped.` : ''}
    </div>
  );
}

function FileUploadZone({ accept, onFile, loading }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
        dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={e => e.target.files[0] && onFile(e.target.files[0])} />
      <Upload size={24} className="mx-auto text-gray-300 mb-2" />
      <p className="text-sm text-gray-500">{loading ? 'Importing...' : 'Drop file here or click to browse'}</p>
      <p className="text-xs text-gray-400 mt-1">{accept}</p>
    </div>
  );
}

export default function Import() {
  const [vcfResult, setVcfResult] = useState(null);
  const [vcfError, setVcfError] = useState('');
  const [vcfLoading, setVcfLoading] = useState(false);

  const [csvResult, setCsvResult] = useState(null);
  const [csvError, setCsvError] = useState('');
  const [csvLoading, setCsvLoading] = useState(false);

  const [imsgResult, setImsgResult] = useState(null);
  const [imsgError, setImsgError] = useState('');
  const [imsgLoading, setImsgLoading] = useState(false);

  async function importVCF(file) {
    setVcfLoading(true); setVcfError(''); setVcfResult(null);
    try {
      const result = await api.importVCF(file);
      if (result.error) setVcfError(result.error);
      else setVcfResult(result);
    } catch (e) { setVcfError(e.message); }
    finally { setVcfLoading(false); }
  }

  async function importCSV(file) {
    setCsvLoading(true); setCsvError(''); setCsvResult(null);
    try {
      const result = await api.importCSV(file);
      if (result.error) setCsvError(result.error);
      else setCsvResult(result);
    } catch (e) { setCsvError(e.message); }
    finally { setCsvLoading(false); }
  }

  async function importiMessage() {
    setImsgLoading(true); setImsgError(''); setImsgResult(null);
    try {
      const result = await api.importiMessage();
      if (result.error) setImsgError(result.error);
      else setImsgResult(result);
    } catch (e) { setImsgError(e.message); }
    finally { setImsgLoading(false); }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Import Contacts</h2>
        <p className="text-gray-500 mt-1">Bring in contacts from your phone, email, and messaging apps</p>
      </div>

      <div className="space-y-4">
        {/* Phone Contacts / vCard */}
        <ImportCard
          icon={Smartphone}
          title="Phone Contacts (vCard)"
          description="Import from iPhone, Android, or any app that exports .vcf files"
          accent="indigo"
        >
          <div className="mb-3 text-sm text-gray-600 space-y-1">
            <p className="font-medium text-gray-700">How to export:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-500">
              <li><strong>iPhone:</strong> Contacts app → tap contact → scroll down → Share Contact → AirDrop/Files → .vcf</li>
              <li><strong>iCloud:</strong> icloud.com/contacts → select all → Export vCard</li>
              <li><strong>Android:</strong> Contacts app → Menu → Export to .vcf file</li>
              <li><strong>Google:</strong> contacts.google.com → Export → vCard</li>
            </ul>
          </div>
          <FileUploadZone accept=".vcf" onFile={importVCF} loading={vcfLoading} />
          <ResultBanner result={vcfResult} error={vcfError} />
        </ImportCard>

        {/* Google Contacts / CSV */}
        <ImportCard
          icon={FileText}
          title="Google Contacts / CSV"
          description="Import from Google Contacts, Outlook, or any CSV file"
          accent="green"
        >
          <div className="mb-3 text-sm text-gray-600 space-y-1">
            <p className="font-medium text-gray-700">How to export:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-500">
              <li><strong>Google Contacts:</strong> contacts.google.com → Export → Google CSV</li>
              <li><strong>Outlook:</strong> File → Open & Export → Import/Export → Export to CSV</li>
              <li><strong>LinkedIn:</strong> Settings → Data Privacy → Get a copy of your data → Connections</li>
            </ul>
            <p className="text-xs text-gray-400 mt-2">Supported columns: name, email, phone, notes (auto-detected)</p>
          </div>
          <FileUploadZone accept=".csv" onFile={importCSV} loading={csvLoading} />
          <ResultBanner result={csvResult} error={csvError} />
        </ImportCard>

        {/* iMessage */}
        <ImportCard
          icon={MessageSquare}
          title="iMessage (macOS)"
          description="Read your iMessage history to populate last-contacted dates"
          accent="blue"
        >
          <p className="text-sm text-gray-500 mb-4">
            Reads contacts and interaction dates directly from ~/Library/Messages/chat.db.
            Requires <strong>Full Disk Access</strong> granted to Terminal (or this app) in
            System Settings → Privacy & Security → Full Disk Access.
          </p>
          <button
            onClick={importiMessage}
            disabled={imsgLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <MessageSquare size={16} />
            {imsgLoading ? 'Reading iMessage...' : 'Import from iMessage'}
          </button>
          <ResultBanner result={imsgResult} error={imsgError} />
        </ImportCard>
      </div>
    </div>
  );
}
