'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export type ModalSize = 'small' | 'medium' | 'large';

export interface ModalProps {
    open: boolean;
    title: ReactNode;
    description?: ReactNode;
    /** Rodapé fixo — normalmente cancelar + ação principal. */
    footer?: ReactNode;
    size?: ModalSize;
    closeLabel: string;
    onClose: () => void;
    children?: ReactNode;
}

const SIZES: Record<ModalSize, string> = {
    small: 'max-w-md',
    medium: 'max-w-lg',
    large: 'max-w-3xl',
};

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo modal do painel: fecha no `Esc` e no clique fora, prende o foco
 * enquanto aberto e devolve o foco a quem o abriu. O corpo rola sozinho —
 * formulários longos (despacho, criação de pacote) não estouram a tela.
 */
export function Modal({ open, title, description, footer, size = 'small', closeLabel, onClose, children }: ModalProps) {
    const titleId = useId();
    const descriptionId = useId();
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;

        const previouslyFocused = document.activeElement as HTMLElement | null;
        document.body.dataset.dialogOpen = 'true';

        const panel = panelRef.current;
        const firstField = panel?.querySelector<HTMLElement>(FOCUSABLE);
        (firstField ?? panel)?.focus();

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                event.stopPropagation();
                onClose();
                return;
            }
            if (event.key !== 'Tab' || !panelRef.current) return;

            const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
                (element) => element.offsetParent !== null,
            );
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }

        document.addEventListener('keydown', handleKeyDown, true);
        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
            delete document.body.dataset.dialogOpen;
            previouslyFocused?.focus?.();
        };
    }, [onClose, open]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-warm-950/45 p-4 backdrop-blur-[2px] dark:bg-black/65"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                className={`mm-card my-auto flex max-h-[calc(100dvh-2rem)] w-full flex-col ${SIZES[size]}`}
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={description ? descriptionId : undefined}
                tabIndex={-1}
            >
                <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4 dark:border-night-line">
                    <div className="min-w-0">
                        <h2 className="mm-display m-0 text-base" id={titleId}>
                            {title}
                        </h2>
                        {description && (
                            <p
                                className="mt-1 mb-0 text-sm leading-relaxed text-muted dark:text-night-muted"
                                id={descriptionId}
                            >
                                {description}
                            </p>
                        )}
                    </div>
                    <button
                        className="-mt-1 -mr-1 grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted transition hover:bg-warm-200 hover:text-ink dark:text-night-muted dark:hover:bg-night-raised dark:hover:text-night-text"
                        type="button"
                        onClick={onClose}
                        aria-label={closeLabel}
                    >
                        <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                </header>

                {/* `has-[>form:empty]` colapsa o corpo quando a ação não pede nenhum
                    dado — confirmações simples ficam sem um vão vazio no meio. */}
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 has-[>form:empty]:hidden">{children}</div>

                {footer && (
                    <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line bg-warm-100 px-5 py-4 dark:border-night-line dark:bg-night-canvas">
                        {footer}
                    </footer>
                )}
            </div>
        </div>
    );
}
