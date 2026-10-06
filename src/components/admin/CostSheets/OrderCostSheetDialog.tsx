'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { SummaryList } from '@/components/admin/SummaryList';
import { Button } from '@/components/ui/Button';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { useAdminAccountAuth } from '@/services/auth/admin-account-auth';
import { cny, orderStatusLabel, type CostEntry, type OrderCostItem, type OrderCostSheet } from '@/types/api';
import { CostEntriesTable } from './CostEntriesTable';
import { CostEntryDialog } from './CostEntryDialog';
import { canWriteCosts, canWriteItemCosts } from './cost-utils';
import { useCostPresets } from './use-cost-presets';

interface OrderCostSheetDialogProps {
    orderId: string | null;
    onClose: () => void;
    /** Chamado quando algo mudou (para a lista recarregar os totais). */
    onChanged?: () => void;
}

/**
 * Planilha de custos de um pedido: o que o cliente pagou, quanto custou cada
 * item (o real, se corrigido; senão o do cadastro) e os lançamentos presos
 * ao pedido — frete na China, compra extra.
 */
export function OrderCostSheetDialog({ orderId, onClose, onChanged }: OrderCostSheetDialogProps) {
    const { t } = useTranslation();
    const { admin } = useAdminAccountAuth();
    const [sheet, setSheet] = useState<OrderCostSheet>();
    const [error, setError] = useState<string>();
    const [version, setVersion] = useState(0);
    const [editing, setEditing] = useState<{ entry?: CostEntry } | null>(null);
    const presets = useCostPresets(orderId !== null);
    const canWrite = canWriteCosts(admin?.role);
    const canWriteItems = canWriteItemCosts(admin?.role);

    useEffect(() => {
        if (!orderId) return;
        let active = true;
        api<OrderCostSheet>(`/costs/orders/${orderId}`)
            .then((result) => {
                if (active) {
                    setSheet(result);
                    setError(undefined);
                }
            })
            .catch((err) => {
                if (active) setError(err instanceof ApiError ? err.message : t('profit.sheet.error'));
            });
        return () => {
            active = false;
        };
    }, [orderId, version, t]);

    const current = sheet?.orderId === orderId ? sheet : undefined;

    function refresh(next?: OrderCostSheet) {
        if (next) setSheet(next);
        else setVersion((value) => value + 1);
        onChanged?.();
    }

    return (
        <>
            <Modal
                closeLabel={t('common.closeAria')}
                onClose={onClose}
                open={orderId !== null && editing === null}
                size="large"
                title={t('profit.sheet.orderTitle', { id: orderId?.slice(0, 8) ?? '' })}
                description={
                    current
                        ? [current.customerName, orderStatusLabel(current.status)].filter(Boolean).join(' · ')
                        : undefined
                }
                footer={
                    <>
                        {orderId && (
                            <Link
                                className="mr-auto text-sm text-primary dark:text-night-accent"
                                href={`/admin/pedidos/${orderId}`}
                            >
                                {t('profit.sheet.openOrder')}
                            </Link>
                        )}
                        <Button onClick={onClose} variant="ghost">
                            {t('common.closeAria')}
                        </Button>
                    </>
                }
            >
                {error && (
                    <Alert tone="danger" title={t('common.errors.loadTitle')}>
                        <p>{error}</p>
                    </Alert>
                )}
                {!current && !error && <p className="text-sm text-muted">{t('common.loading')}</p>}
                {current && (
                    <div className="grid gap-5">
                        {current.itemsMissingCost > 0 && (
                            <Alert tone="warning" title={t('profit.sheet.missingTitle')}>
                                <p>{t('profit.sheet.missingDescription', { count: current.itemsMissingCost })}</p>
                            </Alert>
                        )}
                        <div className="grid gap-5 md:grid-cols-2">
                            <section>
                                <h3 className="m-0 mb-1 text-sm font-bold">{t('profit.sheet.revenue')}</h3>
                                <SummaryList
                                    rows={[
                                        {
                                            label: t('profit.revenue.merchandise'),
                                            value: cny(current.revenue.merchandiseMinor),
                                        },
                                        {
                                            label: t('profit.revenue.serviceFee'),
                                            value: cny(current.revenue.serviceFeeMinor),
                                        },
                                        {
                                            label: t('profit.revenue.optionalServices'),
                                            value: cny(current.revenue.optionalServicesMinor),
                                        },
                                        {
                                            label: t('profit.revenue.discounts'),
                                            value: `− ${cny(current.revenue.discountMinor)}`,
                                        },
                                        {
                                            label: t('profit.revenue.total'),
                                            value: cny(current.revenue.totalMinor),
                                            emphasis: true,
                                        },
                                    ]}
                                />
                            </section>
                            <section>
                                <h3 className="m-0 mb-1 text-sm font-bold">{t('profit.sheet.costs')}</h3>
                                <SummaryList
                                    rows={[
                                        { label: t('profit.costs.products'), value: cny(current.costs.productsMinor) },
                                        { label: t('profit.costs.entries'), value: cny(current.costs.entriesMinor) },
                                        { label: t('profit.costs.total'), value: cny(current.costs.totalMinor) },
                                        {
                                            label:
                                                Number(current.profitMinor) >= 0
                                                    ? t('profit.kpi.profit')
                                                    : t('profit.kpi.loss'),
                                            value: cny(current.profitMinor),
                                            emphasis: true,
                                        },
                                    ]}
                                />
                            </section>
                        </div>

                        <section>
                            <h3 className="m-0 mb-1 text-sm font-bold">{t('profit.sheet.items')}</h3>
                            <p className="m-0 mb-2 text-xs text-muted dark:text-night-muted">
                                {t('profit.sheet.itemsHint')}
                            </p>
                            <ul className="m-0 grid list-none gap-0 p-0">
                                {current.items.map((item, index) => (
                                    <ItemCostRow
                                        canWrite={canWriteItems}
                                        first={index === 0}
                                        item={item}
                                        key={item.id}
                                        onSaved={refresh}
                                        orderId={current.orderId}
                                    />
                                ))}
                            </ul>
                        </section>

                        <section>
                            <div className="mb-1 flex items-center justify-between gap-3">
                                <h3 className="m-0 text-sm font-bold">{t('profit.sheet.entries')}</h3>
                                {canWrite && (
                                    <Button
                                        leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                                        onClick={() => setEditing({})}
                                        size="small"
                                        variant="secondary"
                                    >
                                        {t('profit.actions.addCost')}
                                    </Button>
                                )}
                            </div>
                            <CostEntriesTable
                                canWrite={canWrite}
                                entries={current.entries}
                                onDeleted={() => refresh()}
                                onEdit={(entry) => setEditing({ entry })}
                            />
                        </section>
                    </div>
                )}
            </Modal>
            <CostEntryDialog
                entry={editing?.entry}
                onClose={() => setEditing(null)}
                onSaved={() => {
                    setEditing(null);
                    refresh();
                }}
                open={editing !== null}
                presets={presets}
                target={orderId ? { orderId } : undefined}
            />
        </>
    );
}

function ItemCostRow({
    item,
    orderId,
    canWrite,
    first,
    onSaved,
}: {
    item: OrderCostItem;
    orderId: string;
    canWrite: boolean;
    first: boolean;
    onSaved: (sheet: OrderCostSheet) => void;
}) {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [minor, setMinor] = useState(item.unitCostAmountMinor ?? item.productCostAmountMinor ?? '0');
    const [saving, setSaving] = useState(false);
    const dirty = minor !== (item.unitCostAmountMinor ?? item.productCostAmountMinor ?? '0');

    async function save(value: string | null) {
        setSaving(true);
        try {
            const sheet = await api<OrderCostSheet>(`/costs/orders/${orderId}/items/${item.id}`, {
                method: 'PUT',
                body: JSON.stringify({ unitCostAmountMinor: value }),
            });
            notify({ tone: 'success', title: t('profit.sheet.itemSaved') });
            onSaved(sheet);
        } catch (err) {
            notify({ tone: 'danger', title: err instanceof ApiError ? err.message : t('common.errors.generic') });
        } finally {
            setSaving(false);
        }
    }

    const source =
        item.unitCostAmountMinor !== null
            ? t('profit.sheet.costFrozen')
            : item.productCostAmountMinor !== null
              ? t('profit.sheet.costFromProduct')
              : t('profit.sheet.costMissing');

    return (
        <li
            className={`grid gap-2 py-2.5 sm:grid-cols-[1fr_12rem] sm:items-center ${first ? '' : 'border-t border-line dark:border-night-line'}`}
        >
            <div className="min-w-0">
                <p className="m-0 truncate text-sm font-semibold">
                    {item.quantity} × {item.productName}
                </p>
                <p className="m-0 mt-0.5 text-xs text-muted dark:text-night-muted">
                    {t('profit.sheet.soldFor', { value: cny(item.unitAmountMinor) })} · {source}
                </p>
            </div>
            {canWrite ? (
                <div className="flex items-end gap-1.5">
                    <CurrencyInput
                        aria-label={t('profit.sheet.unitCost')}
                        currency="CNY"
                        fieldClassName="flex-1"
                        minor={minor}
                        onMinorChange={setMinor}
                    />
                    <Button disabled={!dirty} loading={saving} onClick={() => void save(minor)} size="small">
                        {t('common.actions.save')}
                    </Button>
                </div>
            ) : (
                <span className="mm-data text-right text-sm font-semibold">
                    {item.effectiveUnitCostAmountMinor ? cny(item.effectiveUnitCostAmountMinor) : '—'}
                </span>
            )}
        </li>
    );
}
