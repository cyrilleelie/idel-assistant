/**
 * Frontend log capture — collect console.error calls and unhandled errors,
 * then batch-send them to the backend every 5 seconds.
 */
import { postFrontendLogs } from '../api/admin';

const _pending = [];
let _flushTimer = null;

function _stringify(...args) {
  return args
    .map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      if (typeof a === 'object' && a !== null) {
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      }
      return String(a);
    })
    .join(' ');
}

function _capture(level, logger, ...args) {
  _pending.push({
    timestamp: new Date().toISOString(),
    level,
    logger,
    message: _stringify(...args),
  });
  if (!_flushTimer) {
    _flushTimer = setTimeout(_flush, 5000);
  }
}

async function _flush() {
  _flushTimer = null;
  if (_pending.length === 0) return;
  const batch = _pending.splice(0);
  try {
    await postFrontendLogs(batch);
  } catch {
    // Ignore — logging failures must never crash the app
  }
}

let _installed = false;

export function installFrontendLogger() {
  if (_installed) return;
  _installed = true;

  // Override console.error
  const originalError = console.error;
  console.error = (...args) => {
    originalError(...args);
    _capture('ERROR', 'frontend.console', ...args);
  };

  // Unhandled JS errors
  window.addEventListener('error', (event) => {
    _capture('ERROR', 'frontend.unhandled', event.message || String(event));
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    _capture('ERROR', 'frontend.promise', String(event.reason));
  });
}

/** Manual log call from application code. */
export function logFrontend(level, logger, message) {
  _capture(level, logger, message);
}
