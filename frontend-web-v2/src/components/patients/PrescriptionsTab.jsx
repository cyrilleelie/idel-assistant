import { useState } from 'react';
import {
  Plus, Trash2, ChevronDown, ChevronUp, FileUp, X, File,
  Calendar, Clock, RefreshCw, MessageSquare, Pencil
} from 'lucide-react';

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: '1x / jour' },
  { value: '2xday', label: '2x / jour' },
  { value: '3xday', label: '3x / jour' },
  { value: 'weekly', label: '1x / semaine' },
  { value: '2xweek', label: '2x / semaine' },
  { value: '3xweek', label: '3x / semaine' },
  { value: 'custom', label: 'Personnalisé' },
];

const SLOT_OPTIONS = [
  { value: '', label: 'Non précisé' },
  { value: 'Matin', label: 'Matin' },
  { value: 'Soir', label: 'Soir' },
  { value: 'Matin et Soir', label: 'Matin et Soir' },
];

function frequencyLabel(freq) {
  return FREQUENCY_OPTIONS.find(o => o.value === freq)?.label || freq;
}

function formatDateFr(dateStr) {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function emptyPrescription() {
  return {
    id: 'rx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    label: '',
    documents: [],
    startDate: '',
    endDate: '',
    careSchedule: {
      frequency: 'daily',
      customFrequency: '',
      preferredSlot: '',
      notes: '',
    },
  };
}

function PrescriptionForm({ prescription, onChange, onCancel, onSave }) {
  const [dragOver, setDragOver] = useState(false);

  const update = (field, value) => {
    onChange({ ...prescription, [field]: value });
  };

  const updateSchedule = (field, value) => {
    onChange({
      ...prescription,
      careSchedule: { ...prescription.careSchedule, [field]: value },
    });
  };

  const handleFiles = (files) => {
    const newDocs = Array.from(files).map(f => ({
      id: 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name: f.name,
      size: f.size,
      url: URL.createObjectURL(f),
    }));
    update('documents', [...prescription.documents, ...newDocs]);
  };

  const removeDoc = (docId) => {
    update('documents', prescription.documents.filter(d => d.id !== docId));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const isValid = prescription.label.trim() && prescription.startDate && prescription.endDate;

  return (
    <div className="border border-blue-200 bg-blue-50/50 rounded-lg p-5 space-y-4">
      {/* Label */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Nom de l'ordonnance *</label>
        <input
          type="text"
          value={prescription.label}
          onChange={e => update('label', e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          placeholder="Ex: Pansement post-opératoire, Injections insuline..."
        />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date de début *</label>
          <input
            type="date"
            value={prescription.startDate}
            onChange={e => update('startDate', e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date de fin *</label>
          <input
            type="date"
            value={prescription.endDate}
            onChange={e => update('endDate', e.target.value)}
            min={prescription.startDate}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          />
        </div>
      </div>

      {/* Programmation soins */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Fréquence</label>
          <select
            value={prescription.careSchedule.frequency}
            onChange={e => updateSchedule('frequency', e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            {FREQUENCY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Créneau préféré</label>
          <select
            value={prescription.careSchedule.preferredSlot}
            onChange={e => updateSchedule('preferredSlot', e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            {SLOT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Fréquence custom */}
      {prescription.careSchedule.frequency === 'custom' && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Fréquence personnalisée</label>
          <input
            type="text"
            value={prescription.careSchedule.customFrequency}
            onChange={e => updateSchedule('customFrequency', e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            placeholder="Ex: Tous les 2 jours, Lundi et Jeudi..."
          />
        </div>
      )}

      {/* Notes soins */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Précisions sur les soins</label>
        <textarea
          value={prescription.careSchedule.notes}
          onChange={e => updateSchedule('notes', e.target.value)}
          rows={2}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          placeholder="Détails sur le soin, matériel nécessaire..."
        />
      </div>

      {/* Upload documents */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Documents (ordonnances, photos...)</label>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-blue-300 bg-white'}`}
          onClick={() => document.getElementById('rx-file-input-' + prescription.id)?.click()}
        >
          <FileUp size={20} className="mx-auto text-slate-400 mb-1" />
          <p className="text-sm text-slate-500">Glisser des fichiers ici ou <span className="text-blue-600 font-medium">parcourir</span></p>
          <input
            id={'rx-file-input-' + prescription.id}
            type="file"
            multiple
            accept="image/*,.pdf"
            className="hidden"
            onChange={e => { if (e.target.files.length) handleFiles(e.target.files); e.target.value = ''; }}
          />
        </div>

        {/* Liste des fichiers */}
        {prescription.documents.length > 0 && (
          <div className="mt-2 space-y-1">
            {prescription.documents.map(doc => (
              <div key={doc.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <File size={14} className="text-slate-400 shrink-0" />
                  <span className="truncate">{doc.name}</span>
                  <span className="text-slate-400 text-xs shrink-0">({(doc.size / 1024).toFixed(0)} Ko)</span>
                </div>
                <button onClick={() => removeDoc(doc.id)} className="text-red-400 hover:text-red-600 shrink-0 ml-2">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
        <button onClick={onCancel} className="text-slate-600 hover:bg-slate-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Annuler
        </button>
        <button
          onClick={onSave}
          disabled={!isValid}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Valider l'ordonnance
        </button>
      </div>
    </div>
  );
}

function PrescriptionCard({ prescription, isEditing, onEdit, onDelete, expanded, onToggle }) {
  const isActive = prescription.endDate >= new Date().toISOString().split('T')[0];

  return (
    <div className={`border rounded-lg transition-shadow ${isActive ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50/50'}`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          <span className="font-medium text-slate-800 truncate">{prescription.label || 'Sans titre'}</span>
          <span className="text-xs text-slate-500 shrink-0">
            {formatDateFr(prescription.startDate)} — {formatDateFr(prescription.endDate)}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {prescription.documents.length > 0 && (
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              {prescription.documents.length} doc{prescription.documents.length > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
            {prescription.careSchedule.frequency === 'custom'
              ? (prescription.careSchedule.customFrequency || 'Personnalisé')
              : frequencyLabel(prescription.careSchedule.frequency)}
          </span>
          {prescription.careSchedule.preferredSlot && (
            <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
              {prescription.careSchedule.preferredSlot}
            </span>
          )}
          {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      {/* Body (expanded) */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
          {/* Détails programmation */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <Calendar size={14} className="text-blue-500" />
              <span>{formatDateFr(prescription.startDate)} — {formatDateFr(prescription.endDate)}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <RefreshCw size={14} className="text-blue-500" />
              <span>
                {prescription.careSchedule.frequency === 'custom'
                  ? (prescription.careSchedule.customFrequency || 'Personnalisé')
                  : frequencyLabel(prescription.careSchedule.frequency)}
              </span>
            </div>
            {prescription.careSchedule.preferredSlot && (
              <div className="flex items-center gap-2 text-slate-600">
                <Clock size={14} className="text-blue-500" />
                <span>{prescription.careSchedule.preferredSlot}</span>
              </div>
            )}
          </div>

          {/* Notes soins */}
          {prescription.careSchedule.notes && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1">
                <MessageSquare size={12} /> Précisions soins
              </div>
              <p className="whitespace-pre-wrap">{prescription.careSchedule.notes}</p>
            </div>
          )}

          {/* Documents */}
          {prescription.documents.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1.5">Documents joints</div>
              <div className="space-y-1">
                {prescription.documents.map(doc => (
                  <a
                    key={doc.id}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 transition-colors"
                  >
                    <File size={14} className="text-slate-400" />
                    <span className="truncate">{doc.name}</span>
                    <span className="text-slate-400 text-xs shrink-0">({(doc.size / 1024).toFixed(0)} Ko)</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Actions édition */}
          {isEditing && (
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={onEdit} className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5">
                <Pencil size={14} /> Modifier
              </button>
              <button onClick={onDelete} className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5">
                <Trash2 size={14} /> Supprimer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PrescriptionsTab({ patientForm, setPatientForm, isEditingPatient, setIsEditingPatient }) {
  const prescriptions = patientForm.prescriptions || [];
  const [expandedId, setExpandedId] = useState(null);
  const [formMode, setFormMode] = useState(null); // null | 'add' | prescriptionId (edit)
  const [formData, setFormData] = useState(null);

  const sortedPrescriptions = [...prescriptions].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));

  const updatePrescriptions = (newList) => {
    setPatientForm({ ...patientForm, prescriptions: newList });
  };

  const startAdd = () => {
    if (!isEditingPatient && setIsEditingPatient) {
      setIsEditingPatient(true);
    }
    setFormData(emptyPrescription());
    setFormMode('add');
  };

  const startEdit = (rx) => {
    setFormData({ ...rx, careSchedule: { ...rx.careSchedule }, documents: [...rx.documents] });
    setFormMode(rx.id);
  };

  const cancelForm = () => {
    setFormMode(null);
    setFormData(null);
  };

  const saveForm = () => {
    if (!formData.label.trim() || !formData.startDate || !formData.endDate) return;
    if (formMode === 'add') {
      updatePrescriptions([...prescriptions, formData]);
    } else {
      updatePrescriptions(prescriptions.map(rx => rx.id === formMode ? formData : rx));
    }
    cancelForm();
  };

  const deletePrescription = (id) => {
    updatePrescriptions(prescriptions.filter(rx => rx.id !== id));
    if (formMode === id) cancelForm();
  };

  return (
    <div className="space-y-4">
      {/* Bouton ajouter (toujours visible sauf formulaire ouvert) */}
      {formMode === null && (
        <button
          onClick={startAdd}
          className="flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm w-full justify-center border border-blue-200"
        >
          <Plus size={16} /> Ajouter une ordonnance
        </button>
      )}

      {/* Formulaire ajout */}
      {formMode === 'add' && formData && (
        <PrescriptionForm
          prescription={formData}
          onChange={setFormData}
          onCancel={cancelForm}
          onSave={saveForm}
        />
      )}

      {/* Liste des ordonnances */}
      {sortedPrescriptions.length > 0 ? (
        <div className="space-y-2">
          {sortedPrescriptions.map(rx => (
            formMode === rx.id && formData ? (
              <PrescriptionForm
                key={rx.id}
                prescription={formData}
                onChange={setFormData}
                onCancel={cancelForm}
                onSave={saveForm}
              />
            ) : (
              <PrescriptionCard
                key={rx.id}
                prescription={rx}
                isEditing={isEditingPatient}
                expanded={expandedId === rx.id}
                onToggle={() => setExpandedId(expandedId === rx.id ? null : rx.id)}
                onEdit={() => startEdit(rx)}
                onDelete={() => deletePrescription(rx.id)}
              />
            )
          ))}
        </div>
      ) : (
        !isEditingPatient && (
          <div className="text-center py-8 text-slate-400 text-sm">
            Aucune ordonnance.
          </div>
        )
      )}

      {/* Empty state quand pas d'ordonnances et pas de formulaire ouvert */}
      {prescriptions.length === 0 && formMode === null && (
        <div className="text-center py-8 text-slate-400 text-sm">
          Aucune ordonnance enregistrée.
        </div>
      )}
    </div>
  );
}
