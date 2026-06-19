const TTL_MS = 5 * 60 * 1000; // 5 minuten

export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > TTL_MS) { localStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}

export function cacheSet(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

export function cacheDelete(...keys) {
  keys.forEach((k) => { try { localStorage.removeItem(k); } catch {} });
}

export function cacheClearCommittee() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith("committee_"))
    .forEach((k) => localStorage.removeItem(k));
}
