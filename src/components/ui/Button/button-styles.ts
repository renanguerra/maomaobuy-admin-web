export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerGhost';
export type ButtonSize = 'small' | 'medium' | 'large';

const BASE =
    'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border text-sm font-semibold whitespace-nowrap no-underline transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none aria-disabled:pointer-events-none aria-disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
    primary:
        'border-brand-700 bg-brand-700 text-white shadow-sm hover:border-brand-800 hover:bg-brand-800 dark:border-brand-600 dark:bg-brand-600 dark:text-white dark:hover:bg-brand-500',
    secondary:
        'border-line bg-surface text-ink shadow-sm hover:border-brand-300 hover:bg-brand-50 dark:border-night-line dark:bg-night-raised dark:text-night-text dark:hover:border-night-accent/40 dark:hover:bg-night-brand',
    ghost: 'border-transparent bg-transparent text-muted hover:bg-warm-200 hover:text-ink dark:text-night-muted dark:hover:bg-night-raised dark:hover:text-night-text',
    danger: 'border-origin-600 bg-origin-600 text-white shadow-sm hover:border-origin-700 hover:bg-origin-700 dark:border-origin-500 dark:bg-origin-600 dark:text-white',
    dangerGhost:
        'border-transparent bg-transparent text-origin-700 hover:bg-origin-50 dark:text-night-coral dark:hover:bg-night-coral-surface',
};

const SIZES: Record<ButtonSize, string> = {
    small: 'min-h-9 px-3.5',
    medium: 'min-h-10 px-4',
    large: 'min-h-12 px-6 text-base',
};

const ICON_SIZES: Record<ButtonSize, string> = {
    small: 'min-h-9 w-9 px-0',
    medium: 'min-h-10 w-10 px-0',
    large: 'min-h-12 w-12 px-0',
};

export interface ButtonStyleOptions {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
    /** Botão quadrado só com ícone — exige `aria-label`. */
    iconOnly?: boolean;
    className?: string;
}

export function buttonClasses({
    variant = 'primary',
    size = 'medium',
    fullWidth = false,
    iconOnly = false,
    className = '',
}: ButtonStyleOptions = {}) {
    return [BASE, VARIANTS[variant], iconOnly ? ICON_SIZES[size] : SIZES[size], fullWidth ? 'w-full' : '', className]
        .filter(Boolean)
        .join(' ');
}
