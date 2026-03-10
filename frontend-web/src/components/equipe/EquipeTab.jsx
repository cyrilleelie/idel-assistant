import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, Search, Edit, ToggleLeft, ToggleRight, Phone, Mail,
  UserCircle, AlertTriangle, X, UserMinus, ChevronLeft, ChevronRight
} from 'lucide-react';
import NurseDetail from './NurseDetail';

const statusFilters = [
  { id: 'all', label: 'Tous' },
  { id: 'active', label: 'Actifs' },
  { id: 'inactive', label: 'Inactifs' },
];

const PAGE_SIZE = 12;

function getInitials(firstName, lastName) {
  return `${(firstName || '?').charAt(0)}${(lastName || '?').charAt(0)}`.toUpperCase();
}

export default function EquipeTab({
  nurses, nurseForm, setNurseForm,
  selectedNurseId, isEditingNurse, setIsEditingNurse,
  openNurseDetail, openNewNurse, closeNurseDetail,
  handleSaveNurse, deactivateNurse, reactivateNurse,
  readOnly = false,
}) {
  const [statusFilter, setStatusFilter] = useState('active');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null); // nurseId or null

  const isDrawerOpen = !!selectedNurseId;

  const filteredNurses = nurses.filter(n => {
    if (statusFilter === 'active' && n.active === false) return false;
    if (statusFilter === 'inactive' && n.active !== false) return false;
    if (search) {
      const q = search.toLowerCase();
      return `${n.firstName} ${n.lastName}`.toLowerCase().includes(q) ||
        (n.email || '').toLowerCase().includes(q) ||
        (n.phone || '').includes(q);
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredNurses.length / PAGE_SIZE));

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const safePage = Math.min(page, totalPages);
  if (safePage !== page) setPage(safePage);

  const start = (safePage - 1) * PAGE_SIZE;
  const paginatedNurses = filteredNurses.slice(start, start + PAGE_SIZE);

  // Close drawer on Escape
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && isDrawerOpen) closeNurseDetail();
  }, [isDrawerOpen, closeNurseDetail]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const selectedNurse = selectedNurseId && selectedNurseId !== 'new'
    ? nurses.find(n => n.id === selectedNurseId)
    : null;

  const handleDeactivateClick = (e, nurse) => {
    e.stopPropagation();
    if (nurse.active === false) {
      reactivateNurse(nurse.id);
      return;
    }
    setShowDeleteConfirm(nurse.id);
  };

  const confirmDeactivate = () => {
    if (showDeleteConfirm) {
      deactivateNurse(showDeleteConfirm);
      setShowDeleteConfirm(null);
    }
  };

  const nurseToDeactivate = showDeleteConfirm ? nurses.find(n => n.id === showDeleteConfirm) : null;

  return (
    <div className="relative">
      {/* List area (shrinks when drawer open) */}
      <div className={`transition-all duration-300 ${isDrawerOpen ? 'lg:mr-[540px]' : ''}`}>
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Header */}
          <div className="flex justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Gestion de l&apos;equipe</h1>
              <p className="text-slate-500 text-sm">Gerez les membres de votre cabinet et leurs acces</p>
            </div>
            {!readOnly && (
              <button
                onClick={openNewNurse}
                className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-primary/90 shadow-lg shadow-primary/20 transition-colors whitespace-nowrap"
              >
                <UserPlus size={18} /> Ajouter un membre
              </button>
            )}
          </div>

          {/* Filters bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Rechercher un membre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-colors"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {statusFilters.map(f => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-full transition-colors ${
                    statusFilter === f.id
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Membre</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden xl:table-cell">Telephone</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedNurses.map(nurse => {
                  const isSelected = selectedNurseId === nurse.id;
                  const isInactive = nurse.active === false;
                  return (
                    <tr
                      key={nurse.id}
                      onClick={() => openNurseDetail(nurse)}
                      className={`
                        hover:bg-primary/5 transition-colors cursor-pointer
                        ${isSelected ? 'bg-primary/5 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}
                        ${isInactive ? 'opacity-60' : ''}
                      `}
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                            nurse.color || (isInactive ? 'bg-slate-200 text-slate-500' : 'bg-primary/10 text-primary')
                          }`}>
                            {getInitials(nurse.firstName, nurse.lastName)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 uppercase text-sm truncate">
                                {nurse.lastName}
                              </span>
                              <span className="text-sm text-slate-700 capitalize truncate">
                                {nurse.firstName}
                              </span>
                              {isInactive && (
                                <span className="shrink-0 text-[10px] uppercase font-bold tracking-wider bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">
                                  Inactif
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                          {nurse.role || 'Membre'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-sm text-slate-600 truncate block max-w-[200px]">
                          {nurse.email || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <span className="text-sm text-slate-600">{nurse.phone || '-'}</span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); openNurseDetail(nurse); setIsEditingNurse(true); }}
                            className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                            title="Modifier"
                          >
                            <Edit size={15} />
                          </button>
                          {!readOnly && (
                            <button
                              onClick={(e) => handleDeactivateClick(e, nurse)}
                              className={`p-1.5 rounded-md transition-colors ${
                                isInactive
                                  ? 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                                  : 'text-emerald-500 hover:text-amber-600 hover:bg-amber-50'
                              }`}
                              title={isInactive ? 'Reactiver' : 'Desactiver'}
                            >
                              {isInactive ? <ToggleLeft size={15} /> : <ToggleRight size={15} />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Empty state */}
            {filteredNurses.length === 0 && (
              <div className="text-center py-16 text-slate-500 bg-slate-50">
                <p className="text-sm">
                  {statusFilter === 'inactive'
                    ? 'Aucun membre inactif.'
                    : statusFilter === 'active'
                      ? 'Aucun membre actif.'
                      : 'Aucun membre ne correspond a votre recherche.'
                  }
                </p>
              </div>
            )}

            {/* Pagination footer */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-slate-50 flex items-center justify-between border-t border-slate-200">
                <span className="text-xs text-slate-500">
                  Affichage de {start + 1}-{Math.min(start + PAGE_SIZE, filteredNurses.length)} sur {filteredNurses.length} membres
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="p-1.5 rounded-md text-slate-500 hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`min-w-[32px] h-8 rounded-md text-sm font-medium transition-colors ${
                        n === safePage
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-slate-600 border border-slate-200 hover:bg-white'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="p-1.5 rounded-md text-slate-500 hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Backdrop overlay on small screens */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 top-16 bg-black/20 z-30 lg:hidden"
          onClick={closeNurseDetail}
        />
      )}

      {/* Right: Detail drawer (below header) */}
      <div
        className={`
          fixed top-16 right-0 h-[calc(100vh-4rem)] z-40
          w-full sm:w-[540px] lg:w-[540px]
          bg-white border-l border-slate-200 shadow-2xl
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {isDrawerOpen && (
          <>
            {/* Drawer header */}
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${
                    nurseForm.color || 'bg-primary/10 text-primary'
                  }`}>
                    {getInitials(nurseForm.firstName, nurseForm.lastName)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-slate-900 uppercase truncate">
                      {nurseForm.lastName || 'Nouveau'}{' '}
                      <span className="capitalize font-medium">{nurseForm.firstName || 'membre'}</span>
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm text-slate-500">{nurseForm.role || 'Membre'}</span>
                      <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded ${
                        nurseForm.active === false
                          ? 'bg-slate-200 text-slate-600'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {nurseForm.active === false ? 'Inactif' : 'Actif'}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={closeNurseDetail}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Drawer action bar */}
            <div className="px-4 py-2 border-b border-slate-100 bg-white flex items-center justify-end gap-2">
              {!readOnly && !isEditingNurse ? (
                <>
                  {nurseForm.active === false ? (
                    <button onClick={() => reactivateNurse(selectedNurseId)} className="text-emerald-600 hover:bg-emerald-50 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5">
                      <UserPlus size={14}/> Reactiver
                    </button>
                  ) : (
                    <button onClick={() => setShowDeleteConfirm(selectedNurseId)} className="text-amber-600 hover:bg-amber-50 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5">
                      <UserMinus size={14}/> Desactiver
                    </button>
                  )}
                  <button onClick={() => setIsEditingNurse(true)} className="bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5">
                    <Edit size={14}/> Modifier
                  </button>
                </>
              ) : isEditingNurse ? (
                <>
                  <button onClick={() => selectedNurseId === 'new' ? closeNurseDetail() : setIsEditingNurse(false)} className="text-slate-600 hover:bg-slate-100 px-3 py-1 rounded-lg text-xs font-medium transition-colors">
                    Annuler
                  </button>
                  <button onClick={handleSaveNurse} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-xs font-semibold transition-colors shadow-sm">
                    Enregistrer
                  </button>
                </>
              ) : null}
            </div>

            {/* Drawer content */}
            <div className="flex-1 overflow-y-auto p-6">
              <NurseDrawerContent
                nurseForm={nurseForm}
                setNurseForm={setNurseForm}
                isEditingNurse={isEditingNurse}
              />
            </div>
          </>
        )}
      </div>

      {/* Deactivation confirmation modal */}
      {showDeleteConfirm && nurseToDeactivate && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                <AlertTriangle size={24} className="text-amber-600" />
              </div>
              <h3 className="font-semibold text-lg text-slate-800 mb-2">Confirmer la desactivation</h3>
              <p className="text-sm text-slate-600">
                Etes-vous sur de vouloir desactiver <span className="font-semibold">{nurseToDeactivate.firstName} {nurseToDeactivate.lastName}</span> ? Ce membre n&apos;apparaitra plus dans les listes actives mais ses donnees seront conservees.
              </p>
            </div>
            <div className="flex border-t border-slate-200">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmDeactivate}
                className="flex-1 px-4 py-3 text-sm font-medium text-amber-600 hover:bg-amber-50 transition-colors border-l border-slate-200"
              >
                Desactiver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline drawer content — form fields for nurse detail
const availableColors = [
  { label: 'Bleu', value: 'bg-blue-100 text-blue-800 border-blue-200' },
  { label: 'Vert', value: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { label: 'Violet', value: 'bg-purple-100 text-purple-800 border-purple-200' },
  { label: 'Rose', value: 'bg-pink-100 text-pink-800 border-pink-200' },
  { label: 'Orange', value: 'bg-orange-100 text-orange-800 border-orange-200' },
  { label: 'Cyan', value: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
];

function NurseDrawerContent({ nurseForm, setNurseForm, isEditingNurse }) {
  return (
    <div className="space-y-6">
      {/* Identity & Role */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">Identite & Role</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Nom *</label>
            {isEditingNurse ? (
              <input autoFocus type="text" value={nurseForm.lastName} onChange={e => setNurseForm({ ...nurseForm, lastName: e.target.value.toUpperCase() })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none uppercase" placeholder="DUPONT" required />
            ) : (
              <div className="text-sm font-medium uppercase">{nurseForm.lastName || '-'}</div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Prenom *</label>
            {isEditingNurse ? (
              <input type="text" value={nurseForm.firstName} onChange={e => setNurseForm({ ...nurseForm, firstName: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none capitalize" placeholder="Alice" required />
            ) : (
              <div className="text-sm font-medium capitalize">{nurseForm.firstName || '-'}</div>
            )}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
          {isEditingNurse ? (
            <select value={nurseForm.role} onChange={e => setNurseForm({ ...nurseForm, role: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none bg-white">
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
                    className={`w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center ${c.value.split(' ')[0]} ${isSelected ? 'ring-2 ring-offset-2 ring-primary border-primary' : 'border-slate-200 hover:scale-110'}`}
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
              <span className="text-sm text-slate-600">{availableColors.find(c => c.value === nurseForm.color)?.label || 'Non definie'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Contact */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">Contact</h3>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Telephone</label>
          {isEditingNurse ? (
            <input type="tel" value={nurseForm.phone} onChange={e => setNurseForm({ ...nurseForm, phone: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none" placeholder="06 12 34 56 78" />
          ) : (
            <div className="text-sm text-slate-700 flex items-center gap-2">
              <Phone size={16} className="text-slate-400" /> {nurseForm.phone || '-'}
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
          {isEditingNurse ? (
            <input type="email" value={nurseForm.email} onChange={e => setNurseForm({ ...nurseForm, email: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none" placeholder="alice@cabinet.fr" />
          ) : (
            <div className="text-sm text-slate-700 flex items-center gap-2">
              <Mail size={16} className="text-slate-400" /> {nurseForm.email || '-'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
