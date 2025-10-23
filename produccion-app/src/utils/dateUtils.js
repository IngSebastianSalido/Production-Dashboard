// Small date utilities to parse YYYY-MM-DD safely across environments
export function parseYYYYMMDD(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  // Accept formats like 'YYYY-MM-DD' or 'YYYY/MM/DD'
  const parts = dateStr.trim().split(/[-\/]/);
  if (parts.length < 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;
  // Create a local Date at midnight (local timezone) to avoid cross-browser parsing differences
  return new Date(year, month - 1, day);
}

export function startOfDay(dateStr) {
  const d = parseYYYYMMDD(dateStr);
  if (!d) return null;
  d.setHours(0,0,0,0);
  return d;
}

export function endOfDay(dateStr) {
  const d = parseYYYYMMDD(dateStr);
  if (!d) return null;
  d.setHours(23,59,59,999);
  return d;
}

export function formatYYYYMMDD(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
