import { Building2, MapPin, CreditCard, UserCircle, Mail, Phone, BadgeCheck, Hash } from 'lucide-react';

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

const roleLabels = {
  admin: 'Administrateur',
  member: 'Collaborateur',
  replacement: 'Remplaçant(e)',
};

const roleBadgeColors = {
  admin: 'bg-purple-100 text-purple-700',
  member: 'bg-blue-100 text-blue-700',
  replacement: 'bg-amber-100 text-amber-700',
};

export default function InfoBanner({ cabinet, user }) {
  if (!cabinet && !user) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-screen-md mx-auto mb-6">

      {/* Cabinet card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <Building2 size={16} className="text-blue-600" />
          </div>
          <h3 className="font-semibold text-slate-800">
            {cabinet?.name || 'Cabinet'}
          </h3>
        </div>
        <div className="space-y-1.5 text-sm">
          {cabinet?.address && (
            <div className="flex items-center gap-2 text-slate-600">
              <MapPin size={14} className="text-slate-400 shrink-0" />
              <span className="truncate">{cabinet.address}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <CreditCard size={14} className="text-slate-400 shrink-0" />
            <span className="text-slate-600">
              Plan {planLabels[cabinet?.plan] || cabinet?.plan || '—'}
            </span>
            {cabinet?.subscription_status && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[cabinet.subscription_status] || 'bg-slate-100 text-slate-600'}`}>
                {statusLabels[cabinet.subscription_status] || cabinet.subscription_status}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* User card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <UserCircle size={16} className="text-slate-600" />
          </div>
          <h3 className="font-semibold text-slate-800">
            {user ? `${user.first_name} ${user.last_name}` : 'Utilisateur'}
          </h3>
          {user?.role && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleBadgeColors[user.role] || 'bg-slate-100 text-slate-600'}`}>
              {roleLabels[user.role] || user.role}
            </span>
          )}
        </div>
        <div className="space-y-1.5 text-sm">
          {user?.email && (
            <div className="flex items-center gap-2 text-slate-600">
              <Mail size={14} className="text-slate-400 shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            {user?.phone && (
              <div className="flex items-center gap-2 text-slate-600">
                <Phone size={14} className="text-slate-400 shrink-0" />
                <span>{user.phone}</span>
              </div>
            )}
            {user?.rpps && (
              <div className="flex items-center gap-2 text-slate-600">
                <BadgeCheck size={14} className="text-slate-400 shrink-0" />
                <span>RPPS {user.rpps}</span>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
