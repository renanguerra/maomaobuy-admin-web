'use client';

import { QuantityBadge } from '@/components/admin/QuantityBadge';
import { Checkbox } from '@/components/ui/Checkbox';
import { useTranslation } from '@/i18n/LanguageProvider';
import { lineTotalMinor, money, totalUnits, type AdminOrderItem } from '@/types/api';

export interface EligibleItemOptionProps {
    item: AdminOrderItem;
    checked: boolean;
    onToggle: () => void;
}

/**
 * Item liberado para envio, como opção de "montar pacote" e "adicionar ao
 * pacote". O item entra inteiro — todas as unidades do pedido —, então a
 * quantidade vai no rótulo, com o mesmo selo do detalhe, e não num texto miúdo
 * embaixo do nome.
 */
export function EligibleItemOption({ item, checked, onToggle }: EligibleItemOptionProps) {
    const { t } = useTranslation();
    return (
        <Checkbox
            boxed
            checked={checked}
            onChange={onToggle}
            label={
                <span className="flex items-center gap-2">
                    <QuantityBadge quantity={item.quantity} size="small" />
                    <span className="min-w-0 break-words">{item.productName}</span>
                </span>
            }
            description={t('users.createPackage.unitPrice', {
                count: item.quantity,
                amount: money(item.unitAmountMinor, item.currency),
                total: money(lineTotalMinor(item.unitAmountMinor, item.quantity), item.currency),
            })}
        />
    );
}

/** Resumo do que está marcado: produtos e unidades, que é o que vai na caixa. */
export function EligibleSelectionSummary({ items, selectedIds }: { items: AdminOrderItem[]; selectedIds: string[] }) {
    const { t } = useTranslation();
    const selected = items.filter((item) => selectedIds.includes(item.id));
    if (selected.length === 0) return null;
    return (
        <p className="m-0 text-sm font-semibold text-ink dark:text-night-text" aria-live="polite">
            {t('users.createPackage.selectionSummary', {
                products: selected.length,
                units: totalUnits(selected),
            })}
        </p>
    );
}
