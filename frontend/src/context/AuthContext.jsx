import { createContext, useContext, useState, useEffect } from "react";
import { setAuthToken, apiRequest } from "../services/api";

const AuthContext = createContext(null);
const USER_KEY = "stagify_user";

function loadStoredUser() {
  try {
    const raw = typeof localStorage !== "undefined" && localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Verwijder alle rol-gebonden caches zodat data van de vorige gebruiker niet blijft hangen.
function clearRoleCaches() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (/^(admin|committee|mentor|student|docent)_|^logboek_draft_/.test(key)) localStorage.removeItem(key);
    }
  } catch { /* ignore */ }
}

export function AuthProvider({ children }) {
  // Geen auto-login meer: bij het opstarten enkel ingelogd als er een opgeslagen sessie is.
  const [user, setUser] = useState(loadStoredUser());

  // Bij app-start het opgeslagen token tegen de backend verifiëren (auditpunt 303/311):
  // - een verlopen/ongeldig token wordt meteen opgeruimd door de api-interceptor (logout + /login),
  //   i.p.v. een stale UI te tonen tot de eerste beveiligde call faalt;
  // - een door admin gewijzigde rol/naam (of deactivatie) wordt na een refresh opgepikt.
  useEffect(() => {
    if (!loadStoredUser()) return; // geen sessie om te verifiëren
    let actief = true;
    apiRequest("GET", "/auth/me")
      .then((res) => {
        const verse = res?.data;
        if (!actief || !verse) return;
        const next = {
          id: verse.id,
          name: `${verse.voornaam || ""} ${verse.achternaam || ""}`.trim(),
          role: verse.hoofdrol,
        };
        try { localStorage.setItem(USER_KEY, JSON.stringify(next)); } catch { /* ignore */ }
        setUser(next);
      })
      .catch(() => { /* 401 → de api-interceptor wist de sessie en navigeert naar /login */ });
    return () => { actief = false; };
  }, []);

  function loginUser(apiUser) {
    clearRoleCaches();
    if (apiUser?.token) setAuthToken(apiUser.token);
    const next = {
      id: apiUser.id,
      name: `${apiUser.voornaam || ""} ${apiUser.achternaam || ""}`.trim(),
      role: apiUser.hoofdrol,
    };
    try { localStorage.setItem(USER_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setUser(next);
  }

  function logout() {
    setAuthToken(null);
    clearRoleCaches();
    try { localStorage.removeItem(USER_KEY); } catch { /* ignore */ }
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loginUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
