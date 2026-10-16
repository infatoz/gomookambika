import { useState, useEffect } from 'react';
import { toast, ToastItem } from '@/lib/toast';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toast.subscribe(updated => {
      setToasts(updated);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 left-3 right-3 sm:left-auto sm:right-4 sm:w-96 z-50 pointer-events-none flex flex-col gap-2.5 select-none"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map(t => {
        const isSuccess = t.type === 'success';
        const isError = t.type === 'error';
        const isWarning = t.type === 'warning';
        const isInfo = t.type === 'info';

        return (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-2xl p-3.5 backdrop-blur-xl border flex items-start gap-3 transition-all duration-300 animate-in slide-in-from-top-3 ${
              isSuccess
                ? 'bg-neutral-900/95 border-emerald-500/40 shadow-[0_10px_30px_rgba(16,185,129,0.18)]'
                : isError
                ? 'bg-neutral-900/95 border-rose-500/40 shadow-[0_10px_30px_rgba(244,63,94,0.18)]'
                : isWarning
                ? 'bg-neutral-900/95 border-amber-500/40 shadow-[0_10px_30px_rgba(245,158,11,0.18)]'
                : 'bg-neutral-900/95 border-sky-500/40 shadow-[0_10px_30px_rgba(14,165,233,0.18)]'
            }`}
          >
            {/* Icon */}
            <div className="shrink-0 mt-0.5">
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400 stroke-[2.2]" />}
              {isError && <AlertCircle className="w-5 h-5 text-rose-400 stroke-[2.2]" />}
              {isWarning && <AlertTriangle className="w-5 h-5 text-amber-400 stroke-[2.2]" />}
              {isInfo && <Info className="w-5 h-5 text-sky-400 stroke-[2.2]" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pr-1">
              <div
                className={`text-xs sm:text-sm font-extrabold tracking-tight leading-snug ${
                  isSuccess
                    ? 'text-emerald-100'
                    : isError
                    ? 'text-rose-100'
                    : isWarning
                    ? 'text-amber-100'
                    : 'text-sky-100'
                }`}
              >
                {t.title}
              </div>
              {t.description && (
                <p className="text-[11px] sm:text-xs text-neutral-400 mt-0.5 leading-relaxed">
                  {t.description}
                </p>
              )}
            </div>

            {/* Dismiss Button */}
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="w-6 h-6 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 flex items-center justify-center shrink-0 transition-colors active:scale-90"
              aria-label="Dismiss alert"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
