import client from './client';

/** Counter billing (POS). Canteen Admin + Sub Admin only; see PosController on the backend. */
const base = '/admin/billing';
const data = (r) => r.data;

export const billingApi = {
  catalog: () => client.get(`${base}/catalog`).then(data),
  createCategory: (name, sortOrder) => client.post(`${base}/categories`, { name, sortOrder }).then(data),
  updateCategory: (id, name, sortOrder) => client.put(`${base}/categories/${id}`, { name, sortOrder }).then(data),
  archiveCategory: (id) => client.delete(`${base}/categories/${id}`),
  createItem: (body) => client.post(`${base}/items`, body).then(data),
  updateItem: (id, body) => client.put(`${base}/items/${id}`, body).then(data),
  setAvailability: (id, available) => client.patch(`${base}/items/${id}/availability`, { available }).then(data),
  archiveItem: (id) => client.delete(`${base}/items/${id}`),

  settings: () => client.get(`${base}/settings`).then(data),
  updateSettings: (body) => client.put(`${base}/settings`, body).then(data),

  createBill: (body) => client.post(`${base}/bills`, body).then(data),
  listBills: (params) => client.get(`${base}/bills`, { params }).then(data),
  getBill: (id) => client.get(`${base}/bills/${id}`).then(data),
  voidBill: (id, reason) => client.post(`${base}/bills/${id}/void`, { reason }).then(data),

  hold: (lines, label) => client.post(`${base}/held`, { lines, label }).then(data),
  listHeld: () => client.get(`${base}/held`).then(data),
  resumeHeld: (id) => client.post(`${base}/held/${id}/resume`).then(data),
  discardHeld: (id) => client.delete(`${base}/held/${id}`),

  summary: (from, to, granularity) => client.get(`${base}/reports/summary`, { params: { from, to, granularity } }).then(data),
  exportXlsx: (from, to) => client.get(`${base}/reports/export`, { params: { from, to }, responseType: 'blob' }).then(data),
};
