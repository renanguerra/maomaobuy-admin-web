'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Contact, Plus, SearchX } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { EmptyState } from '@/components/admin/EmptyState';
import { FilterTabs } from '@/components/admin/FilterTabs';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { SectionCard } from '@/components/admin/SectionCard';
import { StatusPill } from '@/components/admin/StatusPill';
import { Toolbar } from '@/components/admin/Toolbar';
import { ButtonLink } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import { useAdminAccountAuth } from '@/services/auth/admin-account-auth';
import type { Page, SupplierKind, SupplierModality, SupplierStatus, SupplierSummary } from '@/types/api';
import {
    canWriteSuppliers,
    contactChannels,
    locationLabel,
    SUPPLIER_STATUS_TONES,
    SUPPLIER_STATUSES,
} from './supplier-format';

const LIMIT = 25;
const VISIBLE_MODALITIES = 3;

type KindFilter = 'all' | SupplierKind;

interface LoadedPage {
    key: string;
    page: Page<SupplierSummary>;
}

interface Failure {
    key: string;
    message: string;
}

/**
 * Agenda de fornecedores da equipe. Ativos no topo, descartados no fim: quem
 * não serve continua na lista para ninguém cotar com ele de novo sem saber.
 */
export function SuppliersListPage() {
    const { t } = useTranslation();
    const { admin } = useAdminAccountAuth();
    const [kind, setKind] = useState<KindFilter>('all');
    const [status, setStatus] = useState<'' | SupplierStatus>('');
    const [modality, setModality] = useState('');
    const [search, setSearch] = useState('');
    const [pageNumber, setPageNumber] = useState(1);
    const [loaded, setLoaded] = useState<LoadedPage>();
    const [failure, setFailure] = useState<Failure>();
    const [modalities, setModalities] = useState<SupplierModality[]>([]);

    const queryKey = `${pageNumber}|${kind}|${status}|${modality}|${search}`;
    const result = loaded?.key === queryKey ? loaded.page : undefined;
    const error = failure?.key === queryKey ? failure.message : undefined;
    const loading = !result && !error;
    const filtered = kind !== 'all' || status !== '' || modality !== '' || search !== '';

    useEffect(() => {
        let active = true;
        const key = `${pageNumber}|${kind}|${status}|${modality}|${search}`;
        const query = new URLSearchParams({ page: String(pageNumber), limit: String(LIMIT) });
        if (kind !== 'all') query.set('kind', kind);
        if (status) query.set('status', status);
        if (modality) query.set('modality', modality);
        if (search) query.set('search', search);

        api<Page<SupplierSummary>>(`/suppliers?${query.toString()}`)
            .then((page) => {
                if (active) setLoaded({ key, page });
            })
            .catch(() => {
                if (active) setFailure({ key, message: t('suppliers.error') });
            });

        return () => {
            active = false;
        };
    }, [pageNumber, kind, status, modality, search, t]);

    useEffect(() => {
        api<SupplierModality[]>('/suppliers/modalities')
            .then(setModalities)
            .catch(() => setModalities([]));
    }, []);

    const modalityOptions = useMemo(() => {
        const names = modalities.filter((item) => kind === 'all' || item.kind === kind).map((item) => item.modality);
        return [...new Set(names)].sort((a, b) => a.localeCompare(b)).map((name) => ({ value: name, label: name }));
    }, [modalities, kind]);

    const handleSearch = useCallback((term: string) => {
        setSearch(term);
        setPageNumber(1);
    }, []);

    const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

    const columns: DataTableColumn<SupplierSummary>[] = [
        {
            key: 'supplier',
            header: t('suppliers.columns.supplier'),
            cell: (supplier) => (
                <span className="block min-w-0">
                    <Link
                        className="block text-sm font-semibold text-primary no-underline hover:underline dark:text-night-accent"
                        href={`/admin/fornecedores/${supplier.id}`}
                    >
                        {supplier.name}
                    </Link>
                    {locationLabel(supplier.city, supplier.country) && (
                        <span className="mt-0.5 block text-xs text-muted dark:text-night-muted">
                            {locationLabel(supplier.city, supplier.country)}
                        </span>
                    )}
                    {supplier.supplies && (
                        <span className="mt-0.5 line-clamp-2 block max-w-md min-w-48 text-xs text-muted dark:text-night-muted">
                            {supplier.supplies}
                        </span>
                    )}
                </span>
            ),
        },
        {
            key: 'kind',
            header: t('suppliers.columns.kind'),
            cell: (supplier) => (
                <StatusPill hideDot tone={supplier.kind === 'SHIPPING' ? 'info' : 'neutral'}>
                    {t(`suppliers.kinds.${supplier.kind}`)}
                </StatusPill>
            ),
        },
        {
            key: 'modalities',
            header: t('suppliers.columns.modalities'),
            hideBelow: 'md',
            cell: (supplier) =>
                supplier.modalities.length === 0 ? (
                    <span className="text-xs text-muted dark:text-night-muted">—</span>
                ) : (
                    <span className="flex max-w-xs flex-wrap gap-1">
                        {supplier.modalities.slice(0, VISIBLE_MODALITIES).map((name) => (
                            <span
                                className="rounded-md border border-line px-1.5 py-0.5 text-[11px] text-ink dark:border-night-line dark:text-night-text"
                                key={name}
                            >
                                {name}
                            </span>
                        ))}
                        {supplier.modalities.length > VISIBLE_MODALITIES && (
                            <span className="px-1 py-0.5 text-[11px] text-muted dark:text-night-muted">
                                {t('suppliers.moreModalities', {
                                    count: supplier.modalities.length - VISIBLE_MODALITIES,
                                })}
                            </span>
                        )}
                    </span>
                ),
        },
        {
            key: 'contact',
            header: t('suppliers.columns.contact'),
            hideBelow: 'lg',
            cell: (supplier) =>
                supplier.mainContact ? (
                    <span className="block min-w-0 text-sm">
                        <span className="block truncate text-ink dark:text-night-text">
                            {supplier.mainContact.name}
                            {supplier.mainContact.role && (
                                <span className="text-muted dark:text-night-muted"> · {supplier.mainContact.role}</span>
                            )}
                        </span>
                        <span className="block truncate text-xs text-muted dark:text-night-muted">
                            {contactChannels(supplier.mainContact)}
                            {supplier.contactCount > 1 &&
                                ` · ${t('suppliers.moreContacts', { count: supplier.contactCount - 1 })}`}
                        </span>
                    </span>
                ) : (
                    <span className="text-xs text-muted dark:text-night-muted">{t('suppliers.noContact')}</span>
                ),
        },
        {
            key: 'status',
            header: t('suppliers.columns.status'),
            cell: (supplier) => (
                <StatusPill tone={SUPPLIER_STATUS_TONES[supplier.status]}>
                    {t(`suppliers.statuses.${supplier.status}`)}
                </StatusPill>
            ),
        },
    ];

    return (
        <div className="grid gap-6">
            <PageHeader
                actions={
                    canWriteSuppliers(admin?.role) && (
                        <ButtonLink
                            href="/admin/fornecedores/novo"
                            leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                        >
                            {t('suppliers.newSupplier')}
                        </ButtonLink>
                    )
                }
                description={t('suppliers.description')}
                kicker={t('suppliers.kicker')}
                title={t('suppliers.title')}
            />

            <FilterTabs
                label={t('suppliers.kindFilterLabel')}
                onChange={(value) => {
                    setKind(value);
                    setModality('');
                    setPageNumber(1);
                }}
                options={[
                    { value: 'all', label: t('suppliers.kindFilters.all') },
                    { value: 'PRODUCT', label: t('suppliers.kindFilters.PRODUCT') },
                    { value: 'SHIPPING', label: t('suppliers.kindFilters.SHIPPING') },
                ]}
                value={kind}
            />

            {error && (
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            )}

            <SectionCard flush>
                <Toolbar>
                    <SearchInput
                        className="min-w-0 flex-1 sm:min-w-64"
                        clearLabel={t('common.actions.clearSearch')}
                        label={t('suppliers.searchLabel')}
                        onChange={handleSearch}
                        placeholder={t('suppliers.searchPlaceholder')}
                        value={search}
                    />
                    <Select
                        fieldClassName="w-full sm:w-48"
                        hideLabel
                        label={t('suppliers.statusFilter')}
                        onChange={(event) => {
                            setStatus(event.target.value as '' | SupplierStatus);
                            setPageNumber(1);
                        }}
                        options={SUPPLIER_STATUSES.map((value) => ({
                            value,
                            label: t(`suppliers.statuses.${value}`),
                        }))}
                        placeholderOption={t('suppliers.allStatuses')}
                        value={status}
                    />
                    {modalityOptions.length > 0 && (
                        <Select
                            fieldClassName="w-full sm:w-52"
                            hideLabel
                            label={t('suppliers.modalityFilter')}
                            onChange={(event) => {
                                setModality(event.target.value);
                                setPageNumber(1);
                            }}
                            options={modalityOptions}
                            placeholderOption={t('suppliers.allModalities')}
                            value={modality}
                        />
                    )}
                </Toolbar>

                <DataTable
                    caption={t('suppliers.tableCaption')}
                    columns={columns}
                    empty={
                        filtered ? (
                            <EmptyState icon={SearchX} title={t('suppliers.emptyFiltered')} />
                        ) : (
                            <EmptyState icon={Contact} title={t('suppliers.empty')} />
                        )
                    }
                    loading={loading}
                    loadingLabel={t('common.loading')}
                    minWidth="52rem"
                    rowKey={(supplier) => supplier.id}
                    rows={result?.data ?? []}
                />

                {result && result.data.length > 0 && (
                    <Pagination
                        disabled={loading}
                        nextLabel={t('common.pagination.next')}
                        onChange={setPageNumber}
                        page={pageNumber}
                        previousLabel={t('common.pagination.previous')}
                        summary={`${t('common.pagination.page', { page: pageNumber, total: totalPages })} · ${t('suppliers.countUnit', { count: result.total })}`}
                        totalPages={totalPages}
                    />
                )}
            </SectionCard>
        </div>
    );
}
