import React, { useState } from 'react';
import { Building2, MapPin, CreditCard, Pencil, Save, X, ChevronDown } from 'lucide-react';
import AddressAutocomplete from '../common/AddressAutocomplete';

const planLabels = {
  solo: 'Solo',
  cabinet: 'Cabinet',
  cabinet_plus: 'Cabinet+',
};

const statusLabels = {
  trial: 'Essai gratuit',
  active: 'Actif',
  canceled: 'Résilié',
};

const statusColors = {
  trial: 'bg-amber-100 text-amber-700',
  active: 'bg-emerald-100 text-emerald-700',
  canceled: 'bg-red-100 text-red-700',
};

export default function CabinetTab({ cabinet, onUpdate, readOnly }) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ name: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [infoOpen, setInfoOpen] = useState(true);
  const [aboOpen, setAboOpen] = useState(true);

  const startEditing = () => {
    setForm({ name: cabinet?.name || '', address: cabinet?.address || '' });
    setError('');
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Le nom du cabinet est requis.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onUpdate({ name: form.name.trim(), address: form.address.trim() });
      setIsEditing(false);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la mise à jour.');
    } finally {
      setSaving(false);
    }
  };

  if (!cabinet) {
    return <div className="text-center py-12 text-slate-500">Chargement...</div>;
  }

  const trialDate = cabinet.trial_ends_at
    ? new Date(cabinet.trial_ends_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-screen-md mx-auto">

      {/* --- Informations --- */}
      <section className="bg-slate-50 rounded-lg border border-slate-200 p-5">
        <div className="flex items-center justify-between">
          <button onClick={() => setInfoOpen(v => !v)} className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Building2 size={16} className="text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Informations</h2>
            <ChevronDown size={16} className={`text-slate-400 transition-transform ${infoOpen ? '' : '-rotate-90'}`} />
          </button>
          {infoOpen && !readOnly && !isEditing && (
            <button
              onClick={startEditing}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Pencil size={14} />
              Modifier
            </button>
          )}
        </div>

        {infoOpen && (isEditing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nom du cabinet</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxLength={255}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Adresse</label>
              <AddressAutocomplete
                value={form.address}
                onChange={address => setForm(prev => ({ ...prev, address }))}
                placeholder="Adresse du cabinet..."
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                <Save size={14} />
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200"
              >
                <X size={14} />
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Building2 size={16} className="text-slate-400 mt-0.5 shrink-0" />
              <div>
                <span className="text-slate-500 text-xs uppercase tracking-wide">Nom</span>
                <p className="text-slate-800 font-medium">{cabinet.name || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
              <div>
                <span className="text-slate-500 text-xs uppercase tracking-wide">Adresse</span>
                <p className="text-slate-800">{cabinet.address || '—'}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* --- Abonnement --- */}
      <section className="bg-slate-50 rounded-lg border border-slate-200 p-5">
        <button onClick={() => setAboOpen(v => !v)} className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <CreditCard size={16} className="text-emerald-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">Abonnement</h2>
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${aboOpen ? '' : '-rotate-90'}`} />
        </button>
        {aboOpen && <div className="space-y-3 text-sm mt-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Plan</span>
            <span className="font-medium text-slate-800">{planLabels[cabinet.plan] || cabinet.plan}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Statut</span>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[cabinet.subscription_status] || 'bg-slate-100 text-slate-600'}`}>
              {statusLabels[cabinet.subscription_status] || cabinet.subscription_status}
            </span>
          </div>
          {trialDate && (
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Fin de l'essai</span>
              <span className="text-slate-800">{trialDate}</span>
            </div>
          )}
        </div>}
      </section>

    </div>
  );
}
