'use client';

import { useId, type ClipboardEvent, type KeyboardEvent } from 'react';
import { formatMinorAmount, sanitizeMinorDigits } from './currency-mask';

const MAX_DIGITS = 12;
const NAVIGATION_KEYS = new Set(['Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Shift']);

export interface CurrencyInputProps {
    id?: string;
    /** Nome do campo escondido usado para leitura via FormData em formulários nativos. */
    name?: string;
    /** Valor controlado em unidades mínimas (centavos), ex.: "12990". */
    minor: string;
    onMinorChange: (minor: string) => void;
    required?: boolean;
    disabled?: boolean;
    className?: string;
    'aria-label'?: string;
}

/**
 * Campo de valor no estilo "input de banco": os dígitos são digitados da direita
 * para a esquerda e o campo se autoformata a cada tecla. O valor exposto (e o
 * campo escondido, quando `name` é informado) já fica em unidades mínimas
 * (centavos), no formato que o backend espera — sem parsing de texto livre.
 */
export function CurrencyInput({ id, name, minor, onMinorChange, required, disabled, className, ...rest }: CurrencyInputProps) {
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

    return (
        <>
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
                className={className}
                {...rest}
            />
            {name && <input type="hidden" name={name} value={sanitizeMinorDigits(minor)} />}
        </>
    );
}
