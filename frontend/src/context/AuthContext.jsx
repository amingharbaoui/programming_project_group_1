import { createContext, useContext, useState } from "react";
import { setAuthToken } from "../services/api";

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
      if (/^(admin|committee|mentor|student|docent)_/.test(key)) localStorage.removeItem(key);
    }
  } catch { /* ignore */ }
}

export function AuthProvider({ children }) {
  // Geen auto-login meer: bij het opstarten enkel ingelogd als er een opgeslagen sessie is.
  const [user, setUser] = useState(loadStoredUser());

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
