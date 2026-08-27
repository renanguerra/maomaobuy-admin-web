'use client';

import { useId, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Field } from '@/components/ui/Field';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label: ReactNode;
    hint?: ReactNode;
    error?: string;
    hideLabel?: boolean;
    fieldClassName?: string;
}

export function Textarea({
    id,
    label,
    hint,
    error,
    hideLabel,
    className = '',
    fieldClassName = '',
    required,
    rows = 4,
    ...props
}: TextareaProps) {
    const generatedId = useId();
    const textareaId = id ?? generatedId;

    return (
        <Field
            className={fieldClassName}
            error={error}
            hideLabel={hideLabel}
            hint={hint}
            htmlFor={textareaId}
            label={label}
            required={required}
        >
            <textarea
                className={['mm-field resize-y py-2.5', className].filter(Boolean).join(' ')}
                id={textareaId}
                rows={rows}
                required={required}
                aria-describedby={hint || error ? `${textareaId}-support` : undefined}
                aria-invalid={error ? true : undefined}
                {...props}
            />
        </Field>
    );
}
