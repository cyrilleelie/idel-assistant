import { useState, useEffect, useCallback } from 'react';
import {
  Download,
  FileText,
  Table2,
  BookOpen,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  TrendingUp,
} from 'lucide-react';
import {
  downloadExportCSV,
  downloadExportFEC,
  downloadExportRecettes,
  getQuarterlySummary,
  downloadQuarterlyPDF,
} from '../../api/invoices';

// --- Utilitaires ---

function getCurrentQuarter() {
  const now = new Date();
  return Math.ceil((now.getMonth() + 1) / 3);
}

function getQuarterDates(year, quarter) {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const endDay = new Date(year, endMonth, 0).getDate();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    from: `${year}-${pad(startMonth)}-01`,
    to: `${year}-${pad(endMonth)}-${pad(endDay)}`,
  };
}

function fmtEur(v) {
  if (v == null) return '—';
  const n = Number(v);
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

const QUARTER_NAMES = { 1: '1er trimestre', 2: '2ème trimestre', 3: '3ème trimestre', 4: '4ème trimestre' };
const MONTH_NAMES = {
  '01': 'Janvier', '02': 'Février', '03': 'Mars', '04': 'Avril',
  '05': 'Mai', '06': 'Juin', '07': 'Juillet', '08': 'Août',
  '09': 'Septembre', '10': 'Octobre', '11': 'Novembre', '12': 'Décembre',
};

function formatMonthLabel(ym) {
  const [y, m] = ym.split('-');
  return `${MONTH_NAMES[m] || m} ${y}`;
}

// --- Sélecteur de période avec raccourcis ---

function PeriodSelector({ dateFrom, dateTo, onChange }) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');

  const shortcuts = [
    {
      label: 'Mois en cours',
      from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`,
      to: (() => {
        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`;
      })(),
    },
    {
      label: 'Mois précédent',
      from: (() => {
        const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
      })(),
      to: (() => {
        const d = new Date(now.getFullYear(), now.getMonth(), 0);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      })(),
    },
    {
      label: 'Trimestre en cours',
      ...getQuarterDates(now.getFullYear(), getCurrentQuarter()),
    },
    {
      label: 'Année en cours',
      from: `${now.getFullYear()}-01-01`,
      to: `${now.getFullYear()}-12-31`,
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {shortcuts.map((s) => (
          <button
            key={s.label}
            onClick={() => onChange(s.from, s.to)}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              dateFrom === s.from && dateTo === s.to
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onChange(e.target.value, dateTo)}
          className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <span className="text-slate-400 text-sm">→</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onChange(dateFrom, e.target.value)}
          className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
    </div>
  );
}

// --- Bloc d'export de fichiers ---

function FileExportBlock({ period }) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');

  // Pré-remplir avec le mois du sélecteur de synthèse
  const defaultFrom = period
    ? `${period}-01`
    : `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const defaultTo = period
    ? (() => {
        const [y, m] = period.split('-').map(Number);
        const last = new Date(y, m, 0);
        return `${y}-${pad(m)}-${pad(last.getDate())}`;
      })()
    : `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate())}`;

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [format, setFormat] = useState('csv');
  const [statuses, setStatuses] = useState({ validated: true, paid: true, transmitted: false, draft: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePeriodChange = (from, to) => {
    setDateFrom(from);
    setDateTo(to);
  };

  const handleDownload = async () => {
    setLoading(true);
    setError(null);
    try {
      const selectedStatuses = Object.entries(statuses)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(',');

      if (format === 'csv') {
        await downloadExportCSV({ date_from: dateFrom, date_to: dateTo, status: selectedStatuses || undefined });
      } else if (format === 'fec') {
        const year = new Date(dateFrom).getFullYear();
        await downloadExportFEC(year);
      } else if (format === 'recettes') {
        await downloadExportRecettes({ date_from: dateFrom, date_to: dateTo });
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la génération du fichier');
    } finally {
      setLoading(false);
    }
  };

  const formatOptions = [
    {
      value: 'csv',
      icon: <Table2 size={14} />,
      label: 'CSV générique',
      desc: 'Pour Excel / logiciels comptables',
    },
    {
      value: 'fec',
      icon: <FileText size={14} />,
      label: 'FEC (format fiscal)',
      desc: 'Fichier des Écritures Comptables — norme LPF',
    },
    {
      value: 'recettes',
      icon: <BookOpen size={14} />,
      label: 'Livre des recettes',
      desc: 'Factures payées uniquement — format BNC',
    },
  ];

  const showStatusFilter = format !== 'fec' && format !== 'recettes';

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Download size={16} className="text-blue-600" />
        <h3 className="text-sm font-semibold text-slate-700">Exporter les factures</h3>
      </div>

      {/* Période */}
      <div>
        <p className="text-xs text-slate-500 mb-2">Période</p>
        <PeriodSelector dateFrom={dateFrom} dateTo={dateTo} onChange={handlePeriodChange} />
      </div>

      {/* Format */}
      <div>
        <p className="text-xs text-slate-500 mb-2">Format</p>
        <div className="space-y-2">
          {formatOptions.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                format === opt.value
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="export-format"
                value={opt.value}
                checked={format === opt.value}
                onChange={() => setFormat(opt.value)}
                className="mt-0.5 accent-blue-600"
              />
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                {opt.icon} {opt.label}
              </span>
              <span className="text-xs text-slate-400 ml-auto">{opt.desc}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Filtre statut (masqué pour FEC et recettes) */}
      {showStatusFilter && (
        <div>
          <p className="text-xs text-slate-500 mb-2">Statuts inclus</p>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'validated', label: 'Validées' },
              { key: 'paid', label: 'Payées' },
              { key: 'transmitted', label: 'Transmises' },
              { key: 'draft', label: 'Brouillons' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={statuses[key]}
                  onChange={(e) => setStatuses((prev) => ({ ...prev, [key]: e.target.checked }))}
                  className="accent-blue-600"
                />
                <span className="text-xs text-slate-600">{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {format === 'fec' && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
          Le FEC exporte toutes les factures validées de l'exercice complet (année civile).
        </p>
      )}
      {format === 'recettes' && (
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
          Le livre des recettes n'inclut que les factures au statut "Payée".
        </p>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={handleDownload}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? (
          <>
            <RefreshCw size={14} className="animate-spin" />
            Génération en cours...
          </>
        ) : (
          <>
            <Download size={14} />
            Télécharger
          </>
        )}
      </button>
    </div>
  );
}

// --- Récapitulatif trimestriel ---

function QuarterlyBlock() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(getCurrentQuarter());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getQuarterlySummary(year, quarter);
      setData(result);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [year, quarter]);

  useEffect(() => { load(); }, [load]);

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      await downloadQuarterlyPDF(year, quarter);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const years = [now.getFullYear() - 1, now.getFullYear()];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp size={16} className="text-emerald-600" />
        <h3 className="text-sm font-semibold text-slate-700">Récapitulatif trimestriel</h3>
      </div>

      {/* Sélecteurs */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <div className="flex gap-1">
          {[1, 2, 3, 4].map((q) => (
            <button
              key={q}
              onClick={() => setQuarter(q)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                quarter === q
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-400'
              }`}
            >
              T{q}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <RefreshCw size={22} className="animate-spin text-slate-300" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            {QUARTER_NAMES[data.quarter]} {data.year}
          </p>

          {/* Ventilation recettes */}
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-100">
              {[
                { label: 'Honoraires (actes techniques)', value: data.total_honoraires },
                { label: 'Indemnités de déplacement (IFD / IFI)', value: data.total_indemnites_deplacement },
                { label: 'Indemnités kilométriques (IK)', value: data.total_ik },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center px-4 py-2.5 bg-slate-50">
                  <span className="text-sm text-slate-600">{label}</span>
                  <span className="text-sm font-medium text-slate-800">{fmtEur(value)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center px-4 py-3 bg-blue-50 font-semibold">
                <span className="text-sm text-blue-800">Total brut</span>
                <span className="text-base text-blue-800">{fmtEur(data.total_brut)}</span>
              </div>
            </div>
          </div>

          {/* Détail par mois */}
          {data.monthly_breakdown?.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {data.monthly_breakdown.map((mb) => (
                <div key={mb.month} className="bg-slate-50 rounded-lg p-2.5 text-center">
                  <p className="text-xs text-slate-500">{formatMonthLabel(mb.month)}</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">{fmtEur(mb.total)}</p>
                  <p className="text-xs text-slate-400">{mb.num_invoices} factures</p>
                </div>
              ))}
            </div>
          )}

          {/* Activité */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ['Factures émises', data.num_invoices],
              ['Factures payées', data.num_invoices_paid],
              ['Patients facturés', data.num_patients],
              ['Jours travaillés', data.num_working_days],
            ].map(([label, value]) => (
              <div key={label} className="bg-slate-50 rounded-lg p-2.5">
                <p className="text-xs text-slate-400">{label}</p>
                <p className="font-semibold text-slate-700">{value}</p>
              </div>
            ))}
          </div>

          {/* Estimation cotisations */}
          {data.cotisations_estimees && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <p className="text-xs text-amber-700 font-medium">
                Estimation cotisations URSSAF (~45%) : {fmtEur(data.cotisations_estimees)}
              </p>
              <p className="text-xs text-amber-600 mt-0.5">Indicatif — vérifier avec votre expert-comptable</p>
            </div>
          )}

          {/* Bouton PDF */}
          <button
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {pdfLoading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Génération PDF...
              </>
            ) : (
              <>
                <FileText size={14} />
                Exporter en PDF
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// --- Composant principal ---

export default function ExportSection({ period }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-1">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
          Exports &amp; Comptabilité
        </h2>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FileExportBlock period={period} />
        <QuarterlyBlock />
      </div>
    </div>
  );
}
