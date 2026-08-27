'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, OctagonAlert, X } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageProvider';

export type ToastTone = 'success' | 'info' | 'warning' | 'danger';

export interface ToastOptions {
    tone?: ToastTone;
    title: string;
    description?: string;
    /** Milissegundos até sumir sozinho. `0` mantém o aviso até o admin fechar. */
    duration?: number;
}

interface ToastEntry extends Required<Pick<ToastOptions, 'tone' | 'title'>> {
    id: number;
    description?: string;
}

interface ToastContextValue {
    notify: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const DEFAULT_DURATION_MS = 5000;

const TONE_CLASSES: Record<ToastTone, string> = {
    success: 'border-jade-200 bg-jade-50 dark:border-night-success/30 dark:bg-night-success-surface',
    info: 'border-brand-200 bg-brand-50 dark:border-night-accent/30 dark:bg-night-brand',
    warning: 'border-amber-200 bg-amber-50 dark:border-night-warning/30 dark:bg-night-warning-surface',
    danger: 'border-origin-200 bg-origin-50 dark:border-night-coral/30 dark:bg-night-coral-surface',
};

const ICON_CLASSES: Record<ToastTone, string> = {
    success: 'text-jade-600 dark:text-night-success',
    info: 'text-brand-600 dark:text-night-accent',
    warning: 'text-amber-600 dark:text-night-warning',
    danger: 'text-origin-600 dark:text-night-coral',
};

const ICONS: Record<ToastTone, typeof Info> = {
    success: CheckCircle2,
    info: Info,
    warning: AlertTriangle,
    danger: OctagonAlert,
};

/**
 * Avisos de resultado de ação (aprovou, despachou, reembolsou). Ficam fora do
 * fluxo da página porque o admin costuma estar com a lista rolada — uma frase
 * no topo passaria despercebida.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
    const { t } = useTranslation();
    const [toasts, setToasts] = useState<ToastEntry[]>([]);
    const nextId = useRef(0);
    const timeouts = useRef(new Map<number, ReturnType<typeof setTimeout>>());

    const dismiss = useCallback((id: number) => {
        const timeout = timeouts.current.get(id);
        if (timeout) clearTimeout(timeout);
        timeouts.current.delete(id);
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const notify = useCallback(
        ({ tone = 'success', title, description, duration = DEFAULT_DURATION_MS }: ToastOptions) => {
            const id = (nextId.current += 1);
            setToasts((current) => [...current.slice(-2), { id, tone, title, description }]);
            if (duration > 0)
                timeouts.current.set(
                    id,
                    setTimeout(() => dismiss(id), duration),
                );
        },
        [dismiss],
    );

    const timeoutsRef = timeouts;
    useEffect(() => {
        const pending = timeoutsRef.current;
        return () => {
            for (const timeout of pending.values()) clearTimeout(timeout);
            pending.clear();
        };
    }, [timeoutsRef]);

    const value = useMemo(() => ({ notify }), [notify]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div
                className="pointer-events-none fixed right-4 bottom-4 z-100 grid w-[min(22rem,calc(100vw-2rem))] gap-2"
                aria-live="polite"
                aria-atomic="false"
            >
                {toasts.map((toast) => {
                    const Icon = ICONS[toast.tone];
                    return (
                        <div
                            className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-[0_12px_32px_rgba(23,34,38,.14)] dark:shadow-[0_12px_32px_rgba(4,12,15,.4)] ${TONE_CLASSES[toast.tone]}`}
                            key={toast.id}
                            role={toast.tone === 'danger' ? 'alert' : 'status'}
                        >
                            <Icon
                                className={`mt-0.5 h-4 w-4 shrink-0 ${ICON_CLASSES[toast.tone]}`}
                                aria-hidden="true"
                            />
                            <div className="min-w-0 flex-1">
                                <p className="m-0 text-sm font-bold text-ink dark:text-night-text">{toast.title}</p>
                                {toast.description && (
                                    <p className="mt-0.5 mb-0 text-xs leading-relaxed text-muted dark:text-night-muted">
                                        {toast.description}
                                    </p>
                                )}
                            </div>
                            <button
                                className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-md text-muted transition hover:text-ink dark:text-night-muted dark:hover:text-night-text"
                                type="button"
                                onClick={() => dismiss(toast.id)}
                                aria-label={t('common.closeAria')}
                            >
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast deve ser usado dentro de um ToastProvider.');
    return context;
}
