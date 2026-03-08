import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api';
import StarRating from '../components/StarRating';
import TagInput from '../components/TagInput';
import Avatar from '../components/Avatar';

export default function ContactForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', how_met: '',
    relationship_strength: 3, notes: '', tags: [],
  });
  const [allTags, setAllTags] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getTags().then(t => setAllTags(t.map(x => x.name)));
    if (isEdit) {
      api.getContact(id).then(c => {
        setForm({
          first_name: c.first_name || '',
          last_name: c.last_name || '',
          email: c.email || '',
          phone: c.phone || '',
          how_met: c.how_met || '',
          relationship_strength: c.relationship_strength || 3,
          notes: c.notes || '',
          tags: c.tags || [],
        });
      }).finally(() => setLoading(false));
    }
  }, [id]);

  function set(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.first_name.trim()) { setError('First name is required'); return; }
    setSaving(true);
    try {
      const result = isEdit
        ? await api.updateContact(id, form)
        : await api.createContact(form);
      navigate(`/contacts/${result.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link to={isEdit ? `/contacts/${id}` : '/contacts'} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-5">
        <ArrowLeft size={16} /> {isEdit ? 'Back to contact' : 'Back to contacts'}
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          <Avatar name={[form.first_name, form.last_name].filter(Boolean).join(' ')} color="#6366f1" size="lg" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">{isEdit ? 'Edit Contact' : 'New Contact'}</h2>
            <p className="text-sm text-gray-500 mt-0.5">Fill in what you know — nothing is required except the name</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-rose-500">*</span></label>
              <input
                value={form.first_name}
                onChange={e => set('first_name', e.target.value)}
                placeholder="First name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                value={form.last_name}
                onChange={e => set('last_name', e.target.value)}
                placeholder="Last name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="email@example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">How we met</label>
              <input
                value={form.how_met}
                onChange={e => set('how_met', e.target.value)}
                placeholder="e.g. College, conference in NYC, mutual friend Sarah"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Relationship Strength</label>
              <StarRating
                value={form.relationship_strength}
                onChange={v => set('relationship_strength', v)}
                size="lg"
                showLabel
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
              <TagInput
                tags={form.tags}
                onChange={tags => set('tags', tags)}
                suggestions={allTags}
              />
              <p className="text-xs text-gray-400 mt-1">Press Enter or comma to add. e.g. work, family, college</p>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                rows={4}
                placeholder="Anything you want to remember about this person..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Contact'}
            </button>
            <Link
              to={isEdit ? `/contacts/${id}` : '/contacts'}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
