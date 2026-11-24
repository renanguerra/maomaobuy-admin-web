'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/LanguageProvider';

export interface PageAction {
    key: string;
    label: string;
    icon?: LucideIcon;
    /** `primary` é o próximo passo; `danger` encerra ou desfaz algo. */
    tone?: 'primary' | 'default' | 'danger';
    /** Fica à vista. Sem isto a ação vai para "Mais ações" (`primary` sempre aparece). */
    inline?: boolean;
    onClick?: () => void;
    href?: string;
    newTab?: boolean;
    loading?: boolean;
    disabled?: boolean;
    /** Por que está desabilitada. */
    hint?: string;
}

export interface PageActionsProps {
    /** Aceita `false`/`undefined` para o chamador escrever `condição && ação`. */
    actions: (PageAction | false | null | undefined)[];
}

/**
 * Área padrão de ações de uma tela: fica no cabeçalho, à direita, com o próximo
 * passo em destaque. O que é usado de vez em quando vai para "Mais ações", e o
 * que encerra ou desfaz fica no fim do menu, separado.
 */
export function PageActions({ actions }: PageActionsProps) {
    const { t } = useTranslation();
    const available = actions.filter((action): action is PageAction => Boolean(action));
    const primary = available.filter((action) => action.tone === 'primary');
    const inline = available.filter((action) => action.tone !== 'primary' && action.inline);
    const rest = available.filter((action) => action.tone !== 'primary' && !action.inline);
    // Um menu de um item só esconde sem ganhar espaço.
    const menu = rest.length > 1 ? rest : [];
    const visible = rest.length > 1 ? inline : [...inline, ...rest];

    if (available.length === 0) return null;

    return (
        <>
            {menu.length > 0 && <ActionMenu actions={menu} label={t('common.actions.moreActions')} />}
            {visible.map((action) => (
                <ActionButton action={action} key={action.key} />
            ))}
            {primary.map((action) => (
                <ActionButton action={action} key={action.key} />
            ))}
        </>
    );
}

function ActionButton({ action }: { action: PageAction }) {
    const Icon = action.icon;
    const variant = action.tone === 'primary' ? 'primary' : action.tone === 'danger' ? 'dangerGhost' : 'secondary';
    const icon = Icon && <Icon className="h-4 w-4" aria-hidden="true" />;
    // No celular o próximo passo abre a linha e ocupa a largura toda.
    const className = action.tone === 'primary' ? 'max-sm:order-first max-sm:w-full' : '';

    if (action.href) {
        return (
            <ButtonLink
                className={className}
                href={action.href}
                leadingIcon={icon}
                size="small"
                variant={variant}
                {...(action.newTab ? { target: '_blank', rel: 'noopener' } : {})}
            >
                {action.label}
            </ButtonLink>
        );
    }

    return (
        <Button
            className={className}
            disabled={action.disabled}
            leadingIcon={icon}
            loading={action.loading}
            onClick={action.onClick}
            size="small"
            title={action.hint}
            variant={variant}
        >
            {action.label}
        </Button>
    );
}

const ITEM_CLASSES =
    'flex w-full cursor-pointer items-center gap-2.5 rounded-md border-0 bg-transparent px-2.5 py-2 text-left text-sm font-semibold no-underline transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-400 disabled:cursor-not-allowed disabled:opacity-50';
const ITEM_TONES = {
    default: 'text-ink hover:bg-warm-200 dark:text-night-text dark:hover:bg-night-brand',
    danger: 'text-origin-700 hover:bg-origin-50 dark:text-night-coral dark:hover:bg-night-coral-surface',
};

/** Largura que o menu precisa à esquerda do botão para abrir alinhado à direita. */
const MENU_ROOM = 320;

function ActionMenu({ actions, label }: { actions: PageAction[]; label: string }) {
    const [open, setOpen] = useState(false);
    const [alignLeft, setAlignLeft] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuId = useId();

    const regular = actions.filter((action) => action.tone !== 'danger');
    const danger = actions.filter((action) => action.tone === 'danger');

    useEffect(() => {
        if (!open) return;
        menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
        function handlePointerDown(event: PointerEvent) {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
        }
        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [open]);

    function toggle() {
        const button = containerRef.current?.getBoundingClientRect();
        const area = containerRef.current?.closest('main')?.getBoundingClientRect();
        // Perto da borda esquerda o menu abriria por baixo da lateral.
        if (button) setAlignLeft(button.right - (area?.left ?? 0) < MENU_ROOM);
        setOpen((value) => !value);
    }

    function close() {
        setOpen(false);
        containerRef.current?.querySelector<HTMLElement>('[aria-haspopup]')?.focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (!open) return;
        if (event.key === 'Escape') {
            event.stopPropagation();
            close();
            return;
        }
        if (event.key === 'Tab') {
            setOpen(false);
            return;
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const items = Array.from(
            menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [],
        );
        if (items.length === 0) return;
        const index = items.indexOf(document.activeElement as HTMLElement);
        const next =
            event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? items.length - 1
                  : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next].focus();
    }

    function renderItem(action: PageAction) {
        const Icon = action.icon;
        const className = `${ITEM_CLASSES} ${ITEM_TONES[action.tone === 'danger' ? 'danger' : 'default']}`;
        const content = (
            <>
                {Icon && <Icon className="h-4 w-4 shrink-0 opacity-75" aria-hidden="true" />}
                {action.label}
            </>
        );

        return action.href ? (
            <Link
                className={className}
                href={action.href}
                key={action.key}
                onClick={() => setOpen(false)}
                role="menuitem"
                {...(action.newTab ? { target: '_blank', rel: 'noopener' } : {})}
            >
                {content}
            </Link>
        ) : (
            <button
                className={className}
                disabled={action.disabled || action.loading}
                key={action.key}
                onClick={() => {
                    // Devolve o foco ao botão antes de abrir o diálogo: ao
                    // fechar, o diálogo restaura o foco num elemento que existe.
                    close();
                    action.onClick?.();
                }}
                role="menuitem"
                title={action.hint}
                type="button"
            >
                {content}
            </button>
        );
    }

    return (
        <div className="relative" onKeyDown={handleKeyDown} ref={containerRef}>
            <Button
                aria-controls={open ? menuId : undefined}
                aria-expanded={open}
                aria-haspopup="menu"
                onClick={toggle}
                size="small"
                type="button"
                variant="secondary"
            >
                {label}
                <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
            </Button>
            {open && (
                <div
                    className={`absolute z-20 mt-1.5 grid w-max max-w-[calc(100vw-2rem)] min-w-52 rounded-xl border border-line bg-surface p-1.5 shadow-lg dark:border-night-line dark:bg-night-raised ${alignLeft ? 'left-0' : 'right-0'}`}
                    id={menuId}
                    ref={menuRef}
                    role="menu"
                >
                    {regular.map(renderItem)}
                    {regular.length > 0 && danger.length > 0 && (
                        <hr className="mx-1 my-1.5 border-0 border-t border-line dark:border-night-line" />
                    )}
                    {danger.map(renderItem)}
                </div>
            )}
        </div>
    );
}
