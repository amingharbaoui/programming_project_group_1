import axios from "axios";
let currentApiUserId = "1";

const api = axios.create({
  baseURL: "/api",
  headers: {
    "x-user-id": currentApiUserId
  }
});


export function setApiUserId(userId) {
  currentApiUserId = String(userId);
  api.defaults.headers.common["x-user-id"] = currentApiUserId;
  api.defaults.headers["x-user-id"] = currentApiUserId;

  api.interceptors.request.use((config) => {
    config.headers = config.headers || {};
    config.headers["x-user-id"] = currentApiUserId;
    return config;
  })
}

export async function apiRequest(method, url, data = null) {
  const res = await api({ method, url, data });
  return res.data;
}

export default api;
