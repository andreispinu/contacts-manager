const BASE = '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Contacts
  getContacts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/contacts${q ? '?' + q : ''}`);
  },
  getContact: (id) => request(`/contacts/${id}`),
  createContact: (data) => request('/contacts', { method: 'POST', body: JSON.stringify(data) }),
  updateContact: (id, data) => request(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteContact: (id) => request(`/contacts/${id}`, { method: 'DELETE' }),

  // Interactions
  logInteraction: (contactId, data) =>
    request(`/contacts/${contactId}/interactions`, { method: 'POST', body: JSON.stringify(data) }),
  deleteInteraction: (contactId, iid) =>
    request(`/contacts/${contactId}/interactions/${iid}`, { method: 'DELETE' }),

  // Reminders
  getReminders: () => request('/reminders'),
  createReminder: (data) => request('/reminders', { method: 'POST', body: JSON.stringify(data) }),
  updateReminder: (id, data) => request(`/reminders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteReminder: (id) => request(`/reminders/${id}`, { method: 'DELETE' }),

  // Tags
  getTags: () => request('/tags'),

  // Import
  importVCF: (file) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${BASE}/import/vcf`, { method: 'POST', headers: getAuthHeaders(), body: form }).then(r => r.json());
  },
  importCSV: (file) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${BASE}/import/csv`, { method: 'POST', headers: getAuthHeaders(), body: form }).then(r => r.json());
  },
  importiMessage: () => request('/import/imessage', { method: 'POST' }),
};
