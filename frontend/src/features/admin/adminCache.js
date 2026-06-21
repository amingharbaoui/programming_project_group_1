// Cache uitgeschakeld als functionele bron van waarheid (auditpunt 270): paginas halen altijd live
// uit de backend. cacheSet/cacheDelete blijven bestaan zodat bestaande aanroepen blijven werken.
export function cacheGet() {
  return null;
}

export function cacheSet(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch { /* genegeerd */ }
}

export function cacheDelete(...keys) {
  keys.forEach((k) => { try { localStorage.removeItem(k); } catch { /* genegeerd */ } });
}

export function cacheClearAdmin() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith("admin_"))
    .forEach((k) => localStorage.removeItem(k));
}
