import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Receipt,
  Calendar,
  Check,
  X,
  RefreshCw,
  FileText,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { getDailyBilling, createInvoiceFromAppointment, createAllDailyInvoices } from '../../api/cotation';
import { listInvoices, validateInvoice, cancelInvoice } from '../../api/invoices';
import ExpiringPrescriptionsAlert from '../prescriptions/ExpiringPrescriptionsAlert';

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function displayDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function statusBadge(status) {
  const map = {
    scheduled: { label: 'Planifie', cls: 'bg-slate-100 text-slate-600' },
    confirmed: { label: 'Confirme', cls: 'bg-blue-100 text-blue-700' },
    completed: { label: 'Termine', cls: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Annule', cls: 'bg-red-100 text-red-600' },
    no_show: { label: 'Absent', cls: 'bg-amber-100 text-amber-700' },
  };
  const s = map[status] || { label: status, cls: 'bg-slate-100 text-slate-600' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

function invoiceStatusBadge(status) {
  const map = {
    draft: { label: 'Brouillon', cls: 'bg-slate-100 text-slate-600' },
    validated: { label: 'Validee', cls: 'bg-green-100 text-green-700' },
    sent: { label: 'Envoyee', cls: 'bg-blue-100 text-blue-700' },
    paid: { label: 'Payee', cls: 'bg-emerald-100 text-emerald-700' },
    cancelled: { label: 'Annulee', cls: 'bg-red-100 text-red-600' },
  };
  const s = map[status] || { label: status, cls: 'bg-slate-100 text-slate-600' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

export default function FacturationTab({ nurses = [] }) {
  const [date, setDate] = useState(formatDate(new Date()));
  const [billing, setBilling] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [expandedInvoiceId, setExpandedInvoiceId] = useState(null);

  // Build a map userId -> display name for nurse lookup
  const nurseMap = useMemo(() => {
    const m = new Map();
    for (const n of nurses) {
      m.set(n.userId, `${n.firstName} ${n.lastName}`);
    }
    return m;
  }, [nurses]);

  const getNurseName = (idelId) => nurseMap.get(idelId) || '(Soignant inconnu)';

  const loadBilling = useCallback(async (d) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDailyBilling(d);
      setBilling(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors du chargement de la facturation');
      setBilling(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInvoices = useCallback(async (d) => {
    setInvoicesLoading(true);
    try {
      const data = await listInvoices({ date_from: d, date_to: d });
      setInvoices(Array.isArray(data) ? data : data.items || []);
    } catch {
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    loadBilling(date);
    loadInvoices(date);
  }, [date, loadBilling, loadInvoices]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const navigateDate = (delta) => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    setDate(formatDate(d));
  };

  const handleInvoiceOne = async (appointmentId) => {
    setActionLoading(prev => ({ ...prev, [appointmentId]: true }));
    try {
      await createInvoiceFromAppointment(appointmentId);
      refresh();
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la facturation');
    } finally {
      setActionLoading(prev => ({ ...prev, [appointmentId]: false }));
    }
  };

  const handleInvoiceAll = async () => {
    setActionLoading(prev => ({ ...prev, _all: true }));
    try {
      await createAllDailyInvoices(date);
      refresh();
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la facturation groupee');
    } finally {
      setActionLoading(prev => ({ ...prev, _all: false }));
    }
  };

  const handleValidate = async (invoiceId) => {
    setActionLoading(prev => ({ ...prev, ['v_' + invoiceId]: true }));
    try {
      await validateInvoice(invoiceId);
      refresh();
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la validation');
    } finally {
      setActionLoading(prev => ({ ...prev, ['v_' + invoiceId]: false }));
    }
  };

  const handleCancel = async (invoiceId) => {
    setActionLoading(prev => ({ ...prev, ['c_' + invoiceId]: true }));
    try {
      await cancelInvoice(invoiceId);
      refresh();
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors de l'annulation");
    } finally {
      setActionLoading(prev => ({ ...prev, ['c_' + invoiceId]: false }));
    }
  };

  const appointments = billing?.items || [];
  const completedNotInvoiced = appointments.filter(a => a.status === 'completed' && !a.invoice_id);
  const totalBilled = billing?.total_facture ?? 0;
  const totalNonBilled = billing?.total_non_facture ?? 0;

  return (
    <div className="space-y-6">
      {/* Header: date nav + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateDate(-1)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-slate-400" />
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <button
            onClick={() => navigateDate(1)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {completedNotInvoiced.length > 0 && (
            <button
              onClick={handleInvoiceAll}
              disabled={actionLoading._all}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Receipt size={16} />
              {actionLoading._all ? 'Facturation...' : `Tout facturer (${completedNotInvoiced.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Date display */}
      <p className="text-sm text-slate-500 capitalize">{displayDate(date)}</p>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 text-sm rounded-lg bg-red-50 text-red-700 border border-red-200">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto hover:text-red-900">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">RDV du jour</p>
          <p className="text-2xl font-semibold text-slate-800">{appointments.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Facturés</p>
          <p className="text-2xl font-semibold text-blue-600">{totalBilled}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">A facturer</p>
          <p className="text-2xl font-semibold text-amber-600">{totalNonBilled}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Factures créées</p>
          <p className="text-2xl font-semibold text-green-600">{invoices.length}</p>
        </div>
      </div>

      {/* Alertes ordonnances expirant bientôt */}
      <ExpiringPrescriptionsAlert daysAhead={7} />

      {/* Appointments table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Rendez-vous</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={24} className="animate-spin text-slate-300" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar size={32} className="text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">Aucun rendez-vous pour cette date</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-5 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Heure</th>
                  <th className="px-5 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Soignant</th>
                  <th className="px-5 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Patient</th>
                  <th className="px-5 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Actes</th>
                  <th className="px-5 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Statut</th>
                  <th className="px-5 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Facture</th>
                  <th className="px-5 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.map((appt) => {
                  const time = appt.scheduled_at
                    ? new Date(appt.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                    : '--:--';
                  const codes = appt.act_codes || [];
                  const canInvoice = appt.status === 'completed' && !appt.invoice_id;
                  return (
                    <tr key={appt.appointment_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-slate-700">{time}</td>
                      <td className="px-5 py-3 text-slate-600">{getNurseName(appt.idel_id)}</td>
                      <td className="px-5 py-3 text-slate-700">{appt.patient_name || '(Inconnu)'}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {codes.length > 0 ? codes.map(code => (
                            <span key={code} className="px-1.5 py-0.5 text-xs rounded bg-indigo-50 text-indigo-600 font-medium">
                              {code}
                            </span>
                          )) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="space-y-1">
                          {statusBadge(appt.status)}
                          {/* Badge ordonnance */}
                          {appt.prescription_warning && (
                            <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                              appt.prescription_status === 'expired'
                                ? 'bg-red-100 text-red-700'
                                : appt.prescription_missing
                                  ? 'bg-slate-100 text-slate-500'
                                  : 'bg-amber-100 text-amber-700'
                            }`}>
                              <AlertCircle size={10} />
                              {appt.prescription_warning}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {appt.invoice_id ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                            <Check size={12} />
                            Facturée
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {canInvoice && (
                          <button
                            onClick={() => handleInvoiceOne(appt.appointment_id)}
                            disabled={actionLoading[appt.appointment_id]}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                          >
                            <Receipt size={12} />
                            {actionLoading[appt.appointment_id] ? '...' : 'Facturer'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoices section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Factures du jour</h3>
        </div>

        {invoicesLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={24} className="animate-spin text-slate-300" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText size={32} className="text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">Aucune facture pour cette date</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {invoices.map((inv) => {
              const isExpanded = expandedInvoiceId === inv.id;
              const lines = inv.lines || [];
              return (
                <div key={inv.id}>
                  {/* Invoice header row - clickable */}
                  <button
                    type="button"
                    onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <FileText size={16} className="text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {inv.invoice_number || 'Brouillon'}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {getNurseName(inv.idel_id)} - {inv.patient_name || 'Patient'} - {Number(inv.total_amount ?? 0).toFixed(2)} EUR
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {invoiceStatusBadge(inv.status)}
                      <ChevronDown size={16} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <div className="px-5 pb-4 bg-slate-50/50 border-t border-slate-100">
                      {/* Invoice info */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 py-3">
                        <div>
                          <p className="text-xs text-slate-400">Soignant</p>
                          <p className="text-sm text-slate-700 font-medium">{getNurseName(inv.idel_id)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Date soins</p>
                          <p className="text-sm text-slate-700">{inv.care_date || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Date facture</p>
                          <p className="text-sm text-slate-700">{inv.invoice_date || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Tiers payant</p>
                          <p className="text-sm text-slate-700 capitalize">{inv.tiers_payant_type || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Statut</p>
                          <div className="mt-0.5">{invoiceStatusBadge(inv.status)}</div>
                        </div>
                      </div>

                      {/* Lines table */}
                      {lines.length > 0 ? (
                        <div className="border border-slate-200 rounded-lg overflow-hidden mt-1">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-100 text-left">
                                <th className="px-3 py-2 text-xs font-medium text-slate-500">Code</th>
                                <th className="px-3 py-2 text-xs font-medium text-slate-500">Acte</th>
                                <th className="px-3 py-2 text-xs font-medium text-slate-500 text-right">Coeff.</th>
                                <th className="px-3 py-2 text-xs font-medium text-slate-500 text-right">Tarif</th>
                                <th className="px-3 py-2 text-xs font-medium text-slate-500 text-right">Qté</th>
                                <th className="px-3 py-2 text-xs font-medium text-slate-500 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {lines.map((line) => (
                                <tr key={line.id}>
                                  <td className="px-3 py-2">
                                    <span className="px-1.5 py-0.5 text-xs rounded bg-indigo-50 text-indigo-600 font-mono font-medium">{line.act_code}</span>
                                  </td>
                                  <td className="px-3 py-2 text-slate-700">{line.act_label}</td>
                                  <td className="px-3 py-2 text-right text-slate-600">{Number(line.coefficient ?? 1)}</td>
                                  <td className="px-3 py-2 text-right text-slate-600">{Number(line.base_rate ?? 0).toFixed(2)}</td>
                                  <td className="px-3 py-2 text-right text-slate-600">{Number(line.quantity ?? 1)}</td>
                                  <td className="px-3 py-2 text-right font-medium text-slate-800">{Number(line.line_total ?? 0).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic py-2">Aucune ligne d'acte.</p>
                      )}

                      {/* Totals breakdown */}
                      <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-slate-200">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-400">AMO (60%) :</span>
                          <span className="text-sm font-medium text-slate-700">{Number(inv.total_amo ?? 0).toFixed(2)} EUR</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-400">AMC (40%) :</span>
                          <span className="text-sm font-medium text-slate-700">{Number(inv.total_amc ?? 0).toFixed(2)} EUR</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-400">Patient :</span>
                          <span className="text-sm font-medium text-slate-700">{Number(inv.total_patient ?? 0).toFixed(2)} EUR</span>
                        </div>
                        <div className="flex items-center gap-1.5 ml-auto">
                          <span className="text-xs text-slate-500 font-medium">Total :</span>
                          <span className="text-sm font-semibold text-slate-900">{Number(inv.total_amount ?? 0).toFixed(2)} EUR</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {inv.status === 'draft' && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200">
                          <button
                            onClick={() => handleValidate(inv.id)}
                            disabled={actionLoading['v_' + inv.id]}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            <Check size={14} />
                            {actionLoading['v_' + inv.id] ? 'Validation...' : 'Valider la facture'}
                          </button>
                          <button
                            onClick={() => handleCancel(inv.id)}
                            disabled={actionLoading['c_' + inv.id]}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-white text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50 transition-colors"
                          >
                            <X size={14} />
                            {actionLoading['c_' + inv.id] ? 'Annulation...' : 'Annuler'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
