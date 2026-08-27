import type { ReactNode } from 'react';

export interface TimelineEntry {
    id: string;
    title: ReactNode;
    /** Autor e data da mudança. */
    meta?: ReactNode;
    body?: ReactNode;
    /** Comparação antes → depois. */
    change?: ReactNode;
}

export interface TimelineProps {
    entries: readonly TimelineEntry[];
    className?: string;
}

/** Histórico de mudanças de um registro, do mais recente ao mais antigo. */
export function Timeline({ entries, className = '' }: TimelineProps) {
    return (
        <ol className={['m-0 grid list-none gap-0 p-0', className].filter(Boolean).join(' ')}>
            {entries.map((entry) => (
                <li
                    className="relative grid gap-1 border-l border-line pb-5 pl-5 last:pb-0 dark:border-night-line"
                    key={entry.id}
                >
                    <span
                        className="absolute top-1.5 -left-[0.3125rem] h-2.5 w-2.5 rounded-full border-2 border-surface bg-brand-400 dark:border-night-surface"
                        aria-hidden="true"
                    />
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <strong className="text-sm text-ink dark:text-night-text">{entry.title}</strong>
                        {entry.meta && <span className="text-xs text-muted dark:text-night-subtle">{entry.meta}</span>}
                    </div>
                    {entry.body && (
                        <p className="m-0 text-sm leading-relaxed text-muted dark:text-night-muted">{entry.body}</p>
                    )}
                    {entry.change && (
                        <p className="mm-data m-0 text-xs text-muted dark:text-night-muted">{entry.change}</p>
                    )}
                </li>
            ))}
        </ol>
    );
}
