import { useState } from 'react';
import {
  ArrowLeft, UserMinus, UserPlus, Edit, Phone, Mail, UserCircle, AlertTriangle
} from 'lucide-react';

const availableColors = [
  { label: 'Bleu', value: 'bg-blue-100 text-blue-800 border-blue-200' },
  { label: 'Vert', value: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { label: 'Violet', value: 'bg-purple-100 text-purple-800 border-purple-200' },
  { label: 'Rose', value: 'bg-pink-100 text-pink-800 border-pink-200' },
  { label: 'Orange', value: 'bg-orange-100 text-orange-800 border-orange-200' },
  { label: 'Cyan', value: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
];

export default function NurseDetail({
  selectedNurseId, nurseForm, setNurseForm,
  isEditingNurse, setIsEditingNurse,
  closeNurseDetail, handleSaveNurse, deactivateNurse, reactivateNurse,
  readOnly = false,
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isInactive = nurseForm.active === false;

  return (
    <div className="animate-in slide-in-from-right-4 duration-300 flex flex-col h-full">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-4">
          <button onClick={closeNurseDetail} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl border ${nurseForm.color || 'bg-blue-100 text-blue-800 border-blue-200'}`}>
              {nurseForm.firstName?.charAt(0) || '?'}{nurseForm.lastName?.charAt(0) || '?'}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 uppercase">
                {nurseForm.lastName || 'Nouveau'} <span className="capitalize font-medium">{nurseForm.firstName || 'membre'}</span>
              </h2>
              {!isEditingNurse && nurseForm.role && (
                <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">{nurseForm.role}</span>
              )}
            </div>
          </div>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2 ml-16 md:ml-0">
            {!isEditingNurse ? (
              <>
                {isInactive ? (
                  <button onClick={() => reactivateNurse(selectedNurseId)} className="text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                    <UserPlus size={16}/> Réactiver
                  </button>
                ) : (
                  <button onClick={() => setShowDeleteConfirm(true)} className="text-amber-600 hover:bg-amber-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                    <UserMinus size={16}/> Désactiver
                  </button>
                )}
                <button onClick={() => setIsEditingNurse(true)} className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
                  <Edit size={16}/> Modifier
                </button>
              </>
            ) : (
              <>
                <button onClick={() => selectedNurseId === 'new' ? closeNurseDetail() : setIsEditingNurse(false)} className="text-slate-600 hover:bg-slate-100 px-4 py-2 rounded-lg font-medium transition-colors">
                  Annuler
                </button>
                <button onClick={handleSaveNurse} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">
                  Enregistrer
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Identité & Rôle */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-100 pb-2">Identité & Rôle</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nom *</label>
                {isEditingNurse ? (
                  <input
                    autoFocus
                    type="text"
                    value={nurseForm.lastName}
                    onChange={e => setNurseForm({ ...nurseForm, lastName: e.target.value.toUpperCase() })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                    placeholder="DUPONT"
                    required
                  />
                ) : (
                  <div className="text-sm font-medium uppercase">{nurseForm.lastName || '-'}</div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Prénom *</label>
                {isEditingNurse ? (
                  <input
                    type="text"
                    value={nurseForm.firstName}
                    onChange={e => setNurseForm({ ...nurseForm, firstName: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none capitalize"
                    placeholder="Alice"
                    required
                  />
                ) : (
                  <div className="text-sm font-medium capitalize">{nurseForm.firstName || '-'}</div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Rôle</label>
              {isEditingNurse ? (
                <select
                  value={nurseForm.role}
                  onChange={e => setNurseForm({ ...nurseForm, role: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Titulaire">Titulaire</option>
                  <option value="Collaborateur">Collaborateur / Collaboratrice</option>
                  <option value="Remplaçant(e)">Remplaçant(e)</option>
                </select>
              ) : (
                <div className="inline-block text-sm font-medium text-slate-700 bg-slate-100 px-3 py-1 rounded-full">{nurseForm.role || '-'}</div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Couleur</label>
              {isEditingNurse ? (
                <div className="flex flex-wrap gap-2">
                  {availableColors.map(c => {
                    const isSelected = nurseForm.color === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setNurseForm({ ...nurseForm, color: c.value })}
                        className={`w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center ${c.value.split(' ')[0]} ${isSelected ? 'ring-2 ring-offset-2 ring-blue-500 border-blue-500' : 'border-slate-200 hover:scale-110'}`}
                        title={c.label}
                      >
                        {isSelected && <span className="text-xs font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full border ${nurseForm.color || 'bg-slate-100 border-slate-200'}`}></div>
                  <span className="text-sm text-slate-600">{availableColors.find(c => c.value === nurseForm.color)?.label || 'Non définie'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-100 pb-2">Contact</h3>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Téléphone</label>
              {isEditingNurse ? (
                <input
                  type="tel"
                  value={nurseForm.phone}
                  onChange={e => setNurseForm({ ...nurseForm, phone: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="06 12 34 56 78"
                />
              ) : (
                <div className="text-sm text-slate-700 flex items-center gap-2">
                  <Phone size={16} className="text-slate-400" /> {nurseForm.phone || '-'}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
              {isEditingNurse ? (
                <input
                  type="email"
                  value={nurseForm.email}
                  onChange={e => setNurseForm({ ...nurseForm, email: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="alice@cabinet.fr"
                />
              ) : (
                <div className="text-sm text-slate-700 flex items-center gap-2">
                  <Mail size={16} className="text-slate-400" /> {nurseForm.email || '-'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modale de confirmation de suppression */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                <AlertTriangle size={24} className="text-amber-600" />
              </div>
              <h3 className="font-semibold text-lg text-slate-800 mb-2">Confirmer la désactivation</h3>
              <p className="text-sm text-slate-600">
                Êtes-vous sûr de vouloir désactiver <span className="font-semibold">{nurseForm.firstName} {nurseForm.lastName}</span> ? Ce membre n'apparaîtra plus dans les listes actives mais ses données seront conservées.
              </p>
            </div>
            <div className="flex border-t border-slate-200">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); deactivateNurse(selectedNurseId); }}
                className="flex-1 px-4 py-3 text-sm font-medium text-amber-600 hover:bg-amber-50 transition-colors border-l border-slate-200"
              >
                Désactiver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
