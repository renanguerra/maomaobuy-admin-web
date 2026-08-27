'use client';

import { useId } from 'react';
import { Field } from '@/components/ui/Field';
import type { InputProps } from './Input.types';

export function Input({
    id,
    label,
    hint,
    error,
    leadingIcon,
    suffix,
    hideLabel,
    className = '',
    fieldClassName = '',
    required,
    ...props
}: InputProps) {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
        <Field
            className={fieldClassName}
            error={error}
            hideLabel={hideLabel}
            hint={hint}
            htmlFor={inputId}
            label={label}
            required={required}
        >
            <div className="relative flex items-center">
                {leadingIcon && (
                    <span
                        className="pointer-events-none absolute left-3 flex text-muted dark:text-night-subtle [&>svg]:h-4 [&>svg]:w-4"
                        aria-hidden="true"
                    >
                        {leadingIcon}
                    </span>
                )}
                <input
                    className={['mm-field', leadingIcon ? 'pl-9' : '', suffix ? 'pr-16' : '', className]
                        .filter(Boolean)
                        .join(' ')}
                    id={inputId}
                    required={required}
                    aria-describedby={hint || error ? `${inputId}-support` : undefined}
                    aria-invalid={error ? true : undefined}
                    {...props}
                />
                {suffix && (
                    <span className="pointer-events-none absolute right-3 text-xs font-semibold text-muted dark:text-night-subtle">
                        {suffix}
                    </span>
                )}
            </div>
        </Field>
    );
}
