import type { ComponentType, ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
    icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
    title: string;
    description?: ReactNode;
    action?: ReactNode;
    /** `bare` remove a borda tracejada — para usar dentro de um cartão. */
    variant?: 'bordered' | 'bare';
    className?: string;
}

/** Estado vazio: diz o que aconteceu e qual é o próximo passo possível. */
export function EmptyState({
    icon: Icon = Inbox,
    title,
    description,
    action,
    variant = 'bare',
    className = '',
}: EmptyStateProps) {
    return (
        <div
            className={[
                'grid place-items-center px-6 py-10 text-center',
                variant === 'bordered' ? 'rounded-xl border border-dashed border-line dark:border-night-line' : '',
                className,
            ]
                .filter(Boolean)
                .join(' ')}
        >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-700 dark:bg-night-brand dark:text-night-accent">
                <Icon className="h-5 w-5" aria-hidden={true} />
            </span>
            <p className="mt-3.5 mb-0 text-sm font-bold text-ink dark:text-night-text">{title}</p>
            {description && (
                <p className="mt-1.5 mb-0 max-w-md text-sm leading-relaxed text-muted dark:text-night-muted">
                    {description}
                </p>
            )}
            {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
        </div>
    );
}
