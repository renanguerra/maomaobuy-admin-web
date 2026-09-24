'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import type { AdminPackage, AdminPackageItem } from '@/types/api';

interface RemovePackageItemDialogProps {
    packageId: string;
    /** Linha com mais de uma unidade; com uma só, a página usa o `confirm` simples. */
    item: AdminPackageItem;
    onClose: () => void;
    onRemoved: (pkg: AdminPackage) => void;
}

/**
 * Tira parte das unidades de uma linha do pacote. As unidades tiradas voltam
 * a ficar elegíveis para outro pacote do cliente; tirar todas apaga a linha.
 * A página monta o diálogo só enquanto ele está aberto, com `key` do item —
 * cada abertura começa em uma unidade.
 */
export function RemovePackageItemDialog({ packageId, item, onClose, onRemoved }: RemovePackageItemDialogProps) {
    const { t } = useTranslation();
    const [value, setValue] = useState('1');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string>();

    const quantity = Number(value);
    const valid = Number.isInteger(quantity) && quantity >= 1 && quantity <= item.quantity;

    function step(delta: number) {
        const base = valid ? quantity : 1;
        setValue(String(Math.min(item.quantity, Math.max(1, base + delta))));
    }

    async function remove() {
        if (!valid) return;

        setSubmitting(true);
        setError(undefined);
        try {
            const updated = await api<AdminPackage>(`/packages/${packageId}/items/${item.id}?quantity=${quantity}`, {
                method: 'DELETE',
            });
            onRemoved(updated);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('common.errors.generic'));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal
            closeLabel={t('common.closeAria')}
            description={t('packages.detail.itemsSection.removePartialDescription', {
                name: item.orderItem.productName,
                count: item.quantity,
            })}
            onClose={onClose}
            open
            title={t('packages.detail.itemsSection.removeTitle')}
            footer={
                <>
                    <Button onClick={onClose} type="button" variant="ghost">
                        {t('common.actions.cancel')}
                    </Button>
                    <Button disabled={!valid} loading={submitting} onClick={remove} type="button" variant="danger">
                        {valid && quantity === item.quantity
                            ? t('packages.detail.itemsSection.removeAll')
                            : t('packages.detail.itemsSection.removeUnits', { count: valid ? quantity : 0 })}
                    </Button>
                </>
            }
        >
            {error && (
                <Alert className="mb-3" tone="danger">
                    <p>{error}</p>
                </Alert>
            )}

            <form
                className="flex items-end gap-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    void remove();
                }}
            >
                <Button
                    aria-label={t('packages.detail.itemsSection.decreaseAria')}
                    disabled={!valid || quantity <= 1}
                    iconOnly
                    onClick={() => step(-1)}
                    type="button"
                    variant="secondary"
                >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Input
                    className="text-center"
                    error={valid ? undefined : t('packages.detail.itemsSection.removeRange', { count: item.quantity })}
                    fieldClassName="w-28"
                    inputMode="numeric"
                    label={t('packages.detail.itemsSection.removeQuantityLabel')}
                    max={item.quantity}
                    min={1}
                    onChange={(event) => setValue(event.target.value)}
                    step={1}
                    type="number"
                    value={value}
                />
                <Button
                    aria-label={t('packages.detail.itemsSection.increaseAria')}
                    disabled={!valid || quantity >= item.quantity}
                    iconOnly
                    onClick={() => step(1)}
                    type="button"
                    variant="secondary"
                >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button onClick={() => setValue(String(item.quantity))} type="button" variant="ghost">
                    {t('packages.detail.itemsSection.selectAll', { count: item.quantity })}
                </Button>
            </form>

            <p className="m-0 mt-3 text-xs leading-relaxed text-muted dark:text-night-muted">
                {valid && quantity < item.quantity
                    ? t('packages.detail.itemsSection.removeRemaining', { count: item.quantity - quantity })
                    : t('packages.detail.itemsSection.removeWholeLine')}
            </p>
        </Modal>
    );
}
