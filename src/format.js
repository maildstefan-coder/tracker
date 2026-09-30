export const TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Zahl' },
  { value: 'duration', label: 'Dauer' },
  { value: 'choice', label: 'Auswahl' },
  { value: 'boolean', label: 'Ja / Nein' },
];
export const typeLabel = (v) => (TYPES.find((t) => t.value === v) || TYPES[0]).label;

export const ROLES = { owner: 'Besitzer', editor: 'Kann erfassen', viewer: 'Nur lesen' };

export const pad2 = (n) => String(n).padStart(2, '0');

export function localDateIso(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 30.09.26 13:52 (always 24 h) */
export function fmtShort(iso) {
  const d = new Date(iso);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function fmtLongDate(d) {
  return d.toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export const isNumeric = (field) => field.type === 'number' || field.type === 'duration';

/** Raw input string -> value to store. Returns undefined for empty, throws for invalid numbers. */
export function parseInput(field, raw) {
  const s = String(raw ?? '').trim();
  if (s === '') return undefined;
  if (isNumeric(field)) {
    const n = Number(s.replace(',', '.'));
    if (!Number.isFinite(n)) throw new Error(`„${field.name}“ braucht eine Zahl.`);
    return n;
  }
  if (field.type === 'boolean') return s === 'ja';
  return s;
}

/** Stored value -> text without unit ('' if empty). */
export function plainValue(field, v) {
  if (v === undefined || v === null || v === '') return '';
  if (field.type === 'boolean') return v ? 'Ja' : 'Nein';
  return String(v);
}

/** Stored value -> text with unit, for the history table. */
export function cellValue(field, v) {
  const p = plainValue(field, v);
  if (!p) return '–';
  return field.unit && field.type !== 'boolean' ? `${p} ${field.unit}` : p;
}
