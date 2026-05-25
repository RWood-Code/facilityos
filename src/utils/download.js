export function downloadCsv({ csv, filename }) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'export.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const vals = line.match(/("([^"]|"")*"|[^,]*)/g) || [];
    const row = {};
    headers.forEach((h, i) => {
      let v = (vals[i] || '').trim();
      if (v.startsWith('"')) v = v.slice(1, -1).replace(/""/g, '"');
      row[h] = v;
    });
    return row;
  });
}
