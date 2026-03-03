/**
 * Pure date/time helper functions for the IDEL mobile app.
 *
 * All functions operate on 'YYYY-MM-DD' date strings and 'HH:MM' time strings.
 * No external dependencies — only the JS standard library and Intl APIs.
 *
 * IMPORTANT: All functions that parse date strings interpret them as LOCAL time
 * (not UTC). This is achieved by appending 'T00:00:00' before passing to
 * new Date(), preventing the UTC-midnight-shift problem of Date.parse().
 */

const FRENCH_DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * Returns today's date as a 'YYYY-MM-DD' string in LOCAL time.
 *
 * Uses local year/month/day rather than toISOString() which returns UTC
 * and would give the wrong date for timezones behind UTC (e.g., Americas)
 * or shift midnight across a day boundary.
 */
export function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Adds (or subtracts) the given number of days to a 'YYYY-MM-DD' date string.
 * Parses the input as LOCAL midnight to avoid UTC-shift issues.
 *
 * @param dateStr - ISO date string 'YYYY-MM-DD'
 * @param days    - Number of days to add (negative to subtract)
 * @returns       - Resulting date as 'YYYY-MM-DD'
 */
export function addDays(dateStr: string, days: number): string {
  // Append time to force LOCAL timezone interpretation (not UTC)
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a 'YYYY-MM-DD' date string in long French format.
 *
 * @example formatDateFrench('2026-03-03') → 'mardi 3 mars 2026'
 */
export function formatDateFrench(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return FRENCH_DATE_FORMATTER.format(date);
}

/**
 * Returns a relative label if the date is today, yesterday, or tomorrow.
 * Returns null for all other dates.
 *
 * @example getRelativeDayLabel('2026-03-03') → 'Aujourd\'hui'
 * @example getRelativeDayLabel('2026-03-05') → null
 */
export function getRelativeDayLabel(dateStr: string): string | null {
  const today = getTodayString();
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);

  if (dateStr === today) return "Aujourd'hui";
  if (dateStr === yesterday) return 'Hier';
  if (dateStr === tomorrow) return 'Demain';
  return null;
}

/**
 * Returns true if the date is within the offline sync window:
 * [yesterday, today, tomorrow].
 *
 * This window matches the days pre-fetched by the sync engine for
 * offline use. Dates outside this range may not have local data.
 */
export function isWithinOfflineWindow(dateStr: string): boolean {
  const today = getTodayString();
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);
  return dateStr >= yesterday && dateStr <= tomorrow;
}

/**
 * Formats an 'HH:MM' time string in French notation ('HhMM').
 *
 * @example formatTime('09:30') → '09h30'
 * @example formatTime('14:00') → '14h00'
 */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  return `${hours}h${minutes}`;
}

/**
 * Formats a time range as 'HhMM — HhMM'.
 *
 * @example formatTimeRange('09:30', '10:00') → '09h30 — 10h00'
 */
export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} \u2014 ${formatTime(end)}`;
}
