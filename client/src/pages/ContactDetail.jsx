import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Mail, Phone, MapPin, Edit2, Trash2, Plus, CheckCircle2,
  MessageSquare, PhoneCall, Users, Coffee, Video, ArrowLeft,
  Bell, X, Calendar
} from 'lucide-react';
import { api } from '../api';
import Avatar from '../components/Avatar';
import StarRating from '../components/StarRating';
import Modal from '../components/Modal';
import { format, parseISO, formatDistanceToNow } from 'date-fns';

const INTERACTION_TYPES = [
  { value: 'call', label: 'Phone Call', icon: PhoneCall },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'meeting', label: 'Meeting', icon: Users },
  { value: 'message', label: 'Message', icon: MessageSquare },
  { value: 'coffee', label: 'Coffee/Lunch', icon: Coffee },
  { value: 'video', label: 'Video Call', icon: Video },
  { value: 'other', label: 'Other', icon: Calendar },
];

function InteractionIcon({ type, size = 14 }) {
  const match = INTERACTION_TYPES.find(t => t.value === type);
  const Icon = match?.icon || Calendar;
  return <Icon size={size} />;
}

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [interactionForm, setInteractionForm] = useState({ type: 'call', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
  const [reminderForm, setReminderForm] = useState({ due_date: '', message: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getContact(id).then(setContact).catch(() => navigate('/contacts')).finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!confirm(`Delete ${contact.name}? This cannot be undone.`)) return;
    await api.deleteContact(id);
    navigate('/contacts');
  }

  async function logInteraction() {
    setSaving(true);
    try {
      const interaction = await api.logInteraction(id, interactionForm);
      setContact(c => ({
        ...c,
        interactions: [interaction, ...c.interactions],
        last_contacted: interactionForm.date > (c.last_contacted || '') ? interactionForm.date : c.last_contacted,
      }));
      setShowInteractionModal(false);
      setInteractionForm({ type: 'call', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
    } finally {
      setSaving(false);
    }
  }

  async function addReminder() {
    if (!reminderForm.due_date || !reminderForm.message) return;
    setSaving(true);
    try {
      const reminder = await api.createReminder({ contact_id: id, ...reminderForm });
      setContact(c => ({ ...c, reminders: [...c.reminders, reminder].sort((a, b) => a.due_date.localeCompare(b.due_date)) }));
      setShowReminderModal(false);
      setReminderForm({ due_date: '', message: '' });
    } finally {
      setSaving(false);
    }
  }

  async function completeReminder(rid) {
    await api.updateReminder(rid, { completed: true });
    setContact(c => ({ ...c, reminders: c.reminders.filter(r => r.id !== rid) }));
  }

  async function deleteInteraction(iid) {
    await api.deleteInteraction(id, iid);
    setContact(c => ({ ...c, interactions: c.interactions.filter(i => i.id !== iid) }));
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;
  if (!contact) return null;

  const pendingReminders = contact.reminders?.filter(r => !r.completed) || [];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Back */}
      <Link to="/contacts" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-5">
        <ArrowLeft size={16} /> Back to contacts
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={contact.name} color={contact.avatar_color} size="xl" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{contact.name}</h2>
              <StarRating value={contact.relationship_strength} size="lg" showLabel />
              {contact.last_contacted && (
                <p className="text-sm text-gray-400 mt-1">
                  Last contact: {formatDistanceToNow(parseISO(contact.last_contacted), { addSuffix: true })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/contacts/${id}/edit`}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Edit2 size={14} /> Edit
            </Link>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>

        {/* Contact info */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600 transition-colors">
              <Mail size={15} className="text-gray-400" /> {contact.email}
            </a>
          )}
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600 transition-colors">
              <Phone size={15} className="text-gray-400" /> {contact.phone}
            </a>
          )}
          {contact.how_met && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin size={15} className="text-gray-400" /> Met: {contact.how_met}
            </div>
          )}
        </div>

        {contact.tags?.length > 0 && (
          <div className="flex gap-1.5 mt-4 flex-wrap">
            {contact.tags.map(t => (
              <span key={t} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md text-sm">{t}</span>
            ))}
          </div>
        )}

        {contact.notes && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600 whitespace-pre-wrap">
            {contact.notes}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-5 flex gap-3">
          <button
            onClick={() => setShowInteractionModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} /> Log Interaction
          </button>
          <button
            onClick={() => setShowReminderModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Bell size={16} /> Add Reminder
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {[
          { id: 'overview', label: `Reminders${pendingReminders.length ? ` (${pendingReminders.length})` : ''}` },
          { id: 'timeline', label: `Timeline${contact.interactions?.length ? ` (${contact.interactions.length})` : ''}` },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t.id ? 'bg-white border border-gray-200 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Reminders tab */}
      {tab === 'overview' && (
        <div className="bg-white rounded-xl border border-gray-200">
          {pendingReminders.length === 0 ? (
            <div className="py-12 text-center">
              <Bell size={32} className="mx-auto text-gray-200 mb-3" />
              <p className="text-gray-400 text-sm">No pending reminders</p>
              <button onClick={() => setShowReminderModal(true)} className="mt-3 text-sm text-indigo-600 hover:text-indigo-800">
                Add one
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pendingReminders.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-4">
                  <Bell size={16} className="text-amber-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{r.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{format(parseISO(r.due_date), 'MMM d, yyyy')}</p>
                  </div>
                  <button onClick={() => completeReminder(r.id)} className="text-gray-300 hover:text-green-500 transition-colors" title="Mark done">
                    <CheckCircle2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timeline tab */}
      {tab === 'timeline' && (
        <div className="bg-white rounded-xl border border-gray-200">
          {!contact.interactions?.length ? (
            <div className="py-12 text-center">
              <Calendar size={32} className="mx-auto text-gray-200 mb-3" />
              <p className="text-gray-400 text-sm">No interactions logged yet</p>
              <button onClick={() => setShowInteractionModal(true)} className="mt-3 text-sm text-indigo-600 hover:text-indigo-800">
                Log one
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {contact.interactions.map(i => (
                <div key={i.id} className="flex items-start gap-3 px-5 py-4 group">
                  <div className="p-2 bg-gray-100 rounded-lg text-gray-500 mt-0.5">
                    <InteractionIcon type={i.type} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 capitalize">{i.type}</span>
                      <span className="text-xs text-gray-400">{format(parseISO(i.date), 'MMM d, yyyy')}</span>
                    </div>
                    {i.notes && <p className="text-sm text-gray-500 mt-1">{i.notes}</p>}
                  </div>
                  <button
                    onClick={() => deleteInteraction(i.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-rose-400 transition-all"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Log Interaction Modal */}
      {showInteractionModal && (
        <Modal title="Log Interaction" onClose={() => setShowInteractionModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <div className="grid grid-cols-4 gap-2">
                {INTERACTION_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setInteractionForm(f => ({ ...f, type: t.value }))}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-colors ${
                      interactionForm.type === t.value
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <t.icon size={18} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={interactionForm.date}
                onChange={e => setInteractionForm(f => ({ ...f, date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                value={interactionForm.notes}
                onChange={e => setInteractionForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                placeholder="What did you talk about?"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
            <button
              onClick={logInteraction}
              disabled={saving}
              className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Log Interaction'}
            </button>
          </div>
        </Modal>
      )}

      {/* Add Reminder Modal */}
      {showReminderModal && (
        <Modal title="Add Reminder" onClose={() => setShowReminderModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={reminderForm.due_date}
                onChange={e => setReminderForm(f => ({ ...f, due_date: e.target.value }))}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <input
                type="text"
                value={reminderForm.message}
                onChange={e => setReminderForm(f => ({ ...f, message: e.target.value }))}
                placeholder="e.g. Follow up about job offer"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={addReminder}
              disabled={saving || !reminderForm.due_date || !reminderForm.message}
              className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Add Reminder'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
