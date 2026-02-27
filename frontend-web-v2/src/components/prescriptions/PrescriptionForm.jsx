import { useState, useEffect } from 'react';
import { Plus, X, File, FileUp, FileText, AlertCircle, Check, Loader2 } from 'lucide-react';
import { createPrescription, updatePrescription, uploadPrescriptionDocument } from '../../api/prescriptions';
import { listCareActCodes } from '../../api/cotation';
import { listCareLabels } from '../../api/care-labels';

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: '1x / jour' },
  { value: '2xday', label: '2x / jour' },
  { value: '3xday', label: '3x / jour' },
  { value: 'weekly', label: '1x / semaine' },
  { value: '2xweek', label: '2x / semaine' },
  { value: '3xweek', label: '3x / semaine' },
  { value: 'custom', label: 'Personnalisé' },
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Formulaire de création / modification d'ordonnance.
 * Mêmes champs et même layout que SoinFormItem dans PrescriptionsTab.
 *
 * Props :
 *   - patientId: UUID (obligatoire)
 *   - careProtocolId: UUID (optionnel)
 *   - prescription: objet existant (mode édition)
 *   - onSave(prescription): callback quand l'ordonnance est créée/modifiée
 *   - onCancel(): callback pour fermer le formulaire
 */
export default function PrescriptionForm({
  patientId,
  careProtocolId = null,
  prescription = null,
  onSave,
  onCancel,
}) {
  const isEdit = !!prescription;

  const [form, setForm] = useState({
    label: prescription?.label ?? '',
    care_label_code: prescription?.care_label_code ?? null,
    start_date: prescription?.start_date ?? todayStr(),
    end_date: prescription?.end_date ?? '',
    duration_minutes: prescription?.duration_minutes ?? '',
    frequency_display: prescription?.frequency_display ?? 'daily',
    custom_frequency: prescription?.custom_frequency ?? '',
    act_codes: prescription?.act_codes ?? [],
    prescriber_name: prescription?.prescriber_name ?? '',
    prescriber_rpps: prescription?.prescriber_rpps ?? '',
    prescription_date: prescription?.prescription_date ?? '',
    care_description: prescription?.care_description ?? '',
    notes: prescription?.notes ?? '',
    max_renewals: prescription?.max_renewals ?? 0,
    document_filename: prescription?.document_filename ?? null,
    document_url: prescription?.document_url ?? null,
    document_type: prescription?.document_type ?? null,
  });

  const [pendingFile, setPendingFile] = useState(null);
  const [pendingFileName, setPendingFileName] = useState(null);
  const [pendingFileSize, setPendingFileSize] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [showLabelSuggestions, setShowLabelSuggestions] = useState(false);

  const [careLabels, setCareLabels] = useState([]);
  const [careDurations, setCareDurations] = useState({});
  const [careLabelCodeMap, setCareLabelCodeMap] = useState({});
  const [ngapCodes, setNgapCodes] = useState([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    listCareLabels().then(labels => {
      setCareLabels(labels.map(l => l.label));
      const durations = {};
      const codemap = {};
      for (const l of labels) {
        if (l.duration_minutes) durations[l.label] = l.duration_minutes;
        if (l.act_codes?.length) codemap[l.label] = l.act_codes;
      }
      setCareDurations(durations);
      setCareLabelCodeMap(codemap);
    }).catch(() => {});

    listCareActCodes().then(setNgapCodes).catch(() => setNgapCodes([]));
  }, []);

  const update = (field, value) => {
    setForm(f => {
      const updated = { ...f, [field]: value };
      if (field === 'start_date' && value && (!f.end_date || f.end_date < value)) {
        updated.end_date = value;
      }
      return updated;
    });
  };

  const selectLabel = (label) => {
    setForm(f => {
      const updated = { ...f, label };
      const duration = careDurations[label];
      if (duration) updated.duration_minutes = duration;
      const codes = careLabelCodeMap[label];
      if (codes?.length) updated.act_codes = codes;
      return updated;
    });
    setShowLabelSuggestions(false);
  };

  const handleFiles = (files) => {
    const file = Array.from(files)[0];
    if (!file) return;
    setPendingFile(file);
    setPendingFileName(file.name);
    setPendingFileSize(file.size);
  };

  const removeDoc = () => {
    setPendingFile(null);
    setPendingFileName(null);
    setPendingFileSize(null);
    setForm(f => ({ ...f, document_filename: null, document_url: null, document_type: null }));
  };

  const isValid = form.label.trim() && form.start_date && form.end_date;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        patient_id: patientId,
        care_protocol_id: careProtocolId || undefined,
        label: form.label.trim(),
        care_label_code: form.care_label_code || null,
        start_date: form.start_date,
        end_date: form.end_date || null,
        duration_minutes: Number(form.duration_minutes) || 30,
        frequency_display: form.frequency_display || 'daily',
        custom_frequency: form.custom_frequency || null,
        act_codes: form.act_codes || [],
        prescriber_name: form.prescriber_name || null,
        prescriber_rpps: form.prescriber_rpps || null,
        prescription_date: form.prescription_date || null,
        care_description: form.care_description || null,
        notes: form.notes || null,
        max_renewals: Number(form.max_renewals) || 0,
      };

      let result;
      if (isEdit) {
        result = await updatePrescription(prescription.id, payload);
      } else {
        result = await createPrescription(payload);
      }

      if (pendingFile && result.id) {
        result = await uploadPrescriptionDocument(result.id, pendingFile);
      }

      setSuccess(true);
      setTimeout(() => onSave?.(result), 600);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const displayedDoc = pendingFileName
    ? { name: pendingFileName, size: pendingFileSize, pending: true }
    : form.document_filename
      ? { name: form.document_filename.split('/').pop(), pending: false }
      : null;

  const formId = `pf_${prescription?.id ?? 'new'}`;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-800">
            {isEdit ? 'Modifier l\'ordonnance' : 'Nouvelle ordonnance'}
          </h3>
        </div>
        {onCancel && (
          <button type="button" onClick={onCancel} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">

        {/* Nom du soin + Code NGAP */}
        <div className="grid grid-cols-2 gap-4">
          <div className="relative">
            <label className="block text-xs font-medium text-slate-600 mb-1">Type de soin *</label>
            <input
              type="text"
              value={form.label}
              onChange={e => { update('label', e.target.value); setShowLabelSuggestions(true); }}
              onFocus={() => setShowLabelSuggestions(true)}
              onBlur={() => setTimeout(() => setShowLabelSuggestions(false), 150)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              placeholder="Ex: Pansement, Injection..."
              autoComplete="off"
            />
            {showLabelSuggestions && careLabels.length > 0 && (() => {
              const query = form.label.toLowerCase();
              const filtered = careLabels.filter(l => l.toLowerCase().includes(query));
              if (filtered.length === 0) return null;
              if (filtered.length === 1 && filtered[0].toLowerCase() === query) return null;
              return (
                <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filtered.map(label => (
                    <li
                      key={label}
                      onMouseDown={() => selectLabel(label)}
                      className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 hover:text-blue-700 transition-colors"
                    >
                      {label}
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Code NGAP</label>
            <select
              value={(form.act_codes && form.act_codes[0]) || ''}
              onChange={e => update('act_codes', e.target.value ? [e.target.value] : [])}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="">-- Aucun --</option>
              {ngapCodes.map(act => (
                <option key={act.id} value={act.code}>{act.code} — {act.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date de début *</label>
            <input
              type="date"
              value={form.start_date}
              onChange={e => update('start_date', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date de fin *</label>
            <input
              type="date"
              value={form.end_date}
              onChange={e => update('end_date', e.target.value)}
              min={form.start_date}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            />
          </div>
        </div>

        {/* Durée + Fréquence */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Durée du soin (minutes)</label>
            <input
              type="number"
              min="1"
              max="480"
              value={form.duration_minutes || ''}
              onChange={e => update('duration_minutes', e.target.value ? Number(e.target.value) : '')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              placeholder="Ex: 15, 30, 45..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fréquence</label>
            <select
              value={form.frequency_display}
              onChange={e => update('frequency_display', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              {FREQUENCY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {form.frequency_display === 'custom' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fréquence personnalisée</label>
            <input
              type="text"
              value={form.custom_frequency}
              onChange={e => update('custom_frequency', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              placeholder="Ex: Tous les 2 jours, Lundi et Jeudi..."
            />
          </div>
        )}

        {/* Prescripteur (optionnel) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Médecin prescripteur</label>
            <input
              type="text"
              value={form.prescriber_name || ''}
              onChange={e => update('prescriber_name', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              placeholder="Dr Dupont (optionnel)"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date de prescription</label>
            <input
              type="date"
              value={form.prescription_date || ''}
              onChange={e => update('prescription_date', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Précisions sur le soin</label>
          <textarea
            value={form.notes || ''}
            onChange={e => update('notes', e.target.value)}
            rows={2}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            placeholder="Détails, matériel nécessaire..."
          />
        </div>

        {/* Renouvellements autorisés */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Renouvellements autorisés
            <span className="ml-1 text-slate-400 font-normal">(0 = non renouvelable)</span>
          </label>
          <input
            type="number"
            min={0}
            max={12}
            value={form.max_renewals ?? 0}
            onChange={e => update('max_renewals', parseInt(e.target.value, 10) || 0)}
            className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          />
        </div>

        {/* Document (scan / photo) */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-600">Document (scan ou photo de l'ordonnance)</label>

          {displayedDoc && (
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <File size={14} className="text-slate-400 shrink-0" />
                <span className="truncate">{displayedDoc.name}</span>
                {displayedDoc.pending && displayedDoc.size && (
                  <span className="text-slate-400 text-xs shrink-0">({(displayedDoc.size / 1024).toFixed(0)} Ko)</span>
                )}
                {displayedDoc.pending && (
                  <span className="text-amber-600 text-xs shrink-0 font-medium">• en attente d'upload</span>
                )}
              </div>
              <button type="button" onClick={removeDoc} className="text-red-400 hover:text-red-600 shrink-0 ml-2">
                <X size={14} />
              </button>
            </div>
          )}

          {!displayedDoc && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
              className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-blue-300 bg-slate-50'}`}
              onClick={() => document.getElementById(formId + '_file')?.click()}
            >
              <FileUp size={16} className="mx-auto text-slate-400 mb-0.5" />
              <p className="text-xs text-slate-500">Glisser ou <span className="text-blue-600 font-medium">parcourir</span></p>
              <p className="text-xs text-slate-400 mt-0.5">JPEG, PNG, PDF · max 10 Mo</p>
              <input
                id={formId + '_file'}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={e => { if (e.target.files.length) handleFiles(e.target.files); e.target.value = ''; }}
              />
            </div>
          )}
        </div>

        {/* Erreur */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Succès */}
        {success && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-lg px-4 py-3 text-sm text-green-700">
            <Check className="w-4 h-4 shrink-0" />
            Ordonnance {isEdit ? 'modifiée' : 'créée'} avec succès
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
            >
              Annuler
            </button>
          )}
          <button
            type="submit"
            disabled={!isValid || saving || success}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Créer l\'ordonnance'}
          </button>
        </div>
      </form>
    </div>
  );
}
