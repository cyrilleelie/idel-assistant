import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, Info, XCircle } from 'lucide-react';

const DialogContext = createContext(null);

const VARIANTS = {
  confirm: {
    icon: AlertTriangle,
    iconClass: 'text-amber-500 bg-amber-50',
    confirmClass: 'bg-primary hover:bg-primary/90 text-white',
    confirmLabel: 'Confirmer',
    cancelLabel: 'Annuler',
  },
  danger: {
    icon: XCircle,
    iconClass: 'text-red-500 bg-red-50',
    confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
    confirmLabel: 'Confirmer',
    cancelLabel: 'Annuler',
  },
  info: {
    icon: Info,
    iconClass: 'text-primary bg-primary/10',
    confirmClass: 'bg-primary hover:bg-primary/90 text-white',
    confirmLabel: 'OK',
    cancelLabel: null,
  },
  error: {
    icon: XCircle,
    iconClass: 'text-red-500 bg-red-50',
    confirmClass: 'bg-slate-600 hover:bg-slate-700 text-white',
    confirmLabel: 'Fermer',
    cancelLabel: null,
  },
};

function DialogOverlay({ dialog, onResolve }) {
  const panelRef = useRef(null);
  const variant = VARIANTS[dialog.variant || 'confirm'];
  const Icon = variant.icon;

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onResolve(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onResolve]);

  // Focus trap
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-150"
        onClick={() => onResolve(false)}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-in zoom-in-95 fade-in duration-150 outline-none"
      >
        <div className="flex gap-4">
          <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${variant.iconClass}`}>
            <Icon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            {dialog.title && (
              <h3 className="text-sm font-semibold text-slate-800 mb-1">{dialog.title}</h3>
            )}
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{dialog.message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          {variant.cancelLabel && (
            <button
              type="button"
              onClick={() => onResolve(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              {dialog.cancelLabel || variant.cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => onResolve(true)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${variant.confirmClass}`}
          >
            {dialog.confirmLabel || variant.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DialogProvider({ children }) {
  const [queue, setQueue] = useState([]);

  const show = useCallback((options) => {
    return new Promise((resolve) => {
      const entry = typeof options === 'string'
        ? { message: options, variant: 'confirm', _resolve: resolve }
        : { ...options, _resolve: resolve };
      setQueue((prev) => [...prev, entry]);
    });
  }, []);

  const confirm = useCallback((message, options = {}) => {
    return show({ message, variant: 'confirm', ...options });
  }, [show]);

  const alert = useCallback((message, options = {}) => {
    const isError = options.variant === 'error' || options.error;
    return show({ message, variant: isError ? 'error' : 'info', ...options });
  }, [show]);

  const danger = useCallback((message, options = {}) => {
    return show({ message, variant: 'danger', ...options });
  }, [show]);

  const handleResolve = useCallback((result) => {
    setQueue((prev) => {
      if (prev.length === 0) return prev;
      const [current, ...rest] = prev;
      current._resolve(result);
      return rest;
    });
  }, []);

  const current = queue[0] || null;

  return (
    <DialogContext.Provider value={{ confirm, alert, danger }}>
      {children}
      {current && <DialogOverlay dialog={current} onResolve={handleResolve} />}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within DialogProvider');
  return ctx;
}
