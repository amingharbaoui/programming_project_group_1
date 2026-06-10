import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: {
    "x-user-id": "1"
  }
});

export async function apiRequest(method, url, data = null) {
  const res = await api({ method, url, data });
  return res.data;
}

export default api;