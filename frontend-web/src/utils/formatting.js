/**
 * Formate un nombre en euros (ex: 1234.5 -> "1 234,50 EUR")
 */
export function formatCurrency(value) {
  return Number(value ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

/**
 * Formate un nombre avec 2 decimales (ex: 1234.5 -> "1234.50")
 */
export function formatAmount(value) {
  return Number(value ?? 0).toFixed(2);
}

/**
 * Formate un mois YYYY-MM en texte francais (ex: "2026-03" -> "mars 2026")
 */
export function formatMonth(ym) {
  const [y, m] = ym.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/**
 * Formate une date ISO en format francais court (ex: "2026-03-10" -> "10/03/2026")
 */
export function formatDateFR(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  return d.toLocaleDateString('fr-FR');
}

/**
 * Formate une date ISO en format long (ex: "lundi 10 mars 2026")
 */
export function formatDateLong(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Formate une date en YYYY-MM-DD
 */
export function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
