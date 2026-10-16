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
      className="fixed top-4 left-3 right-3 sm:left-auto sm:right-5 sm:w-96 z-50 pointer-events-none flex flex-col gap-2.5 select-none"
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
            className={`pointer-events-auto rounded-2xl p-3.5 backdrop-blur-xl border flex items-start gap-3 transition-all duration-300 shadow-xl animate-in slide-in-from-top-3 ${
              isSuccess
                ? 'bg-white/98 border-emerald-400/80 shadow-[0_12px_36px_rgba(16,185,129,0.2)]'
                : isError
                ? 'bg-white/98 border-rose-400/80 shadow-[0_12px_36px_rgba(244,63,94,0.2)]'
                : isWarning
                ? 'bg-white/98 border-amber-400/80 shadow-[0_12px_36px_rgba(245,158,11,0.2)]'
                : 'bg-white/98 border-sky-400/80 shadow-[0_12px_36px_rgba(14,165,233,0.2)]'
            }`}
          >
            {/* Icon */}
            <div
              className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
                isSuccess
                  ? 'bg-emerald-50 text-emerald-600'
                  : isError
                  ? 'bg-rose-50 text-rose-600'
                  : isWarning
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-sky-50 text-sky-600'
              }`}
            >
              {isSuccess && <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />}
              {isError && <AlertCircle className="w-5 h-5 stroke-[2.2]" />}
              {isWarning && <AlertTriangle className="w-5 h-5 stroke-[2.2]" />}
              {isInfo && <Info className="w-5 h-5 stroke-[2.2]" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pr-1 pt-0.5">
              <div className="text-xs sm:text-sm font-black text-neutral-900 tracking-tight leading-snug">
                {t.title}
              </div>
              {t.description && (
                <p className="text-[11px] sm:text-xs text-neutral-600 mt-0.5 leading-relaxed font-medium">
                  {t.description}
                </p>
              )}
            </div>

            {/* Dismiss Button */}
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="w-6 h-6 rounded-lg text-neutral-400 hover:text-black hover:bg-neutral-100 flex items-center justify-center shrink-0 transition-colors active:scale-90"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
