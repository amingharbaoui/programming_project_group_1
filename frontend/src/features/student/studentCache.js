// Cache volledig uitgeschakeld als bron van waarheid (auditpunt 270): pagina's halen altijd live uit
// de backend. cacheGet geeft null en cacheSet schrijft niets meer weg — het ruimt enkel een eventuele
// oude waarde op, zodat localStorage nooit met verouderde rol-data vol komt te staan.
export function cacheGet() {
  return null;
}

export function cacheSet(key) {
  try { localStorage.removeItem(key); } catch {}
}

export function cacheDelete(...keys) {
  keys.forEach((k) => { try { localStorage.removeItem(k); } catch {} });
}

export function cacheClearStudent() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith("student_"))
    .forEach((k) => localStorage.removeItem(k));
}
