'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchInputProps {
    /** Termo já aplicado à consulta. Mudanças externas (limpar filtros) refletem no campo. */
    value: string;
    /** Chamado depois do intervalo de digitação, já com o termo aparado. */
    onChange: (value: string) => void;
    label: string;
    placeholder?: string;
    clearLabel?: string;
    delay?: number;
    className?: string;
}

const DEFAULT_DELAY_MS = 350;

/**
 * Busca com resposta automática: o admin digita e a lista se atualiza sozinha
 * depois de uma pausa curta. Sem botão "buscar" — um clique a menos por
 * consulta em telas usadas o dia inteiro.
 */
export function SearchInput({
    value,
    onChange,
    label,
    placeholder,
    clearLabel,
    delay = DEFAULT_DELAY_MS,
    className = '',
}: SearchInputProps) {
    const inputId = useId();
    const [text, setText] = useState(value);
    const emitted = useRef(value);

    // Reflete no campo mudanças vindas de fora (ex.: botão "limpar filtros").
    useEffect(() => {
        if (value !== emitted.current) {
            emitted.current = value;
            setText(value);
        }
    }, [value]);

    useEffect(() => {
        const trimmed = text.trim();
        if (trimmed === emitted.current) return;
        const timeout = setTimeout(() => {
            emitted.current = trimmed;
            onChange(trimmed);
        }, delay);
        return () => clearTimeout(timeout);
    }, [delay, onChange, text]);

    return (
        <div className={['relative flex items-center', className].filter(Boolean).join(' ')}>
            <Search
                className="pointer-events-none absolute left-3 h-4 w-4 text-muted dark:text-night-subtle"
                aria-hidden="true"
            />
            <label className="sr-only" htmlFor={inputId}>
                {label}
            </label>
            <input
                className="mm-field pr-9 pl-9"
                id={inputId}
                type="search"
                placeholder={placeholder}
                value={text}
                onChange={(event) => setText(event.target.value)}
            />
            {text.length > 0 && (
                <button
                    className="absolute right-2 grid h-6 w-6 cursor-pointer place-items-center rounded-full text-muted transition hover:bg-warm-200 hover:text-ink dark:text-night-subtle dark:hover:bg-night-raised dark:hover:text-night-text"
                    type="button"
                    onClick={() => setText('')}
                    aria-label={clearLabel ?? label}
                >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
            )}
        </div>
    );
}
