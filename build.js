// Simple build script for Netlify
// This injects the API base URL from environment variable into index.html
const fs = require('fs');
const path = require('path');

const apiBase = process.env.NETLIFY_API_BASE || process.env.API_BASE || 'http://localhost:4000';
const indexPath = path.join(__dirname, 'index.html');

let html = fs.readFileSync(indexPath, 'utf8');

// Inject the API base URL script before config.js
const scriptTag = `    <script>
      window.NETLIFY_API_BASE = "${apiBase}";
    </script>
    <script src="./config.js"></script>`;

// Replace the config.js script tag with our injected version
html = html.replace(
  '<script src="./config.js"></script>',
  scriptTag
);

fs.writeFileSync(indexPath, html);
console.log(`✓ Injected API_BASE: ${apiBase}`);


