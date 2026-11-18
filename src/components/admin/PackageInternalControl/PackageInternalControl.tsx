'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/admin/Alert';
import { SummaryList } from '@/components/admin/SummaryList';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { cny, type AdminPackage, type PackageCostSheet } from '@/types/api';
import type { ShippingBox } from '@/types/shipping-box';
import { yuan } from '@/types/shipping-table';

/**
 * Controle interno do pacote: a embalagem usada e o custo e o lucro da caixa.
 * Fica dentro de uma seção recolhida — só monta (e consulta embalagens e a
 * planilha) quando o admin abre.
 *
 * Escolher a embalagem lança o custo dela na planilha da caixa e preenche as
 * medidas do pacote com as dela; trocar substitui o lançamento.
 */
export function PackageInternalControl({
    pkg,
    canEditPackaging,
    sheetVersion,
    onUpdated,
    onBoxesLoaded,
    onOpenSheet,
    onError,
}: {
    pkg: AdminPackage;
    canEditPackaging: boolean;
    /** Muda quando a planilha completa foi alterada: recarrega o resumo. */
    sheetVersion: number;
    onUpdated: (updated: AdminPackage) => void;
    onBoxesLoaded: (boxes: ShippingBox[]) => void;
    onOpenSheet: () => void;
    onError: (message: string) => void;
}) {
    const { t } = useTranslation();
    const [boxes, setBoxes] = useState<ShippingBox[]>();
    const [sheet, setSheet] = useState<PackageCostSheet>();
    const [sheetError, setSheetError] = useState<string>();
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api<ShippingBox[]>('/shipping-boxes')
            .then((loaded) => {
                setBoxes(loaded);
                onBoxesLoaded(loaded);
            })
            .catch(() => setBoxes([]));
    }, [onBoxesLoaded]);

    const loadSheet = useCallback(() => {
        api<PackageCostSheet>(`/costs/packages/${pkg.id}`)
            .then((loaded) => {
                setSheet(loaded);
                setSheetError(undefined);
            })
            .catch((err) => setSheetError(err instanceof ApiError ? err.message : t('profit.sheet.error')));
    }, [pkg.id, t]);

    useEffect(() => {
        loadSheet();
    }, [loadSheet, sheetVersion]);

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
            loadSheet();
        } catch (err) {
            onError(err instanceof ApiError ? err.message : t('common.errors.generic'));
        } finally {
            setSaving(false);
        }
    }

    const profit = sheet ? BigInt(sheet.profitMinor) : null;

    return (
        <div className="grid gap-5">
            <div className="grid gap-2">
                <Select
                    disabled={!canEditPackaging || saving || !boxes}
                    hint={
                        current && current.costAmountMinor === null
                            ? t('shippingBoxes.package.noCost')
                            : t('shippingBoxes.package.hint')
                    }
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
                {current && !pkg.weightGrams && (
                    <p className="m-0 text-xs leading-relaxed text-amber-800 dark:text-night-warning">
                        {t('shippingBoxes.package.needsWeight')}
                    </p>
                )}
            </div>

            <div className="grid gap-2">
                <p className="m-0 text-sm font-semibold text-ink dark:text-night-text">
                    {t('shippingBoxes.package.profitTitle')}
                </p>
                {sheetError && (
                    <Alert tone="danger">
                        <p>{sheetError}</p>
                    </Alert>
                )}
                {!sheet && !sheetError && (
                    <p className="m-0 text-xs text-muted dark:text-night-muted">{t('common.loading')}</p>
                )}
                {sheet && (
                    <>
                        {!sheet.paidAt && (
                            <p className="m-0 text-xs leading-relaxed text-muted dark:text-night-muted">
                                {t('shippingBoxes.package.notPaid')}
                            </p>
                        )}
                        <SummaryList
                            rows={[
                                { label: t('shippingBoxes.package.revenue'), value: cny(sheet.revenue.totalMinor) },
                                { label: t('shippingBoxes.package.freightCost'), value: cny(sheet.costs.freightMinor) },
                                { label: t('shippingBoxes.package.otherCosts'), value: cny(sheet.costs.entriesMinor) },
                                {
                                    label:
                                        profit !== null && profit < BigInt(0)
                                            ? t('shippingBoxes.package.loss')
                                            : t('shippingBoxes.package.profit'),
                                    value: cny(sheet.profitMinor),
                                    emphasis: true,
                                },
                            ]}
                        />
                    </>
                )}
                <div>
                    <Button onClick={onOpenSheet} size="small" variant="secondary">
                        {t('shippingBoxes.package.openSheet')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
