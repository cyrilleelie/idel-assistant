import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

export function formatDate(isoDate: string): string {
  return format(parseISO(isoDate), "dd MMMM yyyy", { locale: fr });
}

export function formatDateShort(isoDate: string): string {
  return format(parseISO(isoDate), "dd/MM/yyyy", { locale: fr });
}

export function formatTime(timeOrIso: string): string {
  if (timeOrIso.includes("T")) {
    return format(parseISO(timeOrIso), "HH:mm");
  }
  return timeOrIso.substring(0, 5);
}

export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
}
