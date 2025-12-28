// Override API_BASE at deploy time by defining window.NETLIFY_API_BASE in an inline script.
// For local development, backend should be running on http://localhost:4000
window.CONFIG = {
  API_BASE: window.NETLIFY_API_BASE || "http://localhost:4000"
};

