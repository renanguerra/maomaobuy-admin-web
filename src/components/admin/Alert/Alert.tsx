import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from 'lucide-react';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps {
    tone?: AlertTone;
    title?: ReactNode;
    children?: ReactNode;
    action?: ReactNode;
    className?: string;
}

const TONE_CLASSES: Record<AlertTone, string> = {
    info: 'border-brand-200 bg-brand-50 text-brand-900 dark:border-night-accent/25 dark:bg-night-brand dark:text-night-text',
    success:
        'border-jade-200 bg-jade-50 text-jade-900 dark:border-night-success/25 dark:bg-night-success-surface dark:text-night-text',
    warning:
        'border-amber-200 bg-amber-50 text-amber-900 dark:border-night-warning/25 dark:bg-night-warning-surface dark:text-night-text',
    danger: 'border-origin-200 bg-origin-50 text-origin-900 dark:border-night-coral/25 dark:bg-night-coral-surface dark:text-night-text',
};

const ICON_CLASSES: Record<AlertTone, string> = {
    info: 'text-brand-600 dark:text-night-accent',
    success: 'text-jade-600 dark:text-night-success',
    warning: 'text-amber-600 dark:text-night-warning',
    danger: 'text-origin-600 dark:text-night-coral',
};

const ICONS: Record<AlertTone, typeof Info> = {
    info: Info,
    success: CheckCircle2,
    warning: AlertTriangle,
    danger: OctagonAlert,
};

/** Aviso preso ao conteúdo (erro de carregamento, estado bloqueado da página). */
export function Alert({ tone = 'info', title, children, action, className = '' }: AlertProps) {
    const Icon = ICONS[tone];

    return (
        <div
            className={['rounded-xl border p-4', TONE_CLASSES[tone], className].filter(Boolean).join(' ')}
            role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
        >
            <div className="flex gap-3">
                <Icon className={`mt-0.5 h-4.5 w-4.5 shrink-0 ${ICON_CLASSES[tone]}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                    {title && <p className="m-0 text-sm font-bold">{title}</p>}
                    {children && (
                        <div className={`text-sm leading-relaxed ${title ? 'mt-1' : ''} [&>p]:m-0 [&>p+p]:mt-2`}>
                            {children}
                        </div>
                    )}
                    {action && <div className="mt-3 flex flex-wrap gap-2">{action}</div>}
                </div>
            </div>
        </div>
    );
}
