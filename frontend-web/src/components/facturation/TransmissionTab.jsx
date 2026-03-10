import { useState, useEffect, useCallback } from 'react';
import {
  Send,
  FileText,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Download,
  RefreshCw,
  Loader2,
  FileJson,
  FileCode2,
} from 'lucide-react';
import { listInvoices } from '../../api/invoices';
import {
  generateFse,
  listFse,
  downloadFseLot,
  downloadFsePdf,
  downloadLotPdf,
  markFseTransmitted,
} from '../../api/fse';
import Badge from '../ui/Badge';
import EmptyState from '../ui/EmptyState';
import LoadingSpinner from '../ui/LoadingSpinner';

// --- Étape 1 : Sélectionner les factures à convertir ---
function Step1GenerateFse({ onGenerated }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [lotNumber, setLotNumber] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    listInvoices({ status: 'validated', limit: 100 })
      .then((data) => setInvoices(data.items || []))
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false));
  }, []);

  function toggleAll() {
    if (selected.size === invoices.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(invoices.map((i) => i.id)));
    }
  }

  async function handleGenerate() {
    if (selected.size === 0) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateFse([...selected], lotNumber || null);
      onGenerated(result);
    } catch {
      setError('Erreur lors de la génération des FSE.');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return <LoadingSpinner label="Chargement des factures validées…" />;
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <strong>Étape 1 :</strong> Sélectionnez les factures validées à convertir en FSE.
        Les factures déjà converties seront automatiquement ignorées.
      </div>

      {invoices.length === 0 ? (
        <EmptyState icon={FileText} title="Aucune facture validée en attente de FSE." />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.size === invoices.length}
                onChange={toggleAll}
                className="rounded border-slate-300"
              />
              Tout sélectionner ({invoices.length} factures)
            </label>
            <span className="text-sm text-slate-500">{selected.size} sélectionnée(s)</span>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
            {invoices.map((inv) => (
              <label key={inv.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(inv.id)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(inv.id);
                    else next.delete(inv.id);
                    setSelected(next);
                  }}
                  className="rounded border-slate-300"
                />
                <span className="flex-1 text-sm font-mono">{inv.invoice_number}</span>
                <span className="text-sm text-slate-500">{inv.care_date}</span>
                <span className="text-sm font-medium">{Number(inv.total_amount || 0).toFixed(2)} €</span>
              </label>
            ))}
          </div>
        </>
      )}

      <div className="flex items-end gap-4">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Numéro de lot (optionnel)
          </label>
          <input
            type="text"
            value={lotNumber}
            onChange={(e) => setLotNumber(e.target.value)}
            placeholder="ex: 2026-T1-01"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          onClick={handleGenerate}
          disabled={selected.size === 0 || generating}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {generating ? <Loader2 className="animate-spin" size={15} /> : <FileText size={15} />}
          Générer les FSE ({selected.size})
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

// --- Étape 2 : Exporter le lot ---
function Step2ExportLot({ lotNumber }) {
  const [exporting, setExporting] = useState(null);

  const formats = [
    { fmt: 'csv', label: 'CSV', desc: 'Compatible Excel — format infirmiers libéraux', icon: FileText },
    { fmt: 'xml', label: 'XML', desc: 'Import logiciels métier (Alaxione, Pharma, etc.)', icon: FileCode2 },
    { fmt: 'json', label: 'JSON', desc: 'APIs et intégrations tierces', icon: FileJson },
  ];

  async function handleExport(fmt) {
    setExporting(fmt);
    try {
      await downloadFseLot({ fmt, lotNumber: lotNumber || null });
    } finally {
      setExporting(null);
    }
  }

  async function handlePdf() {
    if (!lotNumber) return;
    setExporting('pdf');
    try {
      await downloadLotPdf(lotNumber);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <strong>Étape 2 :</strong> Exportez{lotNumber ? <> le lot <code className="bg-amber-100 px-1 rounded">{lotNumber}</code></> : ' le lot'} dans
        le format requis par votre logiciel de facturation ou la CPAM.
      </div>

      <div className="grid gap-3">
        {formats.map(({ fmt, label, desc, icon: Icon }) => (
          <div key={fmt} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:border-slate-300 bg-white">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100">
                <Icon size={18} className="text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">{label}</p>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
            </div>
            <button
              onClick={() => handleExport(fmt)}
              disabled={exporting !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
            >
              {exporting === fmt ? <Loader2 className="animate-spin" size={13} /> : <Download size={13} />}
              Télécharger
            </button>
          </div>
        ))}

        {lotNumber && (
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:border-slate-300 bg-white">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100">
                <FileText size={18} className="text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">PDF Feuilles de soins</p>
                <p className="text-xs text-slate-500">Une page par FSE — pour archivage et impression patient</p>
              </div>
            </div>
            <button
              onClick={handlePdf}
              disabled={exporting !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
            >
              {exporting === 'pdf' ? <Loader2 className="animate-spin" size={13} /> : <Download size={13} />}
              PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Étape 3 : Suivi des FSE ---
function Step3Tracking() {
  const [fses, setFses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [transmitting, setTransmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = statusFilter ? { status: statusFilter } : {};
    listFse(params)
      .then(setFses)
      .catch(() => setFses([]))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleMarkTransmitted() {
    if (selected.size === 0) return;
    setTransmitting(true);
    try {
      await markFseTransmitted([...selected]);
      setSelected(new Set());
      load();
    } finally {
      setTransmitting(false);
    }
  }

  const stats = {
    generated: fses.filter((f) => f.status === 'generated').length,
    exported: fses.filter((f) => f.status === 'exported').length,
    transmitted: fses.filter((f) => f.status === 'transmitted').length,
    rejected: fses.filter((f) => f.status === 'rejected').length,
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { key: 'generated', label: 'Générées', color: 'blue', icon: FileText },
          { key: 'exported', label: 'Exportées', color: 'amber', icon: Download },
          { key: 'transmitted', label: 'Transmises', color: 'green', icon: CheckCircle2 },
          { key: 'rejected', label: 'Rejetées', color: 'red', icon: AlertCircle },
        ].map(({ key, label, color, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
            className={`p-3 rounded-lg border text-left transition-colors ${
              statusFilter === key
                ? `bg-${color}-50 border-${color}-300`
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <Icon size={16} className={`text-${color}-500 mb-1`} />
            <p className="text-xl font-bold text-slate-800">{stats[key]}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <RefreshCw size={13} />
          Actualiser
        </button>
        {selected.size > 0 && (
          <button
            onClick={handleMarkTransmitted}
            disabled={transmitting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {transmitting ? <Loader2 className="animate-spin" size={13} /> : <Send size={13} />}
            Marquer transmises ({selected.size})
          </button>
        )}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : fses.length === 0 ? (
        <EmptyState icon={Send} title={statusFilter ? `Aucune FSE au statut "${statusFilter}"` : 'Aucune FSE.'} />
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === fses.filter((f) => f.status !== 'transmitted').length}
                    onChange={() => {
                      const eligible = fses.filter((f) => f.status !== 'transmitted').map((f) => f.id);
                      setSelected(selected.size === eligible.length ? new Set() : new Set(eligible));
                    }}
                    className="rounded border-slate-300"
                  />
                </th>
                <th className="px-3 py-2 text-left">N° FSE</th>
                <th className="px-3 py-2 text-left">Lot</th>
                <th className="px-3 py-2 text-left">Date soins</th>
                <th className="px-3 py-2 text-right">Montant</th>
                <th className="px-3 py-2 text-center">Statut</th>
                <th className="px-3 py-2 text-center">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fses.map((fse) => (
                <tr key={fse.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    {fse.status !== 'transmitted' && (
                      <input
                        type="checkbox"
                        checked={selected.has(fse.id)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(fse.id);
                          else next.delete(fse.id);
                          setSelected(next);
                        }}
                        className="rounded border-slate-300"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">{fse.fse_number}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{fse.lot_number || '—'}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {fse.date_soins ? new Date(fse.date_soins + 'T00:00:00').toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{Number(fse.montant_total).toFixed(2)} €</td>
                  <td className="px-3 py-2 text-center">
                    <Badge variant={fse.status} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => downloadFsePdf(fse.id)}
                      className="text-slate-400 hover:text-blue-600 transition-colors"
                      title="Ouvrir la feuille de soins PDF"
                    >
                      <FileText size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- Composant principal ---
export default function TransmissionTab() {
  const [step, setStep] = useState(1);
  const [lastResult, setLastResult] = useState(null);

  function handleGenerated(result) {
    setLastResult(result);
    if (result.total_generated > 0) {
      setStep(2);
    }
  }

  const steps = [
    { num: 1, label: 'Générer FSE' },
    { num: 2, label: 'Exporter' },
    { num: 3, label: 'Suivi' },
  ];

  return (
    <div className="space-y-6 py-4">
      {/* Titre */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Send size={18} className="text-blue-600" />
          Télétransmission SESAM-Vitale
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Préparez et suivez vos Feuilles de Soins Électroniques (FSE) pour la CPAM.
        </p>
      </div>

      {/* Bandeau CPAM */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
        <AlertCircle size={14} className="mt-0.5 shrink-0" />
        <span>
          <strong>Module en cours d'homologation SESAM-Vitale.</strong> Les FSE générées ici sont à importer
          dans votre logiciel de facturation agréé (Alaxione, Pharma+, HelloDoc…) pour la transmission réelle à la CPAM.
        </span>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            <button
              onClick={() => setStep(s.num)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                step === s.num
                  ? 'bg-blue-600 text-white'
                  : step > s.num
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {step > s.num ? (
                <CheckCircle2 size={14} />
              ) : (
                <span className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center text-[10px] font-bold">
                  {s.num}
                </span>
              )}
              {s.label}
            </button>
            {i < steps.length - 1 && <ChevronRight size={14} className="text-slate-400" />}
          </div>
        ))}
      </div>

      {/* Résumé génération */}
      {lastResult && step > 1 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
          <strong>{lastResult.total_generated} FSE générée(s)</strong> dans le lot{' '}
          <code className="bg-emerald-100 px-1 rounded">{lastResult.lot_number}</code>.
          {lastResult.total_skipped > 0 && (
            <span className="ml-2 text-amber-700">
              ({lastResult.total_skipped} ignorée(s))
            </span>
          )}
        </div>
      )}

      {/* Contenu selon l'étape */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        {step === 1 && <Step1GenerateFse onGenerated={handleGenerated} />}
        {step === 2 && <Step2ExportLot lotNumber={lastResult?.lot_number} />}
        {step === 3 && <Step3Tracking />}
      </div>

      {/* Navigation bas */}
      <div className="flex justify-between">
        {step > 1 ? (
          <button
            onClick={() => setStep(step - 1)}
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            ← Étape précédente
          </button>
        ) : <div />}
        {step < 3 && (
          <button
            onClick={() => setStep(step + 1)}
            className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            Étape suivante <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
