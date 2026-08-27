import type { InputHTMLAttributes, ReactNode } from 'react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
    label: ReactNode;
    hint?: ReactNode;
    error?: string;
    /** Ícone decorativo à esquerda do campo. */
    leadingIcon?: ReactNode;
    /** Sufixo fixo à direita (unidade, moeda, domínio). */
    suffix?: ReactNode;
    hideLabel?: boolean;
    /** Classe do wrapper do campo (o `<input>` recebe `className`). */
    fieldClassName?: string;
}
