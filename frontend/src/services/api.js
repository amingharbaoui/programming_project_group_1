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

export function setAuthToken(token) {
  authToken = token || null;
  if (typeof localStorage !== "undefined") {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }
}

// Behouden voor compatibiliteit (oude demo-switcher); doet niets meer in de echte auth.
export function setApiUserId() {}

export async function apiRequest(method, url, data = null) {
  const res = await api({ method, url, data });
  return res.data;
}

export default api;
