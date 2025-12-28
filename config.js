// config.js

// Use the deployed Render backend if available, otherwise fallback to localhost for local dev
window.CONFIG = {
  API_BASE: window.NETLIFY_API_BASE || "https://arrow-financial-api.onrender.com"
};
