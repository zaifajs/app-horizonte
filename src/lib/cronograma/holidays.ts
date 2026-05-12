// Thin wrapper over `date-holidays` so the rest of the app uses one helper.
//
// PT = national Portuguese calendar. Regional holidays (e.g. municipal feriado
// of Porto on 24 June) aren't included by default — date-holidays exposes them
// via a state/region argument if we ever need that.

import Holidays from "date-holidays";

const PT = new Holidays("PT");

export type HolidayHit = {
  name: string;
  type: string;
};

export function holidayOn(date: Date): HolidayHit | null {
  const res = PT.isHoliday(date);
  if (!res) return null;
  // `isHoliday` may return false or an array; pick the first match.
  const first = Array.isArray(res) ? res[0] : res;
  return first ? { name: first.name, type: first.type } : null;
}

export function isPortugueseHoliday(date: Date): boolean {
  return Boolean(PT.isHoliday(date));
}

/** Returns all weekday holidays falling between two dates inclusive. */
export function weekdayHolidaysBetween(start: Date, end: Date): Array<{ date: Date; name: string }> {
  const out: Array<{ date: Date; name: string }> = [];
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cur <= last) {
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) {
      const h = holidayOn(cur);
      if (h) out.push({ date: new Date(cur), name: h.name });
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}
