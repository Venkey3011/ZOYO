import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const colors = {
  success: 'bg-emerald-600 border border-emerald-400/40 text-white',
  error: 'bg-rose-600 border border-rose-400/40 text-white',
  info: 'bg-sky-600 border border-sky-400/40 text-white',
  warning: 'bg-amber-600 border border-amber-400/40 text-white',
};

export function ToastContainer({ toasts, onRemove }: ToastProps) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[999999] flex flex-col gap-2 w-[90vw] max-w-sm pointer-events-none">
      {toasts.map((item) => {
        const Icon = icons[item.type];
        return (
          <div
            key={item.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold shadow-2xl pointer-events-auto backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-3 ${colors[item.type]}`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1 leading-snug">{item.message}</span>
            <button
              onClick={() => onRemove(item.id)}
              className="shrink-0 p-1 opacity-70 hover:opacity-100 rounded-full transition-opacity cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// Global singleton hook & dispatch
let _toastSetter: ((fn: (prev: ToastMessage[]) => ToastMessage[]) => void) | null = null;

export function useToastSetup() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    _toastSetter = setToasts;
    return () => {
      _toastSetter = null;
    };
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, removeToast };
}

export function toast(message: string, type: ToastType = 'info', duration = 3000) {
  if (!_toastSetter) return;
  const id = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  _toastSetter((prev) => [...prev.slice(-4), { id, type, message, duration }]);
  setTimeout(() => {
    _toastSetter?.((prev) => prev.filter((t) => t.id !== id));
  }, duration);
}
