import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RefreshCw, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Database } from 'lucide-react';
import { listTables, getTableSchema, getTableRows, createRow, updateRow, deleteRow, truncateTable, getFkOptions } from '../../api/admin';

export default function AdminBddTab() {
  // ─── State ───
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [schema, setSchema] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState(null);
  const [order, setOrder] = useState('asc');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modal state
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | null
  const [modalData, setModalData] = useState({});
  const [modalError, setModalError] = useState(null);
  const [modalSaving, setModalSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // row id
  const [truncateConfirm, setTruncateConfirm] = useState(false);

  // FK options cache: { "tableName:colName": [{id, label}] }
  const fkCache = useRef({});

  // ─── Load tables on mount ───
  useEffect(() => {
    listTables().then(setTables).catch(() => setError('Impossible de charger les tables'));
  }, []);

  // ─── Load schema + rows when table changes ───
  const loadData = useCallback(async (tbl, pg, ps, srt, ord) => {
    if (!tbl) return;
    setLoading(true);
    setError(null);
    try {
      const [schemaRes, rowsRes] = await Promise.all([
        getTableSchema(tbl),
        getTableRows(tbl, { page: pg, pageSize: ps, sort: srt, order: ord }),
      ]);
      setSchema(schemaRes);
      setRows(rowsRes.rows);
      setTotal(rowsRes.total);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fkCache.current = {};
      loadData(selectedTable, page, pageSize, sort, order);
    }
  }, [selectedTable, page, pageSize, sort, order, loadData]);

  // ─── FK options loader ───
  const loadFkOptions = useCallback(async (tableName, colName) => {
    const key = `${tableName}:${colName}`;
    if (fkCache.current[key]) return fkCache.current[key];
    try {
      const opts = await getFkOptions(tableName, colName);
      fkCache.current[key] = opts;
      return opts;
    } catch {
      return [];
    }
  }, []);

  // ─── FK label resolver ───
  const getFkLabel = useCallback((tableName, colName, id) => {
    const key = `${tableName}:${colName}`;
    const opts = fkCache.current[key];
    if (!opts) return null;
    const found = opts.find(o => o.id === id);
    return found ? found.label : null;
  }, []);

  // ─── Pre-load FK options for current schema ───
  useEffect(() => {
    if (!schema || !selectedTable) return;
    const fkCols = schema.columns.filter(c => c.fk_table);
    fkCols.forEach(c => loadFkOptions(selectedTable, c.name));
  }, [schema, selectedTable, loadFkOptions]);

  // ─── Handlers ───
  const handleTableChange = (e) => {
    setSelectedTable(e.target.value);
    setPage(1);
    setSort(null);
    setOrder('asc');
    setRows([]);
    setSchema(null);
  };

  const handleSort = (colName) => {
    if (sort === colName) {
      setOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(colName);
      setOrder('asc');
    }
    setPage(1);
  };

  const handleRefresh = () => {
    loadData(selectedTable, page, pageSize, sort, order);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // ─── Modal open/close ───
  const openCreate = () => {
    setModalData({});
    setModalError(null);
    setModalMode('create');
  };

  const openEdit = (row) => {
    setModalData({ ...row });
    setModalError(null);
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    setModalData({});
    setModalError(null);
  };

  // ─── Save (create / edit) ───
  const handleSave = async () => {
    setModalSaving(true);
    setModalError(null);
    try {
      const payload = buildPayload(modalData, schema, modalMode);
      if (modalMode === 'create') {
        await createRow(selectedTable, payload);
      } else {
        await updateRow(selectedTable, modalData.id, payload);
      }
      closeModal();
      handleRefresh();
    } catch (err) {
      setModalError(err.response?.data?.detail || 'Erreur de sauvegarde');
    } finally {
      setModalSaving(false);
    }
  };

  // ─── Delete ───
  const handleDelete = async (rowId) => {
    try {
      await deleteRow(selectedTable, rowId);
      setDeleteConfirm(null);
      handleRefresh();
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur de suppression');
      setDeleteConfirm(null);
    }
  };

  // ─── Truncate ───
  const handleTruncate = async () => {
    try {
      await truncateTable(selectedTable);
      setTruncateConfirm(false);
      handleRefresh();
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors du vidage');
      setTruncateConfirm(false);
    }
  };

  // ─── Column classification ───
  const columns = schema?.columns || [];
  const visibleColumns = columns;

  const autoColumns = useMemo(() =>
    new Set(columns.filter(c => c.is_pk || ['created_at', 'updated_at'].includes(c.name)).map(c => c.name)),
    [columns]
  );

  return (
    <div className="space-y-4">
      {/* ─── Top bar ─── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Database size={18} className="text-slate-500" />
          <select
            value={selectedTable}
            onChange={handleTableChange}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">-- Choisir une table --</option>
            {tables.map(t => (
              <option key={t.name} value={t.name}>{t.name} ({t.row_count} ligne{t.row_count !== 1 ? 's' : ''})</option>
            ))}
          </select>
        </div>

        {selectedTable && (
          <>
            <button onClick={handleRefresh} className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-slate-300 hover:bg-slate-50 transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Rafraichir
            </button>
            <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors">
              <Plus size={14} />
              Nouvelle ligne
            </button>
            <button onClick={() => setTruncateConfirm(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-red-300 text-red-600 hover:bg-red-50 transition-colors">
              <Trash2 size={14} />
              Vider la table
            </button>
            <span className="text-sm text-slate-500 ml-auto">
              {total} ligne{total !== 1 ? 's' : ''}
            </span>
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm">{error}</div>
      )}

      {/* ─── Data grid ─── */}
      {selectedTable && schema && (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {visibleColumns.map(col => (
                    <th
                      key={col.name}
                      onClick={() => handleSort(col.name)}
                      className="px-3 py-2 text-left font-medium text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap select-none"
                    >
                      {col.name}
                      {col.is_pk && <span className="ml-1 text-xs text-amber-600">PK</span>}
                      {col.fk_table && <span className="ml-1 text-xs text-blue-500">FK</span>}
                      {sort === col.name && (
                        <span className="ml-1 text-xs">{order === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium text-slate-600 w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 && !loading && (
                  <tr><td colSpan={visibleColumns.length + 1} className="px-3 py-8 text-center text-slate-400">Aucune donnée</td></tr>
                )}
                {rows.map((row, idx) => (
                  <tr key={row.id || idx} className="hover:bg-slate-50">
                    {visibleColumns.map(col => (
                      <td key={col.name} className="px-3 py-2 max-w-xs truncate" title={String(row[col.name] ?? '')}>
                        <CellValue value={row[col.name]} col={col} tableName={selectedTable} getFkLabel={getFkLabel} />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(row)} className="p-1 text-slate-400 hover:text-blue-600 transition-colors" title="Modifier">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteConfirm(row.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors ml-1" title="Supprimer">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ─── Pagination ─── */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 bg-slate-50 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Lignes par page :</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="border border-slate-300 rounded px-2 py-0.5 text-sm bg-white"
              >
                {[25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Page {page} / {totalPages}</span>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft size={16} />
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Create/Edit Modal ─── */}
      {modalMode && (
        <RowModal
          mode={modalMode}
          data={modalData}
          setData={setModalData}
          columns={columns}
          autoColumns={autoColumns}
          error={modalError}
          saving={modalSaving}
          onSave={handleSave}
          onClose={closeModal}
          tableName={selectedTable}
          loadFkOptions={loadFkOptions}
        />
      )}

      {/* ─── Delete confirmation ─── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Confirmer la suppression</h3>
            <p className="text-sm text-slate-600 mb-4">Supprimer cette ligne ? Cette action est irreversible.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-50">Annuler</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Truncate confirmation ─── */}
      {truncateConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setTruncateConfirm(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Vider la table</h3>
            <p className="text-sm text-slate-600 mb-4">Supprimer <strong>toutes les lignes</strong> de <strong>{selectedTable}</strong> ? Cette action est irreversible.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setTruncateConfirm(false)} className="px-4 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-50">Annuler</button>
              <button onClick={handleTruncate} className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700">Vider</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────── Cell renderer ───────────────────────────────

function CellValue({ value, col, tableName, getFkLabel }) {
  if (value === null || value === undefined) {
    return <span className="text-slate-300 italic">null</span>;
  }

  // Boolean
  if (col.type === 'BOOLEAN') {
    return (
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${value ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
        {value ? 'Oui' : 'Non'}
      </span>
    );
  }

  // FK — show label if cached
  if (col.fk_table && typeof value === 'string') {
    const label = getFkLabel(tableName, col.name, value);
    if (label) {
      return <span title={value}><span className="text-blue-600">{label}</span> <span className="text-slate-300 text-xs">({value.slice(0, 8)})</span></span>;
    }
  }

  // BYTEA (hex)
  if (col.type === 'BYTEA' || col.type === 'LargeBinary') {
    const hex = String(value);
    return <span className="font-mono text-xs text-slate-500" title={hex}>{hex.slice(0, 24)}{hex.length > 24 ? '...' : ''}</span>;
  }

  // JSON / ARRAY
  if (typeof value === 'object') {
    const s = JSON.stringify(value);
    return <span className="font-mono text-xs" title={s}>{s.slice(0, 60)}{s.length > 60 ? '...' : ''}</span>;
  }

  // UUID — truncate
  const str = String(value);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return <span className="font-mono text-xs text-slate-500" title={str}>{str.slice(0, 8)}</span>;
  }

  return <span>{str}</span>;
}

// ─────────────────────────────── Row Modal ───────────────────────────────

function RowModal({ mode, data, setData, columns, autoColumns, error, saving, onSave, onClose, tableName, loadFkOptions }) {
  const [fkOptionsMap, setFkOptionsMap] = useState({});

  // Load FK options for all FK columns
  useEffect(() => {
    const fkCols = columns.filter(c => c.fk_table);
    if (fkCols.length === 0) return;
    let cancelled = false;
    Promise.all(fkCols.map(async c => {
      const opts = await loadFkOptions(tableName, c.name);
      return [c.name, opts];
    })).then(entries => {
      if (!cancelled) setFkOptionsMap(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [columns, tableName, loadFkOptions]);

  const editableColumns = columns.filter(c => {
    if (mode === 'create') {
      return !autoColumns.has(c.name);
    }
    // Edit mode: show auto columns as readonly
    return true;
  });

  const handleFieldChange = (colName, value) => {
    setData(prev => ({ ...prev, [colName]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">
            {mode === 'create' ? 'Nouvelle ligne' : 'Modifier la ligne'}
          </h3>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-3">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>
          )}
          {editableColumns.map(col => {
            const isReadonly = mode === 'edit' && autoColumns.has(col.name);
            return (
              <FieldInput
                key={col.name}
                col={col}
                value={data[col.name] ?? ''}
                onChange={v => handleFieldChange(col.name, v)}
                readonly={isReadonly}
                fkOptions={fkOptionsMap[col.name]}
              />
            );
          })}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-50">Annuler</button>
          <button onClick={onSave} disabled={saving} className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────── Field Input ───────────────────────────────

function FieldInput({ col, value, onChange, readonly, fkOptions }) {
  const type = col.type.toUpperCase();
  const label = (
    <label className="block text-sm font-medium text-slate-700 mb-1">
      {col.name}
      {col.is_pk && <span className="ml-1 text-xs text-amber-600">PK</span>}
      {col.fk_table && <span className="ml-1 text-xs text-blue-500">→ {col.fk_table}</span>}
      {!col.nullable && !col.has_default && <span className="ml-1 text-red-500">*</span>}
    </label>
  );

  const baseClass = "w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  const readonlyClass = readonly ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "";

  // FK → dropdown
  if (col.fk_table && fkOptions && !readonly) {
    return (
      <div>
        {label}
        <select
          value={value || ''}
          onChange={e => onChange(e.target.value || null)}
          className={`${baseClass}`}
        >
          <option value="">-- Aucun --</option>
          {fkOptions.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.label} ({opt.id.slice(0, 8)})</option>
          ))}
        </select>
      </div>
    );
  }

  // Boolean → checkbox
  if (type === 'BOOLEAN') {
    return (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!value}
          onChange={e => onChange(e.target.checked)}
          disabled={readonly}
          className="rounded border-slate-300"
        />
        <label className="text-sm font-medium text-slate-700">{col.name}</label>
      </div>
    );
  }

  // Date
  if (type === 'DATE') {
    return (
      <div>
        {label}
        <input type="date" value={value ? String(value).slice(0, 10) : ''} onChange={e => onChange(e.target.value)} readOnly={readonly} className={`${baseClass} ${readonlyClass}`} />
      </div>
    );
  }

  // Timestamp
  if (type.includes('TIMESTAMP')) {
    return (
      <div>
        {label}
        <input type="datetime-local" value={value ? String(value).slice(0, 16) : ''} onChange={e => onChange(e.target.value)} readOnly={readonly} className={`${baseClass} ${readonlyClass}`} />
      </div>
    );
  }

  // Time
  if (type === 'TIME') {
    return (
      <div>
        {label}
        <input type="time" value={value || ''} onChange={e => onChange(e.target.value)} readOnly={readonly} className={`${baseClass} ${readonlyClass}`} />
      </div>
    );
  }

  // JSON / ARRAY → textarea
  if (type.includes('JSON') || type.includes('ARRAY')) {
    const strVal = typeof value === 'object' ? JSON.stringify(value, null, 2) : (value || '');
    return (
      <div>
        {label}
        <textarea
          value={strVal}
          onChange={e => onChange(e.target.value)}
          readOnly={readonly}
          rows={3}
          className={`${baseClass} font-mono text-xs ${readonlyClass}`}
        />
      </div>
    );
  }

  // Numeric
  if (type.includes('INT') || type.includes('NUMERIC') || type.includes('FLOAT') || type.includes('DECIMAL') || type.includes('DOUBLE')) {
    return (
      <div>
        {label}
        <input type="number" step="any" value={value ?? ''} onChange={e => onChange(e.target.value)} readOnly={readonly} className={`${baseClass} ${readonlyClass}`} />
      </div>
    );
  }

  // Default: text
  return (
    <div>
      {label}
      <input type="text" value={value ?? ''} onChange={e => onChange(e.target.value)} readOnly={readonly} className={`${baseClass} ${readonlyClass}`} />
    </div>
  );
}

// ─────────────────────────────── Payload builder ───────────────────────────────

function buildPayload(data, schema, mode) {
  const payload = {};
  const autoFields = new Set(['created_at', 'updated_at']);

  for (const col of schema.columns) {
    // Skip auto fields
    if (autoFields.has(col.name)) continue;
    if (mode === 'create' && col.is_pk) continue;
    if (mode === 'edit' && col.is_pk) continue;

    const val = data[col.name];
    if (val === undefined || val === '') {
      if (!col.nullable && !col.has_default) {
        // Required field with no value — include null to let the DB reject it
        payload[col.name] = null;
      }
      continue;
    }

    const type = col.type.toUpperCase();

    // Parse JSON fields
    if (type.includes('JSON') || type.includes('ARRAY')) {
      try {
        payload[col.name] = typeof val === 'string' ? JSON.parse(val) : val;
      } catch {
        payload[col.name] = val;
      }
      continue;
    }

    // Boolean
    if (type === 'BOOLEAN') {
      payload[col.name] = !!val;
      continue;
    }

    payload[col.name] = val;
  }

  return payload;
}
