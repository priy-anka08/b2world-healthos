import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("healthos_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A 401 anywhere means the token is dead — bounce to login rather than
// showing a confusing partial UI.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("healthos_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);
