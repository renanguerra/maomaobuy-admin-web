'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { cny, money, type CostEntry } from '@/types/api';
import { formatIsoDay } from './cost-utils';

interface CostEntriesTableProps {
    entries: readonly CostEntry[];
    canWrite: boolean;
    onEdit: (entry: CostEntry) => void;
    onDeleted: () => void;
    /** Mostra a que pedido/caixa o custo pertence (lista geral). */
    showTarget?: boolean;
}

/** Lançamentos de custo em linhas compactas, com editar e remover. */
export function CostEntriesTable({ entries, canWrite, onEdit, onDeleted, showTarget }: CostEntriesTableProps) {
    const { t } = useTranslation();
    const confirm = useConfirm();
    const { notify } = useToast();

    async function remove(entry: CostEntry) {
        const ok = await confirm({
            title: t('profit.entries.deleteTitle'),
            description: t('profit.entries.deleteDescription', { description: entry.description }),
            confirmLabel: t('common.actions.remove'),
            tone: 'danger',
        });
        if (!ok) return;
        try {
            await api(`/costs/entries/${entry.id}`, { method: 'DELETE' });
            notify({ tone: 'success', title: t('profit.entries.deletedFeedback') });
            onDeleted();
        } catch (err) {
            notify({ tone: 'danger', title: err instanceof ApiError ? err.message : t('common.errors.generic') });
        }
    }

    if (entries.length === 0)
        return <p className="m-0 py-3 text-sm text-muted dark:text-night-muted">{t('profit.entries.empty')}</p>;

    return (
        <ul className="m-0 grid list-none gap-0 p-0">
            {entries.map((entry, index) => (
                <li
                    className={`flex items-start justify-between gap-3 py-2.5 ${index > 0 ? 'border-t border-line dark:border-night-line' : ''}`}
                    key={entry.id}
                >
                    <div className="min-w-0">
                        <p className="m-0 truncate text-sm font-semibold text-ink dark:text-night-text">
                            {entry.quantity > 1 ? `${entry.quantity} × ` : ''}
                            {entry.description}
                        </p>
                        <p className="m-0 mt-0.5 text-xs text-muted dark:text-night-muted">
                            {[
                                t(`profit.categories.${entry.category}`),
                                formatIsoDay(entry.incurredOn),
                                showTarget && entry.packageCode
                                    ? t('profit.entries.box', { code: entry.packageCode })
                                    : null,
                                showTarget && entry.orderId
                                    ? t('profit.entries.order', { id: entry.orderId.slice(0, 8) })
                                    : null,
                                entry.createdBy?.name,
                            ]
                                .filter(Boolean)
                                .join(' · ')}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-start gap-1">
                        <span className="text-right">
                            <span className="mm-data block text-sm font-semibold">{cny(entry.amountCnyMinor)}</span>
                            {entry.currency === 'BRL' && (
                                <span className="mm-data block text-[11px] text-muted dark:text-night-muted">
                                    {money(entry.amountMinor, 'BRL')}
                                </span>
                            )}
                        </span>
                        {canWrite && (
                            <>
                                <Button
                                    aria-label={t('profit.entries.edit')}
                                    iconOnly
                                    onClick={() => onEdit(entry)}
                                    size="small"
                                    variant="ghost"
                                >
                                    <Pencil className="h-4 w-4" aria-hidden="true" />
                                </Button>
                                <Button
                                    aria-label={t('common.actions.remove')}
                                    iconOnly
                                    onClick={() => void remove(entry)}
                                    size="small"
                                    variant="dangerGhost"
                                >
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </Button>
                            </>
                        )}
                    </div>
                </li>
            ))}
        </ul>
    );
}
