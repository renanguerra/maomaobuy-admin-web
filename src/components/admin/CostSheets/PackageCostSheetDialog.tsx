'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { SummaryList } from '@/components/admin/SummaryList';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { useAdminAccountAuth } from '@/services/auth/admin-account-auth';
import { cny, packageStatusLabel, type CostEntry, type PackageCostSheet } from '@/types/api';
import { CostEntriesTable } from './CostEntriesTable';
import { CostEntryDialog } from './CostEntryDialog';
import { canWriteCosts } from './cost-utils';
import { PresetQuickAdd } from './PresetQuickAdd';
import { useCostPresets } from './use-cost-presets';

interface PackageCostSheetDialogProps {
    packageId: string | null;
    onClose: () => void;
    onChanged?: () => void;
}

/**
 * Planilha de custos de uma caixa: frete e armazenagem cobrados contra o
 * frete pago à transportadora e a embalagem. Os itens prontos viram botões
 * — "+ Caixa 43×21×27" lança na hora, sem abrir formulário.
 */
export function PackageCostSheetDialog({ packageId, onClose, onChanged }: PackageCostSheetDialogProps) {
    const { t } = useTranslation();
    const { admin } = useAdminAccountAuth();
    const [sheet, setSheet] = useState<PackageCostSheet>();
    const [error, setError] = useState<string>();
    const [version, setVersion] = useState(0);
    const [editing, setEditing] = useState<{ entry?: CostEntry } | null>(null);
    const presets = useCostPresets(packageId !== null);
    const canWrite = canWriteCosts(admin?.role);

    useEffect(() => {
        if (!packageId) return;
        let active = true;
        api<PackageCostSheet>(`/costs/packages/${packageId}`)
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
    }, [packageId, version, t]);

    const current = sheet?.packageId === packageId ? sheet : undefined;

    function refresh() {
        setVersion((value) => value + 1);
        onChanged?.();
    }

    return (
        <>
            <Modal
                closeLabel={t('common.closeAria')}
                onClose={onClose}
                open={packageId !== null && editing === null}
                size="large"
                title={t('profit.sheet.boxTitle', { code: current?.packageCode ?? '' })}
                description={
                    current
                        ? [current.customerName, packageStatusLabel(current.status)].filter(Boolean).join(' · ')
                        : undefined
                }
                footer={
                    <>
                        {packageId && (
                            <Link
                                className="mr-auto text-sm text-primary dark:text-night-accent"
                                href={`/admin/pacotes/${packageId}`}
                            >
                                {t('profit.sheet.openBox')}
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
                        {!current.paidAt && (
                            <Alert tone="info" title={t('profit.sheet.unpaidTitle')}>
                                <p>{t('profit.sheet.unpaidDescription')}</p>
                            </Alert>
                        )}
                        <div className="grid gap-5 md:grid-cols-2">
                            <section>
                                <h3 className="m-0 mb-1 text-sm font-bold">{t('profit.sheet.revenue')}</h3>
                                <SummaryList
                                    rows={[
                                        {
                                            label: t('profit.revenue.shipping'),
                                            value: cny(current.revenue.shippingMinor),
                                        },
                                        {
                                            label: t('profit.revenue.storage'),
                                            value: cny(current.revenue.storageMinor),
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
                                        { label: t('profit.costs.freight'), value: cny(current.costs.freightMinor) },
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
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <h3 className="m-0 text-sm font-bold">{t('profit.sheet.packaging')}</h3>
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
                            {canWrite && packageId && (
                                <PresetQuickAdd onAdded={refresh} presets={presets} target={{ packageId }} />
                            )}
                            <CostEntriesTable
                                canWrite={canWrite}
                                entries={current.entries}
                                onDeleted={refresh}
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
                target={packageId ? { packageId } : undefined}
            />
        </>
    );
}
