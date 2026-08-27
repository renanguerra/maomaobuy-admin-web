'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useTranslation } from '@/i18n/LanguageProvider';

export interface ConfirmOptions {
    title: string;
    description?: ReactNode;
    /** Rótulo da ação principal. Sem ele, vale "Confirmar". */
    confirmLabel?: string;
    cancelLabel?: string;
    /** `danger` para ações destrutivas (excluir, remover item). */
    tone?: 'primary' | 'danger';
}

interface ConfirmContextValue {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | undefined>(undefined);

/**
 * Substitui o `window.confirm` nativo, que ignora o tema, não é traduzível e
 * trava a aba. Uso: `if (!(await confirm({ title, tone: 'danger' }))) return;`.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
    const { t } = useTranslation();
    const [options, setOptions] = useState<ConfirmOptions>();
    const resolver = useRef<(confirmed: boolean) => void>(undefined);

    const settle = useCallback((confirmed: boolean) => {
        resolver.current?.(confirmed);
        resolver.current = undefined;
        setOptions(undefined);
    }, []);

    const confirm = useCallback((next: ConfirmOptions) => {
        // Um pedido novo cancela o anterior — nunca há duas perguntas na fila.
        resolver.current?.(false);
        setOptions(next);
        return new Promise<boolean>((resolve) => {
            resolver.current = resolve;
        });
    }, []);

    const value = useMemo(() => ({ confirm }), [confirm]);

    return (
        <ConfirmContext.Provider value={value}>
            {children}
            <Modal
                closeLabel={t('common.closeAria')}
                onClose={() => settle(false)}
                open={Boolean(options)}
                title={options?.title ?? ''}
                footer={
                    <>
                        <Button type="button" variant="ghost" onClick={() => settle(false)}>
                            {options?.cancelLabel ?? t('common.actions.cancel')}
                        </Button>
                        <Button
                            type="button"
                            variant={options?.tone === 'danger' ? 'danger' : 'primary'}
                            onClick={() => settle(true)}
                        >
                            {options?.confirmLabel ?? t('common.actions.confirm')}
                        </Button>
                    </>
                }
            >
                <p className="m-0 text-sm leading-relaxed text-muted dark:text-night-muted">
                    {options?.description ?? t('common.confirmFallback')}
                </p>
            </Modal>
        </ConfirmContext.Provider>
    );
}

export function useConfirm() {
    const context = useContext(ConfirmContext);
    if (!context) throw new Error('useConfirm deve ser usado dentro de um ConfirmProvider.');
    return context.confirm;
}
