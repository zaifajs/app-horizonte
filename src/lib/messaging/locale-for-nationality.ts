import type { Locale } from "@/i18n/routing";

/**
 * Maps a student's free-text nationality to a message locale.
 *   Bangladesh / Bengali  → bn
 *   India / Hindi         → hi
 *   Pakistan / Urdu       → ur
 *   everything else       → en
 *
 * Defensive matching: handles variants like "Bangladeshi", "BD", PT names.
 */
export function localeForNationality(nationality: string | null | undefined): Locale {
  if (!nationality) return "en";
  const n = nationality.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  if (/banglad|bengal|\bbd\b/.test(n)) return "bn";
  if (/pakist|urdu|\bpk\b/.test(n)) return "ur";
  if (/india|hindi|\bin\b/.test(n)) return "hi";

  return "en";
}
