import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './button-styles';

export type { ButtonSize, ButtonVariant };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
    /** Botão quadrado só com ícone — exige `aria-label`. */
    iconOnly?: boolean;
    leadingIcon?: ReactNode;
    loading?: boolean;
}

export function Button({
    variant = 'primary',
    size = 'medium',
    fullWidth = false,
    iconOnly = false,
    leadingIcon,
    loading = false,
    className = '',
    children,
    disabled,
    ...props
}: ButtonProps) {
    return (
        <button
            className={buttonClasses({ variant, size, fullWidth, iconOnly, className })}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            {...props}
        >
            {loading ? <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" /> : leadingIcon}
            {children}
        </button>
    );
}
