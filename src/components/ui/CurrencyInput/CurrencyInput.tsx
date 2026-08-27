'use client';

import { useId, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Field } from '@/components/ui/Field';
import { formatMinorAmount, sanitizeMinorDigits } from './currency-mask';

const MAX_DIGITS = 12;
const NAVIGATION_KEYS = new Set([
    'Tab',
    'Enter',
    'Escape',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
    'Shift',
]);

export interface CurrencyInputProps {
    id?: string;
    /** Nome do campo escondido usado para leitura via FormData em formulários nativos. */
    name?: string;
    /** Valor controlado em unidades mínimas (centavos), ex.: "12990". */
    minor: string;
    onMinorChange: (minor: string) => void;
    /** Quando informado, o campo já vem com rótulo e apoio próprios. */
    label?: ReactNode;
    hint?: ReactNode;
    error?: string;
    /** Sigla exibida à direita (BRL, CNY). */
    currency?: string;
    required?: boolean;
    disabled?: boolean;
    className?: string;
    fieldClassName?: string;
    'aria-label'?: string;
}

/**
 * Campo de valor no estilo "input de banco": os dígitos são digitados da direita
 * para a esquerda e o campo se autoformata a cada tecla. O valor exposto (e o
 * campo escondido, quando `name` é informado) já fica em unidades mínimas
 * (centavos), no formato que o backend espera — sem parsing de texto livre.
 */
export function CurrencyInput({
    id,
    name,
    minor,
    onMinorChange,
    label,
    hint,
    error,
    currency,
    required,
    disabled,
    className = '',
    fieldClassName = '',
    ...rest
}: CurrencyInputProps) {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        if (/^[0-9]$/.test(event.key)) {
            event.preventDefault();
            const next = sanitizeMinorDigits(minor + event.key);
            if (next.length <= MAX_DIGITS) onMinorChange(next);
            return;
        }
        if (event.key === 'Backspace') {
            event.preventDefault();
            onMinorChange(sanitizeMinorDigits(minor.slice(0, -1)));
            return;
        }
        if (event.key === 'Delete') {
            event.preventDefault();
            onMinorChange('0');
            return;
        }
        if (!NAVIGATION_KEYS.has(event.key)) event.preventDefault();
    }

    function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
        event.preventDefault();
        const pasted = event.clipboardData.getData('text');
        const combined = sanitizeMinorDigits(minor + pasted);
        onMinorChange(combined.length > MAX_DIGITS ? combined.slice(-MAX_DIGITS) : combined);
    }

    const control = (
        <div className="relative flex items-center">
            <input
                id={inputId}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={formatMinorAmount(minor)}
                onChange={() => {}}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                required={required}
                disabled={disabled}
                aria-describedby={hint || error ? `${inputId}-support` : undefined}
                aria-invalid={error ? true : undefined}
                className={['mm-field mm-data text-right', currency ? 'pr-12' : '', className]
                    .filter(Boolean)
                    .join(' ')}
                {...rest}
            />
            {currency && (
                <span className="pointer-events-none absolute right-3 text-xs font-semibold text-muted dark:text-night-subtle">
                    {currency}
                </span>
            )}
            {name && <input type="hidden" name={name} value={sanitizeMinorDigits(minor)} />}
        </div>
    );

    if (!label) return control;

    return (
        <Field className={fieldClassName} error={error} hint={hint} htmlFor={inputId} label={label} required={required}>
            {control}
        </Field>
    );
}
