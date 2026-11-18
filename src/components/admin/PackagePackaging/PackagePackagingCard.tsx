'use client';

import { useEffect, useState } from 'react';
import { SectionCard } from '@/components/admin/SectionCard';
import { Select } from '@/components/ui/Select';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import type { AdminPackage } from '@/types/api';
import type { ShippingBox } from '@/types/shipping-box';
import { yuan } from '@/types/shipping-table';

/**
 * Embalagem que o armazém usou no pacote. Escolher lança o custo dela na
 * planilha da caixa (relatório de lucro); trocar substitui o lançamento e
 * "Não informada" o remove. A lista vem de Embalagens.
 */
export function PackagePackagingCard({
    pkg,
    canEdit,
    onUpdated,
    onError,
}: {
    pkg: AdminPackage;
    canEdit: boolean;
    onUpdated: (updated: AdminPackage) => void;
    onError: (message: string) => void;
}) {
    const { t } = useTranslation();
    const [boxes, setBoxes] = useState<ShippingBox[]>();
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api<ShippingBox[]>('/shipping-boxes')
            .then(setBoxes)
            .catch(() => setBoxes([]));
    }, []);

    const current = boxes?.find((box) => box.id === pkg.shippingBoxId);
    // Embalagem fora de uso só aparece se já for a deste pacote.
    const options = (boxes ?? []).filter((box) => box.isActive || box.id === pkg.shippingBoxId);

    async function change(value: string) {
        setSaving(true);
        try {
            const updated = await api<AdminPackage>(`/packages/${pkg.id}/packaging`, {
                method: 'PUT',
                body: JSON.stringify({ shippingBoxId: value || null }),
            });
            onUpdated(updated);
        } catch (err) {
            onError(err instanceof ApiError ? err.message : t('common.errors.generic'));
        } finally {
            setSaving(false);
        }
    }

    return (
        <SectionCard dense title={t('shippingBoxes.package.title')}>
            <div className="grid gap-2">
                <Select
                    disabled={!canEdit || saving || !boxes}
                    hideLabel
                    label={t('shippingBoxes.package.title')}
                    onChange={(event) => void change(event.target.value)}
                    options={[
                        { value: '', label: t('shippingBoxes.package.none') },
                        ...options.map((box) => ({
                            value: box.id,
                            label:
                                box.costAmountMinor === null
                                    ? box.label
                                    : `${box.label} · ${yuan(box.costAmountMinor)}`,
                        })),
                    ]}
                    value={pkg.shippingBoxId ?? ''}
                />
                <p className="m-0 text-xs leading-relaxed text-muted dark:text-night-muted">
                    {current && current.costAmountMinor === null
                        ? t('shippingBoxes.package.noCost')
                        : t('shippingBoxes.package.hint')}
                </p>
            </div>
        </SectionCard>
    );
}
