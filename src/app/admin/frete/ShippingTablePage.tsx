'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layers, Plus, Truck } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { EmptyState } from '@/components/admin/EmptyState';
import { FreightTabs } from '@/components/admin/FreightTabs';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { useAdminAccountAuth } from '@/services/auth/admin-account-auth';
import { kilograms } from '@/types/carrier';
import {
    canWriteShippingTable,
    type ShippingModality,
    type ShippingRateLine,
    type ShippingTable,
} from '@/types/shipping-table';
import { ApiCheckDialog } from './ApiCheckDialog';
import { ModalityDialog } from './ModalityDialog';
import { usePricingSummary } from './PricingEditor';
import { RateLineDialog, type RateLinePreset } from './RateLineDialog';
import { ShippingTableSimulator } from './ShippingTableSimulator';

type Editing =
    | { type: 'modality'; modality: ShippingModality | null }
    | { type: 'line'; line: ShippingRateLine | null; preset?: RateLinePreset }
    | { type: 'api'; line: ShippingRateLine };

/**
 * Tabela de frete: modalidades com o nosso nome e as linhas de fornecedor por
 * trás delas. O site (página /frete e carrinho) mostra, por modalidade ativa,
 * a linha ativa mais barata que aceita o volume, com a margem de frete.
 */
export function ShippingTablePage() {
    const { t } = useTranslation();
    const { notify } = useToast();
    const { admin } = useAdminAccountAuth();
    const canWrite = canWriteShippingTable(admin?.role);
    const summarize = usePricingSummary();
    const [table, setTable] = useState<ShippingTable>();
    const [error, setError] = useState<string>();
    // Vindo de Transportadoras ("Cadastrar" numa linha da conta): abre o formulário já preenchido.
    const [editing, setEditing] = useState<Editing | undefined>(() => {
        if (typeof window === 'undefined') return undefined;
        const params = new URLSearchParams(window.location.search);
        const code = params.get('westlink');
        if (!code) return undefined;
        return {
            type: 'line',
            line: null,
            preset: { integration: 'WESTLINK', code, originalName: params.get('nome') ?? undefined },
        };
    });

    const load = useCallback(() => {
        api<ShippingTable>('/shipping-table')
            .then((loaded) => {
                setTable(loaded);
                setError(undefined);
            })
            .catch((err) => setError(err instanceof ApiError ? err.message : t('common.errors.generic')));
    }, [t]);

    useEffect(() => {
        load();
        if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
    }, [load]);

    const modalityNames = useMemo(
        () => new Map((table?.modalities ?? []).map((modality) => [modality.id, modality.name])),
        [table],
    );

    // Linhas agrupadas por modalidade, na ordem das modalidades; uso interno no fim.
    const groups = useMemo(() => {
        if (!table) return [];
        const byModality = table.modalities.map((modality) => ({
            key: modality.id,
            title: modality.name,
            lines: table.lines.filter((line) => line.modalityId === modality.id),
        }));
        const internal = table.lines.filter((line) => !line.modalityId);
        return [
            ...byModality.filter((group) => group.lines.length > 0),
            ...(internal.length > 0
                ? [{ key: 'internal', title: t('shippingTable.lines.noModality'), lines: internal }]
                : []),
        ];
    }, [table, t]);

    function saved() {
        setEditing(undefined);
        notify({ tone: 'success', title: t('shippingTable.page.saved') });
        load();
    }

    const markup = table ? `${(table.markupBasisPoints / 100).toLocaleString('pt-BR')}%` : '';

    return (
        <div className="grid gap-6">
            <FreightTabs />
            <PageHeader
                description={t('shippingTable.page.description', { markup })}
                title={t('shippingTable.page.title')}
                actions={
                    canWrite && table ? (
                        <div className="flex flex-wrap gap-2">
                            <Button
                                leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                                onClick={() => setEditing({ type: 'modality', modality: null })}
                                size="small"
                                variant="secondary"
                            >
                                {t('shippingTable.page.newModality')}
                            </Button>
                            <Button
                                leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                                onClick={() => setEditing({ type: 'line', line: null })}
                                size="small"
                            >
                                {t('shippingTable.page.newLine')}
                            </Button>
                        </div>
                    ) : undefined
                }
            />

            {error && (
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            )}
            {!canWrite && table && (
                <Alert tone="info" title={t('shippingTable.page.title')}>
                    <p>{t('shippingTable.page.readOnly')}</p>
                </Alert>
            )}
            {!table && !error && <SkeletonCards label={t('shippingTable.page.title')} />}

            {table && (
                <SectionCard
                    description={t('shippingTable.modalities.hint')}
                    flush
                    icon={<Layers aria-hidden="true" />}
                    title={t('shippingTable.modalities.title')}
                >
                    {table.modalities.length === 0 ? (
                        <div className="p-4">
                            <EmptyState title={t('shippingTable.modalities.empty')} />
                        </div>
                    ) : (
                        <ul className="m-0 list-none p-0">
                            {table.modalities.map((modality) => (
                                <li
                                    className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0 dark:border-night-line"
                                    key={modality.id}
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="m-0 flex flex-wrap items-center gap-2 font-semibold text-ink dark:text-night-text">
                                            {modality.name}
                                            <span className="mm-data text-xs font-normal text-muted dark:text-night-muted">
                                                {modality.code}
                                            </span>
                                            <StatusPill tone={modality.isActive ? 'success' : 'neutral'}>
                                                {modality.isActive
                                                    ? t('shippingTable.status.active')
                                                    : t('shippingTable.status.inactive')}
                                            </StatusPill>
                                        </p>
                                        {modality.description && (
                                            <p className="m-0 mt-0.5 text-sm text-muted dark:text-night-muted">
                                                {modality.description}
                                            </p>
                                        )}
                                    </div>
                                    <span
                                        className={`text-xs ${
                                            modality.activeLineCount === 0
                                                ? 'font-semibold text-amber-700 dark:text-night-warning'
                                                : 'text-muted dark:text-night-muted'
                                        }`}
                                    >
                                        {modality.activeLineCount === 0
                                            ? t('shippingTable.modalities.noLines')
                                            : t('shippingTable.modalities.lines', {
                                                  active: modality.activeLineCount,
                                                  total: modality.lineCount,
                                              })}
                                    </span>
                                    {canWrite && (
                                        <Button
                                            onClick={() => setEditing({ type: 'modality', modality })}
                                            size="small"
                                            variant="ghost"
                                        >
                                            {t('shippingTable.page.edit')}
                                        </Button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </SectionCard>
            )}

            {table && <ShippingTableSimulator modalityNames={modalityNames} />}

            {table && (
                <SectionCard
                    description={t('shippingTable.lines.hint')}
                    flush
                    icon={<Truck aria-hidden="true" />}
                    title={t('shippingTable.lines.title')}
                >
                    {table.lines.length === 0 ? (
                        <div className="p-4">
                            <EmptyState title={t('shippingTable.lines.empty')} />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[52rem] border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-line text-left text-xs text-muted dark:border-night-line dark:text-night-muted">
                                        <th className="px-4 py-2 font-semibold">{t('shippingTable.lines.code')}</th>
                                        <th className="px-4 py-2 font-semibold">{t('shippingTable.lines.price')}</th>
                                        <th className="px-4 py-2 font-semibold">{t('shippingTable.lines.weight')}</th>
                                        <th className="px-4 py-2 font-semibold">{t('shippingTable.lines.days')}</th>
                                        <th className="px-4 py-2 font-semibold">{t('shippingTable.lines.updated')}</th>
                                        <th className="px-4 py-2" />
                                    </tr>
                                </thead>
                                {groups.map((group) => (
                                    <tbody key={group.key}>
                                        <tr className="bg-background dark:bg-night-soft">
                                            <th
                                                className="px-4 py-1.5 text-left text-xs font-semibold text-muted uppercase dark:text-night-muted"
                                                colSpan={6}
                                                scope="rowgroup"
                                            >
                                                {group.title}
                                            </th>
                                        </tr>
                                        {group.lines.map((line) => (
                                            <tr
                                                className="border-b border-line align-top last:border-0 dark:border-night-line"
                                                key={line.id}
                                            >
                                                <th className="px-4 py-2 text-left font-normal" scope="row">
                                                    <span className="mm-data font-semibold text-ink dark:text-night-text">
                                                        {line.code}
                                                    </span>{' '}
                                                    <span className="text-ink dark:text-night-text">{line.name}</span>
                                                    <span className="mt-1 flex flex-wrap gap-1">
                                                        {!line.isActive && (
                                                            <StatusPill tone="neutral">
                                                                {t('shippingTable.status.inactive')}
                                                            </StatusPill>
                                                        )}
                                                        {line.isPreferred && (
                                                            <StatusPill tone="success">
                                                                {t('shippingTable.status.preferred')}
                                                            </StatusPill>
                                                        )}
                                                        {line.supplierName && (
                                                            <StatusPill tone="neutral" hideDot>
                                                                {line.supplierName}
                                                            </StatusPill>
                                                        )}
                                                        {line.integration && (
                                                            <StatusPill tone="info" hideDot>
                                                                {t('shippingTable.lines.api')}
                                                            </StatusPill>
                                                        )}
                                                    </span>
                                                </th>
                                                <td className="mm-data px-4 py-2">{summarize(line.pricing)}</td>
                                                <td className="mm-data px-4 py-2 whitespace-nowrap">
                                                    {kilograms(line.maxWeightGrams)}
                                                    {line.volumetricDivisor ? ` · ÷${line.volumetricDivisor}` : ''}
                                                </td>
                                                <td className="px-4 py-2 whitespace-nowrap">
                                                    {t('carrier.channel.daysValue', {
                                                        min: line.daysMin,
                                                        max: line.daysMax,
                                                    })}
                                                </td>
                                                <td className="px-4 py-2 whitespace-nowrap text-muted dark:text-night-muted">
                                                    {line.ratesUpdatedAt
                                                        ? new Date(line.ratesUpdatedAt).toLocaleDateString('pt-BR')
                                                        : t('common.dash')}
                                                </td>
                                                <td className="px-4 py-2 text-right whitespace-nowrap">
                                                    {canWrite && line.integration === 'WESTLINK' && (
                                                        <Button
                                                            onClick={() => setEditing({ type: 'api', line })}
                                                            size="small"
                                                            variant="ghost"
                                                        >
                                                            {t('shippingTable.api.check')}
                                                        </Button>
                                                    )}
                                                    {canWrite && (
                                                        <Button
                                                            onClick={() => setEditing({ type: 'line', line })}
                                                            size="small"
                                                            variant="ghost"
                                                        >
                                                            {t('shippingTable.page.edit')}
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                ))}
                            </table>
                        </div>
                    )}
                </SectionCard>
            )}

            {table && editing?.type === 'modality' && (
                <ModalityDialog
                    modality={editing.modality}
                    nextPosition={(table.modalities[table.modalities.length - 1]?.position ?? 0) + 1}
                    onClose={() => setEditing(undefined)}
                    onSaved={saved}
                />
            )}
            {table && editing?.type === 'line' && (
                <RateLineDialog
                    line={editing.line}
                    onClose={() => setEditing(undefined)}
                    onSaved={saved}
                    preset={editing.preset}
                    table={table}
                />
            )}
            {table && editing?.type === 'api' && (
                <ApiCheckDialog
                    configured={table.westlinkConfigured}
                    line={editing.line}
                    onChanged={() => load()}
                    onClose={() => setEditing(undefined)}
                />
            )}
        </div>
    );
}
