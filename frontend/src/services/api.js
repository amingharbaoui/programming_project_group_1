import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: {
    "x-user-id": "1"
  }
});

export function setApiUserId(userId) {
  api.defaults.headers.common["x-user-id"] = String(userId);
}

export async function apiRequest(method, url, data = null) {
  const res = await api({ method, url, data });
  return res.data;
}

export default api;
