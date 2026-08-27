import type { ReactNode } from 'react';

export interface FieldProps {
    /** `id` do controle — liga o rótulo e a mensagem de apoio ao campo. */
    htmlFor: string;
    label: ReactNode;
    hint?: ReactNode;
    error?: ReactNode;
    /** Marca visualmente o campo como obrigatório. */
    required?: boolean;
    /** Esconde o rótulo visualmente, mantendo-o para leitores de tela. */
    hideLabel?: boolean;
    className?: string;
    children: ReactNode;
}

/**
 * Envelope de campo de formulário: rótulo acima, controle no meio, apoio
 * (dica ou erro) abaixo. Todo campo do painel passa por aqui para que rótulo,
 * `aria-describedby` e mensagem de erro fiquem sempre no mesmo lugar.
 */
export function Field({
    htmlFor,
    label,
    hint,
    error,
    required = false,
    hideLabel = false,
    className = '',
    children,
}: FieldProps) {
    return (
        <div className={['grid content-start gap-1.5', className].filter(Boolean).join(' ')}>
            <label
                className={hideLabel ? 'sr-only' : 'text-sm font-semibold text-ink dark:text-night-text'}
                htmlFor={htmlFor}
            >
                {label}
                {required && (
                    <span className="ml-0.5 text-origin-600 dark:text-night-coral" aria-hidden="true">
                        *
                    </span>
                )}
            </label>

            {children}

            {(error || hint) && (
                <p
                    className={`m-0 text-xs leading-relaxed ${
                        error
                            ? 'font-semibold text-origin-700 dark:text-night-coral'
                            : 'text-muted dark:text-night-muted'
                    }`}
                    id={`${htmlFor}-support`}
                >
                    {error ?? hint}
                </p>
            )}
        </div>
    );
}
