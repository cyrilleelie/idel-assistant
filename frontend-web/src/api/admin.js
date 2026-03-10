import client from './client';

export async function listTables() {
  const { data } = await client.get('/admin/tables');
  return data;
}

export async function getTableSchema(tableName) {
  const { data } = await client.get(`/admin/tables/${tableName}/schema`);
  return data;
}

export async function getTableRows(tableName, { page = 1, pageSize = 25, sort, order } = {}) {
  const params = { page, page_size: pageSize };
  if (sort) params.sort = sort;
  if (order) params.order = order;
  const { data } = await client.get(`/admin/tables/${tableName}/rows`, { params });
  return data;
}

export async function createRow(tableName, body) {
  const { data } = await client.post(`/admin/tables/${tableName}/rows`, body);
  return data;
}

export async function updateRow(tableName, rowId, body) {
  const { data } = await client.patch(`/admin/tables/${tableName}/rows/${rowId}`, body);
  return data;
}

export async function deleteRow(tableName, rowId) {
  await client.delete(`/admin/tables/${tableName}/rows/${rowId}`);
}

export async function truncateTable(tableName) {
  await client.delete(`/admin/tables/${tableName}/rows`);
}

export async function getFkOptions(tableName, columnName) {
  const { data } = await client.get(`/admin/tables/${tableName}/fk-options/${columnName}`);
  return data;
}

export async function getLogs({ level, source, limit = 200 } = {}) {
  const params = { limit };
  if (level) params.level = level;
  if (source && source !== 'all') params.source = source;
  const { data } = await client.get('/admin/logs', { params });
  return data;
}

export async function postFrontendLogs(entries) {
  await client.post('/admin/logs/frontend', entries);
}
