import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Bell, AlertCircle, CheckCircle2, ArrowRight, Calendar } from 'lucide-react';
import { api } from '../api';
import Avatar from '../components/Avatar';
import StarRating from '../components/StarRating';
import { formatDistanceToNow, isPast, isToday, parseISO } from 'date-fns';

const FOLLOWUP_DAYS = { 5: 14, 4: 30, 3: 60, 2: 180, 1: 365 };
const FOLLOWUP_LABEL = { 5: '2 weeks', 4: '1 month', 3: '2 months', 2: '6 months', 1: 'year' };

export default function Dashboard() {
  const [contacts, setContacts] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getContacts({ sort: 'strength' }),
      api.getReminders(),
    ]).then(([c, r]) => {
      setContacts(c);
      setReminders(r);
    }).finally(() => setLoading(false));
  }, []);

  async function completeReminder(id) {
    await api.updateReminder(id, { completed: true });
    setReminders(r => r.filter(x => x.id !== id));
  }

  const overdueContacts = contacts.filter(c => c.is_overdue);
  const upcomingReminders = reminders.filter(r => !isPast(parseISO(r.due_date)) || isToday(parseISO(r.due_date)));
  const overdueReminders = reminders.filter(r => isPast(parseISO(r.due_date)) && !isToday(parseISO(r.due_date)));
  const allReminders = [...overdueReminders, ...upcomingReminders];

  const stats = [
    { label: 'Total Contacts', value: contacts.length, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Pending Reminders', value: reminders.length, icon: Bell, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Need Follow-up', value: overdueContacts.length, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 mt-1">Stay on top of your relationships</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
            <div className={`${s.bg} p-3 rounded-lg`}>
              <s.icon size={22} className={s.color} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-sm text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Needs Follow-up */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <AlertCircle size={18} className="text-rose-500" />
              Needs Follow-up
            </h3>
            {overdueContacts.length > 0 && (
              <Link to="/contacts?overdue=true" className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                View all <ArrowRight size={12} />
              </Link>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {overdueContacts.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">
                All caught up!
              </div>
            ) : (
              overdueContacts.slice(0, 6).map(c => (
                <Link key={c.id} to={`/contacts/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <Avatar name={c.name} color={c.avatar_color} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">{c.name}</div>
                    <div className="text-xs text-gray-400">
                      {c.last_contacted
                        ? `Last: ${formatDistanceToNow(parseISO(c.last_contacted), { addSuffix: true })}`
                        : 'Never contacted'}
                    </div>
                  </div>
                  <StarRating value={c.relationship_strength} size="sm" />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Reminders */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Bell size={18} className="text-amber-500" />
              Reminders
            </h3>
            <Link to="/contacts" className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
              Add new <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {allReminders.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">
                No upcoming reminders
              </div>
            ) : (
              allReminders.slice(0, 6).map(r => {
                const due = parseISO(r.due_date);
                const overdue = isPast(due) && !isToday(due);
                const today = isToday(due);
                return (
                  <div key={r.id} className="flex items-start gap-3 px-5 py-3">
                    <Avatar name={r.contact_name} color={r.avatar_color} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{r.contact_name}</div>
                      <div className="text-sm text-gray-600 truncate">{r.message}</div>
                      <div className={`text-xs mt-0.5 ${overdue ? 'text-rose-500 font-medium' : today ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                        {overdue ? `Overdue · ${formatDistanceToNow(due, { addSuffix: true })}` : today ? 'Due today' : formatDistanceToNow(due, { addSuffix: true })}
                      </div>
                    </div>
                    <button
                      onClick={() => completeReminder(r.id)}
                      className="text-gray-300 hover:text-green-500 transition-colors mt-1"
                      title="Mark complete"
                    >
                      <CheckCircle2 size={18} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Relationship Overview */}
      {contacts.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Relationship Strength Overview</h3>
          <div className="space-y-3">
            {[5, 4, 3, 2, 1].map(strength => {
              const group = contacts.filter(c => c.relationship_strength === strength);
              const overdue = group.filter(c => c.is_overdue).length;
              const labels = { 5: 'Inner Circle', 4: 'Close', 3: 'Friends', 2: 'Casual', 1: 'Acquaintances' };
              const colors = { 5: 'bg-indigo-500', 4: 'bg-violet-500', 3: 'bg-sky-500', 2: 'bg-teal-500', 1: 'bg-gray-400' };
              const maxW = contacts.length ? (group.length / contacts.length) * 100 : 0;
              return (
                <div key={strength} className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 w-28 shrink-0">{labels[strength]}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className={`${colors[strength]} h-2 rounded-full transition-all`} style={{ width: `${maxW}%` }} />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-6">{group.length}</span>
                  {overdue > 0 && (
                    <span className="text-xs text-rose-500 font-medium">{overdue} overdue</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
