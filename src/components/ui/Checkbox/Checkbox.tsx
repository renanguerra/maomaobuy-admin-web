'use client';

import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label: ReactNode;
    description?: ReactNode;
    /** Aparência de cartão selecionável — usada em listas de escolha múltipla. */
    boxed?: boolean;
}

export function Checkbox({ id, label, description, boxed = false, className = '', ...props }: CheckboxProps) {
    const generatedId = useId();
    const checkboxId = id ?? generatedId;

    return (
        <label
            className={[
                'flex cursor-pointer items-start gap-2.5 text-sm',
                boxed
                    ? 'rounded-lg border border-line bg-surface px-3 py-2.5 transition hover:border-brand-300 has-checked:border-brand-400 has-checked:bg-brand-50 dark:border-night-line dark:bg-night-raised dark:has-checked:border-night-accent/40 dark:has-checked:bg-night-brand'
                    : '',
                className,
            ]
                .filter(Boolean)
                .join(' ')}
            htmlFor={checkboxId}
        >
            <input
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-700 dark:accent-brand-500"
                id={checkboxId}
                type="checkbox"
                aria-describedby={description ? `${checkboxId}-description` : undefined}
                {...props}
            />
            <span className="min-w-0">
                <span className="font-semibold text-ink dark:text-night-text">{label}</span>
                {description && (
                    <span
                        className="mt-0.5 block text-xs text-muted dark:text-night-muted"
                        id={`${checkboxId}-description`}
                    >
                        {description}
                    </span>
                )}
            </span>
        </label>
    );
}
