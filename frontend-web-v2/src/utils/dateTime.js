export const getDaysInMonth = (year, month) => {
  const date = new Date(year, month, 1);
  const days = [];
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
};

export const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDisplayDate = (date) => {
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
};

export const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

export const doSlotsOverlap = (start1, end1, start2, end2) => {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);

  const getIntervals = (start, end) => {
    if (start < end) return [[start, end]];
    if (start === end) return [];
    return [[start, 1440], [0, end]];
  };

  const int1 = getIntervals(s1, e1);
  const int2 = getIntervals(s2, e2);

  for (const [aStart, aEnd] of int1) {
    for (const [bStart, bEnd] of int2) {
      if (Math.max(aStart, bStart) < Math.min(aEnd, bEnd)) {
        return true;
      }
    }
  }
  return false;
};

export const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
};

export const getWeekDays = (referenceDate) => {
  const d = new Date(referenceDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // lundi
  const monday = new Date(d.getFullYear(), d.getMonth(), diff);
  const days = [];
  for (let i = 0; i < 7; i++) {
    days.push(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
  }
  return days;
};

export const isTimeWithinSlot = (start, end, boundStart, boundEnd) => {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  const bs = timeToMinutes(boundStart);
  const be = timeToMinutes(boundEnd);

  const isRdvOvernight = s >= e;
  const isSlotOvernight = bs >= be;

  if (!isSlotOvernight) {
    if (isRdvOvernight) return false;
    return s >= bs && e <= be;
  } else {
    if (isRdvOvernight) {
      return s >= bs && e <= be;
    } else {
      return (s >= bs && e > s) || (e <= be && e > s);
    }
  }
};
