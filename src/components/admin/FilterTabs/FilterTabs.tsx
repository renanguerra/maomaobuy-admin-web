'use client';

export interface FilterTabOption<T extends string> {
    value: T;
    label: string;
    count?: number;
}

export interface FilterTabsProps<T extends string> {
    options: readonly FilterTabOption<T>[];
    value: T;
    onChange: (value: T) => void;
    label: string;
    className?: string;
}

/** Filtros rápidos por situação — o que o admin mais troca durante o dia. */
export function FilterTabs<T extends string>({ options, value, onChange, label, className = '' }: FilterTabsProps<T>) {
    return (
        <div
            className={['mm-scroll-x -mx-1 flex gap-1.5 px-1 pb-1', className].filter(Boolean).join(' ')}
            role="tablist"
            aria-label={label}
        >
            {options.map((option) => {
                const isActive = option.value === value;

                return (
                    <button
                        className={`inline-flex min-h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-semibold whitespace-nowrap transition ${
                            isActive
                                ? 'border-brand-700 bg-brand-700 text-white dark:border-brand-600 dark:bg-brand-600'
                                : 'border-line bg-surface text-muted hover:border-brand-300 hover:text-ink dark:border-night-line dark:bg-night-raised dark:text-night-muted dark:hover:text-night-text'
                        }`}
                        key={option.value}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onChange(option.value)}
                    >
                        {option.label}
                        {option.count !== undefined && (
                            <span
                                className={`mm-data rounded-full px-1.5 py-0.5 text-[0.65rem] leading-none font-bold ${
                                    isActive
                                        ? 'bg-white/20 text-white'
                                        : 'bg-warm-200 text-muted dark:bg-night-surface dark:text-night-subtle'
                                }`}
                            >
                                {option.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
