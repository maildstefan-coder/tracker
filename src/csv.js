import { pad2, plainValue } from './format.js';

const quote = (v) => {
  const s = String(v ?? '');
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Semicolon separated, UTF-8 with BOM: opens directly in Excel (CH/DE). Oldest entry first. */
export function buildCsv({ fields, entries, authorOf }) {
  const head = ['Datum', 'Zeit'];
  if (authorOf) head.push('Von');
  fields.forEach((f) => head.push(f.unit && f.type !== 'boolean' ? `${f.name} (${f.unit})` : f.name));
  const lines = [head.map(quote).join(';')];
  [...entries].reverse().forEach((e) => {
    const d = new Date(e.recorded_at);
    const row = [`${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`, `${pad2(d.getHours())}:${pad2(d.getMinutes())}`];
    if (authorOf) row.push(authorOf(e.created_by));
    fields.forEach((f) => row.push(plainValue(f, (e.values || {})[f.id])));
    lines.push(row.map(quote).join(';'));
  });
  return '\ufeff' + lines.join('\r\n') + '\r\n';
}

export function downloadText(filename, text, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'logbuch';
