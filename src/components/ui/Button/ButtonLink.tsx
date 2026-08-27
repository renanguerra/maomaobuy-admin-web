import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './button-styles';

export interface ButtonLinkProps extends Omit<ComponentProps<typeof Link>, 'className'> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
    iconOnly?: boolean;
    leadingIcon?: ReactNode;
    className?: string;
    children?: ReactNode;
}

/**
 * Navegação com aparência de botão. Existe para nunca aninhar `<button>`
 * dentro de `<Link>`: quem navega é link, quem executa ação é botão.
 */
export function ButtonLink({
    variant = 'primary',
    size = 'medium',
    fullWidth = false,
    iconOnly = false,
    leadingIcon,
    className = '',
    children,
    ...props
}: ButtonLinkProps) {
    return (
        <Link className={buttonClasses({ variant, size, fullWidth, iconOnly, className })} {...props}>
            {leadingIcon}
            {children}
        </Link>
    );
}
