'use client';

import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Field } from '@/components/ui/Field';

export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
    label: ReactNode;
    options: readonly SelectOption[];
    /** Primeira opção neutra (ex.: "Todos os status"). */
    placeholderOption?: string;
    hint?: ReactNode;
    error?: string;
    hideLabel?: boolean;
    fieldClassName?: string;
}

export function Select({
    id,
    label,
    options,
    placeholderOption,
    hint,
    error,
    hideLabel,
    className = '',
    fieldClassName = '',
    required,
    ...props
}: SelectProps) {
    const generatedId = useId();
    const selectId = id ?? generatedId;

    return (
        <Field
            className={fieldClassName}
            error={error}
            hideLabel={hideLabel}
            hint={hint}
            htmlFor={selectId}
            label={label}
            required={required}
        >
            <select
                className={['mm-field mm-select', className].filter(Boolean).join(' ')}
                id={selectId}
                required={required}
                aria-describedby={hint || error ? `${selectId}-support` : undefined}
                aria-invalid={error ? true : undefined}
                {...props}
            >
                {placeholderOption !== undefined && <option value="">{placeholderOption}</option>}
                {options.map((option) => (
                    <option disabled={option.disabled} key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </Field>
    );
}
