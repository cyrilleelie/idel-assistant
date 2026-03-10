// --- Color mapping: backend hex ↔ frontend Tailwind CSS classes ---

const colorMap = [
  { hex: '#3B82F6', css: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Bleu' },
  { hex: '#10B981', css: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Vert' },
  { hex: '#8B5CF6', css: 'bg-purple-100 text-purple-800 border-purple-200', label: 'Violet' },
  { hex: '#EC4899', css: 'bg-pink-100 text-pink-800 border-pink-200', label: 'Rose' },
  { hex: '#F97316', css: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Orange' },
  { hex: '#06B6D4', css: 'bg-cyan-100 text-cyan-800 border-cyan-200', label: 'Cyan' },
];

function hexToCss(hex) {
  const match = colorMap.find((c) => c.hex.toLowerCase() === hex?.toLowerCase());
  return match ? match.css : colorMap[0].css;
}

function cssToHex(css) {
  const match = colorMap.find((c) => c.css === css);
  return match ? match.hex : colorMap[0].hex;
}

// --- Role mapping: backend EN ↔ frontend FR ---

const roleMapToFr = {
  admin: 'Titulaire',
  member: 'Collaborateur',
  replacement: 'Remplaçant(e)',
};

const roleMapToEn = {
  'Titulaire': 'admin',
  'Collaborateur': 'member',
  'Remplaçant(e)': 'replacement',
};

// --- Conversion functions ---

export function apiToFrontend(member) {
  return {
    id: member.id,               // cabinet_member PK (for PATCH/delete member)
    userId: member.user_id,      // user PK (for schedule, appointments, etc.)
    firstName: member.first_name || '',
    lastName: member.last_name || '',
    role: roleMapToFr[member.role] || member.role,
    phone: member.phone || '',
    email: member.email || '',
    color: hexToCss(member.color),
    active: member.is_active,
    // Keep raw API fields for PATCH calls
    _apiRole: member.role,
    _apiColor: member.color,
  };
}

export function frontendToApiUpdate(nurseForm) {
  return {
    role: roleMapToEn[nurseForm.role] || nurseForm._apiRole || 'member',
    color: cssToHex(nurseForm.color),
    is_active: nurseForm.active !== false,
  };
}

export function frontendToApiInvite(nurseForm) {
  return {
    email: nurseForm.email,
    role: roleMapToEn[nurseForm.role] || 'member',
    color: cssToHex(nurseForm.color),
  };
}

export { colorMap, cssToHex, hexToCss };
