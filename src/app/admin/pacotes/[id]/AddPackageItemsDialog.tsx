'use client';

import { useEffect, useState } from 'react';
import { PackageOpen } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { EmptyState } from '@/components/admin/EmptyState';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Modal } from '@/components/ui/Modal';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { money, type AdminOrderItem, type AdminPackage } from '@/types/api';

interface AddPackageItemsDialogProps {
    open: boolean;
    packageId: string;
    userId: string;
    onClose: () => void;
    onAdded: (pkg: AdminPackage) => void;
}

/**
 * Adiciona itens ao pacote escolhendo entre os itens elegíveis do próprio
 * cliente. Antes era preciso colar IDs de item na mão — agora o admin marca
 * o que quer e nunca digita um identificador.
 */
export function AddPackageItemsDialog({ open, packageId, userId, onClose, onAdded }: AddPackageItemsDialogProps) {
    const { t } = useTranslation();
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string>();

    /** Fechar sempre descarta a seleção: a próxima abertura começa do zero. */
    function close() {
        setSelectedIds([]);
        setError(undefined);
        onClose();
    }

    async function addItems() {
        if (selectedIds.length === 0) return;

        setSubmitting(true);
        setError(undefined);
        try {
            const updated = await api<AdminPackage>(`/packages/${packageId}/items`, {
                method: 'POST',
                body: JSON.stringify({ orderItemIds: selectedIds }),
            });
            onAdded(updated);
            close();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('common.errors.generic'));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal
            closeLabel={t('common.closeAria')}
            description={t('packages.detail.itemsSection.addDescription')}
            onClose={close}
            open={open}
            size="medium"
            title={t('packages.detail.itemsSection.addButton')}
            footer={
                <>
                    <Button onClick={close} type="button" variant="ghost">
                        {t('common.actions.cancel')}
                    </Button>
                    <Button disabled={selectedIds.length === 0} loading={submitting} onClick={addItems} type="button">
                        {t('packages.detail.itemsSection.add')}
                    </Button>
                </>
            }
        >
            {error && (
                <Alert className="mb-3" tone="danger">
                    <p>{error}</p>
                </Alert>
            )}

            {/* Montado só enquanto aberto: a lista de elegíveis é sempre a atual. */}
            <EligibleItems
                onToggle={(id) =>
                    setSelectedIds((current) =>
                        current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
                    )
                }
                selectedIds={selectedIds}
                userId={userId}
            />
        </Modal>
    );
}

function EligibleItems({
    userId,
    selectedIds,
    onToggle,
}: {
    userId: string;
    selectedIds: string[];
    onToggle: (id: string) => void;
}) {
    const { t } = useTranslation();
    const [items, setItems] = useState<AdminOrderItem[]>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>();

    useEffect(() => {
        let active = true;

        api<AdminOrderItem[]>(`/packages/eligible-items?userId=${userId}`)
            .then((list) => {
                if (active) setItems(list);
            })
            .catch(() => {
                if (active) setError(t('packages.detail.itemsSection.loadError'));
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [t, userId]);

    if (loading) return <SkeletonCards count={2} label={t('common.loading')} />;

    if (error) {
        return (
            <Alert tone="danger">
                <p>{error}</p>
            </Alert>
        );
    }

    if (!items || items.length === 0) {
        return <EmptyState icon={PackageOpen} title={t('users.createPackage.noEligibleItems')} variant="bordered" />;
    }

    return (
        <div className="grid gap-2">
            {items.map((item) => (
                <Checkbox
                    boxed
                    checked={selectedIds.includes(item.id)}
                    key={item.id}
                    label={item.productName}
                    onChange={() => onToggle(item.id)}
                    description={`${t('users.createPackage.quantityLabel', { count: item.quantity })} · ${money(
                        item.unitAmountMinor,
                        item.currency,
                    )}`}
                />
            ))}
        </div>
    );
}
