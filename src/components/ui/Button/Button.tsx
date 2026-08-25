import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
    leadingIcon?: ReactNode;
    loading?: boolean;
}

export function Button({
    variant = 'primary',
    size = 'medium',
    fullWidth = false,
    leadingIcon,
    loading = false,
    className = '',
    children,
    disabled,
    ...props
}: ButtonProps) {
    const variants = {
        primary:
            'border-brand-700 bg-brand-700 text-white shadow-sm hover:border-brand-800 hover:bg-brand-800 dark:border-brand-500 dark:bg-brand-600',
        secondary:
            'border-line bg-surface text-ink shadow-sm hover:border-brand-300 hover:bg-brand-50 dark:border-night-line dark:bg-night-surface dark:text-night-accent-strong',
        ghost: 'border-transparent bg-transparent text-primary hover:bg-brand-50 dark:text-night-accent dark:hover:bg-night-brand-hover',
        danger: 'border-origin-600 bg-origin-600 text-white shadow-sm hover:border-origin-700 hover:bg-origin-700 dark:border-origin-500 dark:bg-origin-600',
    };
    const sizes = { small: 'min-h-9 px-4 py-2', medium: 'min-h-11 px-5 py-3', large: 'min-h-13 px-6 py-4 text-base' };
    const classes = [
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border text-sm font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-300 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
        variants[variant],
        sizes[size],
        fullWidth ? 'w-full' : '',
        className,
    ]
        .filter(Boolean)
        .join(' ');
    return (
        <button className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : leadingIcon}
            {children}
        </button>
    );
}
