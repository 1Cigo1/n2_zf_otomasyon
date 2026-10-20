export function parseKm(text) {
  const normalized = text.trim();
  if (!/^\d+(?:[.,\s]\d{3})*$/.test(normalized)) {
    throw new Error(`Araç kilometresi okunamadı: ${text}`);
  }
  return Number(normalized.replace(/[.,\s]/g, ''));
}

export function nextKm(current, previous = 0) {
  return Math.max(current, previous) + 10;
}

export function plateOf(option) {
  return option.split(' - ')[0].trim();
}

export function workflowURL(key) {
  return `/demand/list/${encodeURIComponent(key)}?${new URLSearchParams({ workflow_key: key, page: '1', rowsPerPage: '30' })}`;
}
