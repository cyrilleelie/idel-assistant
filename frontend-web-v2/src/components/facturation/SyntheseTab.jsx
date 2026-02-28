import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  CreditCard,
  TriangleAlert,
} from 'lucide-react';
import {
  ComposedChart,
  Bar,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getMonthlyStats, getStatsPerIdel, listInvoices, validateInvoice } from '../../api/invoices';
import MarkPaidModal from './MarkPaidModal';

function formatMonth(ym) {
  const [y, m] = ym.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function prevMonthOf(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonthOf(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function EvolutionBadge({ value }) {
  if (value == null) return null;
  const n = Number(value);
  if (n > 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600 font-medium">
      <TrendingUp size={12} /> +{n.toFixed(1)}%
    </span>
  );
  if (n < 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs text-red-500 font-medium">
      <TrendingDown size={12} /> {n.toFixed(1)}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-slate-400">
      <Minus size={12} /> 0%
    </span>
  );
}

function fmt(v) { return Number(v ?? 0).toFixed(2); }

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-md px-3 py-2 text-sm">
      <p className="font-medium text-slate-700 mb-1">{label}</p>
      <p className="text-blue-600">{fmt(payload[0]?.value)} €</p>
      <p className="text-slate-500 text-xs">{payload[0]?.payload?.count} facture(s)</p>
    </div>
  );
}

function invoiceStatusBadge(status) {
  const map = {
    draft: { label: 'Brouillon', cls: 'bg-slate-100 text-slate-600' },
    validated: { label: 'Validée', cls: 'bg-green-100 text-green-700' },
    transmitted: { label: 'Transmise', cls: 'bg-blue-100 text-blue-700' },
    paid: { label: 'Payée', cls: 'bg-emerald-100 text-emerald-700' },
    rejected: { label: 'Rejetée', cls: 'bg-red-100 text-red-700' },
    canceled: { label: 'Annulée', cls: 'bg-slate-100 text-slate-400' },
  };
  const s = map[status] || { label: status, cls: 'bg-slate-100 text-slate-600' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

export default function SyntheseTab({ nurses = [], period, onPeriodChange, onNavigateToJour, onNavigateToRejets }) {
  const [stats, setStats] = useState(null);
  const [idelStats, setIdelStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [markPaidSingleInvoice, setMarkPaidSingleInvoice] = useState(null);

  // Liste des factures du mois
  const [monthInvoices, setMonthInvoices] = useState([]);
  const [invLoading, setInvLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState(new Set(['draft', 'validated', 'transmitted', 'paid', 'rejected']));
  const [actionLoading, setActionLoading] = useState({});

  const firstDay = `${period}-01`;
  const [year, month] = period.split('-');
  const lastDay = (() => {
    const d = new Date(Number(year), Number(month), 0);
    return `${period}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, idel] = await Promise.all([
        getMonthlyStats(period),
        getStatsPerIdel(period),
      ]);
      setStats(s);
      setIdelStats(idel || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  }, [period]);

  const loadMonthInvoices = useCallback(async () => {
    setInvLoading(true);
    try {
      const data = await listInvoices({ date_from: firstDay, date_to: lastDay, limit: 500 });
      setMonthInvoices(Array.isArray(data) ? data : data.items || []);
    } catch (err) {
      console.error('Erreur chargement factures du mois:', err);
      setMonthInvoices([]);
    } finally {
      setInvLoading(false);
    }
  }, [firstDay, lastDay]);

  useEffect(() => {
    loadStats();
    loadMonthInvoices();
  }, [loadStats, loadMonthInvoices]);

  const toggleStatusFilter = (s) => {
    setStatusFilter(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  const filteredInvoices = monthInvoices.filter(inv => statusFilter.has(inv.status));

  // Graphique : données formatées pour Recharts
  const chartData = (stats?.daily_breakdown || []).map(b => ({
    date: new Date(b.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    dateRaw: b.date,
    total: Number(b.total),
    count: b.count,
  }));

  const avgLine = stats ? Number(stats.avg_daily_revenue) : 0;

  const nurseMap = new Map((nurses || []).map(n => [n.userId, `${n.firstName} ${n.lastName}`]));
  const getNurseName = id => nurseMap.get(id) || '(Soignant)';

  const handleValidate = async (invId) => {
    setActionLoading(prev => ({ ...prev, ['v_' + invId]: true }));
    try {
      await validateInvoice(invId);
      loadMonthInvoices();
      loadStats();
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur validation');
    } finally {
      setActionLoading(prev => ({ ...prev, ['v_' + invId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={28} className="animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Sélecteur de mois */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onPeriodChange(prevMonthOf(period))}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-base font-semibold text-slate-700 capitalize min-w-[160px] text-center">
            {formatMonth(period)}
          </span>
          <button
            onClick={() => onPeriodChange(nextMonthOf(period))}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <button
          onClick={() => { loadStats(); loadMonthInvoices(); }}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 text-sm rounded-lg bg-red-50 text-red-700 border border-red-200">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* 4 cartes KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-blue-200 p-4">
          <p className="text-xs text-slate-500 mb-1">CA facturé</p>
          <p className="text-2xl font-semibold text-blue-700">{fmt(stats?.total_invoiced)} €</p>
          <p className="text-xs text-slate-400 mt-1">{stats?.num_invoices ?? 0} facture(s)</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-4">
          <p className="text-xs text-slate-500 mb-1">En attente</p>
          <p className="text-2xl font-semibold text-amber-600">{fmt(stats?.total_pending)} €</p>
          {Number(stats?.total_pending ?? 0) > 0 && (
            <button
              onClick={() => { setMarkPaidSingleInvoice(null); setShowMarkPaid(true); }}
              className="mt-1.5 inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 hover:underline font-medium"
            >
              <CreditCard size={10} /> Enregistrer un paiement
            </button>
          )}
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Payé</p>
          <p className="text-2xl font-semibold text-emerald-600">{fmt(stats?.total_paid)} €</p>
        </div>
        <button
          onClick={() => Number(stats?.total_rejected ?? 0) > 0 && onNavigateToRejets?.()}
          className={`bg-white rounded-xl border p-4 text-left transition-colors ${
            Number(stats?.total_rejected ?? 0) > 0
              ? 'border-red-200 hover:bg-red-50 cursor-pointer'
              : 'border-slate-200'
          }`}
        >
          <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
            <TriangleAlert size={10} className="text-red-400" /> Rejeté
          </p>
          <p className={`text-2xl font-semibold ${Number(stats?.total_rejected ?? 0) > 0 ? 'text-red-600' : 'text-slate-400'}`}>
            {fmt(stats?.total_rejected)} €
          </p>
        </button>
      </div>

      {/* Graphique journalier */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Répartition journalière</h3>
            {avgLine > 0 && (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <span className="inline-block w-4 h-0.5 bg-amber-400 border-dashed border-t-2" />
                Moy. {avgLine.toFixed(2)} €/j
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={45}
                tickFormatter={v => `${v}€`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
              <Bar
                dataKey="total"
                fill="#3b82f6"
                radius={[3, 3, 0, 0]}
                onClick={(data) => data?.dateRaw && onNavigateToJour?.(data.dateRaw)}
                className="cursor-pointer"
              />
              {avgLine > 0 && (
                <ReferenceLine y={avgLine} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1.5} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top actes */}
      {stats?.top_acts?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Top actes facturés</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-5 py-2.5 text-xs font-medium text-slate-500 uppercase">Code</th>
                <th className="px-5 py-2.5 text-xs font-medium text-slate-500 uppercase">Libellé</th>
                <th className="px-5 py-2.5 text-xs font-medium text-slate-500 uppercase text-right">Nb</th>
                <th className="px-5 py-2.5 text-xs font-medium text-slate-500 uppercase text-right">Total</th>
                <th className="px-5 py-2.5 text-xs font-medium text-slate-500 uppercase text-right">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.top_acts.map((act) => (
                <tr key={act.act_code} className="hover:bg-slate-50">
                  <td className="px-5 py-2.5">
                    <span className="px-1.5 py-0.5 text-xs rounded bg-indigo-50 text-indigo-600 font-mono font-medium">{act.act_code}</span>
                  </td>
                  <td className="px-5 py-2.5 text-slate-700 truncate max-w-[200px]">{act.act_label}</td>
                  <td className="px-5 py-2.5 text-right text-slate-600">{act.count}×</td>
                  <td className="px-5 py-2.5 text-right font-medium text-slate-800">{fmt(act.total)} €</td>
                  <td className="px-5 py-2.5 text-right text-slate-500">{Number(act.percentage).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Indicateurs complémentaires */}
      {stats && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Indicateurs du mois</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-400">Jours travaillés</p>
              <p className="font-semibold text-slate-700">{stats.num_working_days}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Revenu moy./jour</p>
              <p className="font-semibold text-slate-700">{fmt(stats.avg_daily_revenue)} €</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Total factures</p>
              <p className="font-semibold text-slate-700">{stats.num_invoices}</p>
            </div>
          </div>
        </div>
      )}

      {/* Section IDEL — masquée si 1 seul IDEL */}
      {idelStats.length > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Répartition par IDEL</h3>
          <div className="space-y-3">
            {idelStats.map((idel) => (
              <div key={idel.idel_id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-700">{idel.idel_name}</span>
                  <span className="text-sm font-medium text-slate-800">{fmt(idel.total_invoiced)} €</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-blue-500 rounded-full h-2 transition-all"
                    style={{ width: `${Math.min(100, Number(idel.percentage_of_cabinet))}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{Number(idel.percentage_of_cabinet).toFixed(1)}% du cabinet · {idel.num_invoices} facture(s)</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liste des factures du mois */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Factures du mois</h3>
        </div>

        {/* Filtres statut */}
        <div className="px-5 py-2.5 border-b border-slate-100 flex flex-wrap gap-2">
          {[
            { key: 'draft',       label: 'Brouillon',   cls: 'bg-slate-200 text-slate-700 border-slate-300' },
            { key: 'validated',   label: 'Validée',     cls: 'bg-green-100 text-green-700 border-green-300' },
            { key: 'transmitted', label: 'Transmise',   cls: 'bg-blue-100 text-blue-700 border-blue-300' },
            { key: 'paid',        label: 'Payée',       cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
            { key: 'rejected',    label: 'Rejetée',     cls: 'bg-red-100 text-red-700 border-red-300' },
          ].map(({ key, label, cls }) => {
            const count = monthInvoices.filter(i => i.status === key).length;
            const isOn = statusFilter.has(key);
            return (
              <button
                key={key}
                onClick={() => toggleStatusFilter(key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                  isOn ? cls : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'
                }`}
              >
                {label} <span className={`rounded-full px-1 text-[10px] font-semibold ${isOn ? 'bg-white/50' : ''}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {invLoading ? (
          <div className="flex items-center justify-center py-10">
            <RefreshCw size={22} className="animate-spin text-slate-300" />
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-sm text-slate-400">Aucune facture pour ces filtres</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">N°</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Soignant</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500 uppercase text-right">Montant</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Statut</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500 uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-600">{inv.care_date}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{inv.invoice_number || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{getNurseName(inv.idel_id)}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{fmt(inv.total_amount)} €</td>
                    <td className="px-4 py-3">{invoiceStatusBadge(inv.status)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {inv.status === 'draft' && (
                          <button
                            onClick={() => handleValidate(inv.id)}
                            disabled={actionLoading['v_' + inv.id]}
                            className="px-2.5 py-1 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {actionLoading['v_' + inv.id] ? '...' : 'Valider'}
                          </button>
                        )}
                        {(inv.status === 'validated' || inv.status === 'transmitted') && (
                          <button
                            onClick={() => { setMarkPaidSingleInvoice(inv); setShowMarkPaid(true); }}
                            className="px-2.5 py-1 text-xs font-medium rounded bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100"
                          >
                            Marquer payée
                          </button>
                        )}
                        {inv.status === 'rejected' && (
                          <button
                            onClick={() => onNavigateToRejets?.()}
                            className="px-2.5 py-1 text-xs font-medium rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                          >
                            Corriger
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal enregistrement paiement */}
      {showMarkPaid && (
        <MarkPaidModal
          period={period}
          preselectedInvoice={markPaidSingleInvoice}
          onClose={() => { setShowMarkPaid(false); setMarkPaidSingleInvoice(null); }}
          onSuccess={() => { setShowMarkPaid(false); setMarkPaidSingleInvoice(null); loadStats(); loadMonthInvoices(); }}
        />
      )}
    </div>
  );
}
