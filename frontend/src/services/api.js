import axios from "axios";

const TOKEN_KEY = "stagify_token";
let authToken = (typeof localStorage !== "undefined" && localStorage.getItem(TOKEN_KEY)) || null;

const api = axios.create({
  baseURL: "/api",
});

// Eén interceptor die het sessietoken meestuurt als Authorization: Bearer.
api.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  if (authToken) {
    config.headers["Authorization"] = `Bearer ${authToken}`;
  }
  return config;
});

// Verlopen of ongeldig token: sessie wissen en terug naar login i.p.v. losse 401-fouten tonen.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";
    // Achtergrond-polls (meldingen, sidebar-status) zetten skipAuthRedirect: een vluchtige 401 daar mag
    // de gebruiker NIET uitloggen (auditpunt 333). Alleen expliciete acties + de opstart-/auth/me-check
    // beëindigen de sessie. Zo wordt niemand zomaar uitgekickt door een achtergrondrequest.
    if (status === 401 && !error.config?.skipAuthRedirect && typeof window !== "undefined"
        && !url.includes("/auth/login")
        && !window.location.pathname.startsWith("/login")) {
      setAuthToken(null);
      try {
        localStorage.removeItem("stagify_user");
        // Ook alle rolgebonden caches wissen — anders kan na opnieuw inloggen (of snel van gebruiker
        // wisselen) oude localStorage-data van de vorige sessie blijven hangen.
        Object.keys(localStorage)
          .filter((k) => /^(admin|committee|mentor|student|docent)_/.test(k))
          .forEach((k) => localStorage.removeItem(k));
        sessionStorage.removeItem("mentor_dossier");
      } catch { /* ignore */ }
      window.location.assign("/login");
    }
    return Promise.reject(error);
  }
);

export function setAuthToken(token) {
  authToken = token || null;
  if (typeof localStorage !== "undefined") {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }
}

// Behouden voor compatibiliteit (oude demo-switcher); doet niets meer in de echte auth.
export function setApiUserId() {}

// URL om een geüpload bestand te bekijken/downloaden. Het sessietoken gaat als query (?t=) mee,
// omdat een <iframe>/<a> geen Authorization-header kan sturen; de backend valideert het token.
export function fileUrl(bestandUrl) {
  if (!bestandUrl) return "";
  const filename = String(bestandUrl).replace(/^\/uploads\//, "");
  const suffix = authToken ? `?t=${encodeURIComponent(authToken)}` : "";
  return `/api/documents/bestand/${filename}${suffix}`;
}

export async function apiRequest(method, url, data = null, config = {}) {
  const res = await api({ method, url, data, ...config });
  return res.data;
}

export default api;
