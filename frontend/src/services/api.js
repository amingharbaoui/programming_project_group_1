import axios from "axios";
let currentApiUserId = "1";

const api = axios.create({
  baseURL: "/api",
});

// Één interceptor die altijd de actuele user id meestuurt
api.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  config.headers["x-user-id"] = currentApiUserId;
  return config;
});

export function setApiUserId(userId) {
  currentApiUserId = String(userId);
}

export async function apiRequest(method, url, data = null) {
  const res = await api({ method, url, data });
  return res.data;
}

export default api;
