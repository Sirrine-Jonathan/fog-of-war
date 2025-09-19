// public/logger.js

// Checks if ?debug=true is present in the URL
function isDebugEnabled() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("debug") === "true";
}

// Logger function for client-side debug logging
function logger(message, ...args) {
  if (isDebugEnabled()) {
    // eslint-disable-next-line no-console
    console.log(`[DEBUG] ${message}`, ...args);
  }
}

// Attach logger to window for global access
window.logger = logger;
