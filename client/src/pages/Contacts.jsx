import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, SlidersHorizontal, X, AlertCircle } from 'lucide-react';
import { api } from '../api';
import Avatar from '../components/Avatar';
import StarRating from '../components/StarRating';
import { formatDistanceToNow, parseISO } from 'date-fns';

const RELATIONSHIP_CATEGORIES = [
  'Friends', 'Close Friends', 'Smart Friends', 'Family & Relatives',
  'Colleagues', 'Trainer & Coach', 'Mentors', 'Acquaintances',
  'References', 'Followers',
];

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'strength', label: 'Relationship' },
  { value: 'last_contacted', label: 'Needs contact' },
  { value: 'recent', label: 'Recently updated' },
];

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('search') || '';
  const strength = searchParams.get('strength') || '';
  const tag = searchParams.get('tag') || '';
  const category = searchParams.get('category') || '';
  const sort = searchParams.get('sort') || 'name';
  const overdue = searchParams.get('overdue') || '';

  const setParam = (key, value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    });
  };

  const fetchContacts = useCallback(() => {
    const params = {};
    if (search) params.search = search;
    if (strength) params.strength = strength;
    if (tag) params.tag = tag;
    if (category) params.category = category;
    if (sort) params.sort = sort;
    if (overdue) params.overdue = overdue;
    api.getContacts(params).then(setContacts).finally(() => setLoading(false));
  }, [search, strength, tag, category, sort, overdue]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);
  useEffect(() => { api.getTags().then(t => setTags(t.map(x => x.name))); }, []);

  const hasFilters = search || strength || tag || category || overdue;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Contacts</h2>
          <p className="text-gray-500 mt-1">{contacts.length} people</p>
        </div>
        <Link
          to="/contacts/new"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          Add Contact
        </Link>
      </div>

      {/* Search + Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setParam('search', e.target.value)}
              placeholder="Search by name, email, phone, notes..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {search && (
              <button onClick={() => setParam('search', '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          <select
            value={sort}
            onChange={e => setParam('sort', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="flex gap-2 mt-3 flex-wrap">
          {/* Strength filter */}
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                onClick={() => setParam('strength', strength === String(s) ? '' : String(s))}
                className={`px-2.5 py-1 rounded-md text-sm transition-colors ${
                  strength === String(s) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {'★'.repeat(s)}
              </button>
            ))}
          </div>

          {/* Overdue filter */}
          <button
            onClick={() => setParam('overdue', overdue ? '' : 'true')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-sm transition-colors ${
              overdue ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <AlertCircle size={13} />
            Needs follow-up
          </button>

          {/* Category filters */}
          {RELATIONSHIP_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setParam('category', category === cat ? '' : cat)}
              className={`px-2.5 py-1 rounded-md text-sm transition-colors ${
                category === cat ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}

          {/* Tag filters */}
          {tags.map(t => (
            <button
              key={t}
              onClick={() => setParam('tag', tag === t ? '' : t)}
              className={`px-2.5 py-1 rounded-md text-sm transition-colors ${
                tag === t ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t}
            </button>
          ))}

          {hasFilters && (
            <button
              onClick={() => setSearchParams({})}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Contact List */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-gray-300 text-5xl mb-4">👤</div>
          <p className="text-gray-500 font-medium">No contacts found</p>
          {hasFilters && <p className="text-gray-400 text-sm mt-1">Try clearing filters</p>}
          {!hasFilters && (
            <Link to="/contacts/new" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              <Plus size={16} /> Add your first contact
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {contacts.map(contact => (
            <Link
              key={contact.id}
              to={`/contacts/${contact.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
            >
              <Avatar name={contact.name} color={contact.avatar_color} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{contact.name}</span>
                  {contact.is_overdue ? (
                    <span className="text-xs text-rose-500 font-medium">overdue</span>
                  ) : null}
                  {contact.pending_reminders > 0 && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                      {contact.pending_reminders} reminder{contact.pending_reminders > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-sm text-gray-400">
                  {contact.email && <span className="truncate max-w-[200px]">{contact.email}</span>}
                  {contact.phone && <span>{contact.phone}</span>}
                  {contact.last_contacted && (
                    <span>Last: {formatDistanceToNow(parseISO(contact.last_contacted), { addSuffix: true })}</span>
                  )}
                </div>
                {(contact.categories?.length > 0 || contact.tags?.length > 0) && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {contact.categories?.map(cat => (
                      <span key={cat} className="text-xs px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded">{cat}</span>
                    ))}
                    {contact.tags?.map(t => (
                      <span key={t} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <StarRating value={contact.relationship_strength} size="sm" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
