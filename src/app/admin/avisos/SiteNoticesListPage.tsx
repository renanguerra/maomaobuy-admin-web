'use client';

import { useEffect, useState } from 'react';
import { Megaphone, Pencil } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { SectionCard } from '@/components/admin/SectionCard';
import { StatusPill, type StatusTone } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { formatDate, siteNoticeStatus, type Page, type SiteNotice, type SiteNoticeStatus } from '@/types/api';
import { SiteNoticeFormDialog, type SiteNoticeFormValues } from './SiteNoticeFormDialog';

const LIMIT = 20;

const STATUS_TONES: Record<SiteNoticeStatus, StatusTone> = {
    LIVE: 'success',
    OVERRIDDEN: 'warning',
    SCHEDULED: 'info',
    ENDED: 'neutral',
    INACTIVE: 'neutral',
};

type Editing = { notice?: SiteNotice } | null;

interface LoadedPage {
    key: string;
    page: Page<SiteNotice>;
}

interface Failure {
    key: string;
    message: string;
}

/**
 * Avisos que o site abre na entrada da loja. A lista guarda os antigos de
 * propósito: o aviso de feriado chinês volta todo ano, e reativar é mais
 * rápido do que escrever de novo.
 */
export function SiteNoticesListPage() {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [pageNumber, setPageNumber] = useState(1);
    const [loaded, setLoaded] = useState<LoadedPage>();
    const [failure, setFailure] = useState<Failure>();
    const [editing, setEditing] = useState<Editing>(null);
    const [version, setVersion] = useState(0);

    const queryKey = `${pageNumber}|${version}`;
    const result = loaded?.key === queryKey ? loaded.page : undefined;
    const error = failure?.key === queryKey ? failure.message : undefined;
    const loading = !result && !error;

    useEffect(() => {
        let active = true;
        const key = `${pageNumber}|${version}`;
        const query = new URLSearchParams({ page: String(pageNumber), limit: String(LIMIT) });

        api<Page<SiteNotice>>(`/site-notices?${query.toString()}`)
            .then((page) => {
                if (active) setLoaded({ key, page });
            })
            .catch((err) => {
                if (active)
                    setFailure({
                        key,
                        message:
                            err instanceof ApiError && err.status === 403
                                ? t('siteNotices.forbidden')
                                : t('siteNotices.error'),
                    });
            });

        return () => {
            active = false;
        };
    }, [pageNumber, version, t]);

    async function submit(values: SiteNoticeFormValues) {
        const existing = editing?.notice;
        await api(existing ? `/site-notices/${existing.id}` : '/site-notices', {
            method: existing ? 'PATCH' : 'POST',
            body: JSON.stringify(values),
        });
        notify({ tone: 'success', title: t(existing ? 'siteNotices.updatedFeedback' : 'siteNotices.createdFeedback') });
        setEditing(null);
        setVersion((current) => current + 1);
    }

    const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

    const columns: DataTableColumn<SiteNotice>[] = [
        {
            key: 'notice',
            header: t('siteNotices.columns.notice'),
            cell: (notice) => (
                <span className="block min-w-0">
                    <button
                        className="block cursor-pointer text-left text-sm font-semibold text-primary hover:underline dark:text-night-accent"
                        onClick={() => setEditing({ notice })}
                        type="button"
                    >
                        {notice.title}
                    </button>
                    <span className="mt-0.5 line-clamp-2 block max-w-xl text-xs text-muted dark:text-night-muted">
                        {notice.body}
                    </span>
                </span>
            ),
        },
        {
            key: 'frequency',
            header: t('siteNotices.columns.frequency'),
            hideBelow: 'md',
            cell: (notice) => (
                <span className="text-xs text-muted dark:text-night-muted">
                    {t(`siteNotices.frequencies.${notice.displayFrequency}`)}
                </span>
            ),
        },
        {
            key: 'window',
            header: t('siteNotices.columns.window'),
            hideBelow: 'lg',
            cell: (notice) => (
                <span className="text-xs text-muted dark:text-night-muted">
                    {notice.startsAt || notice.endsAt
                        ? [
                              notice.startsAt ? t('siteNotices.fromDate', { date: formatDate(notice.startsAt) }) : null,
                              notice.endsAt ? t('siteNotices.untilDate', { date: formatDate(notice.endsAt) }) : null,
                          ]
                              .filter(Boolean)
                              .join(' · ')
                        : t('siteNotices.noWindow')}
                </span>
            ),
        },
        {
            key: 'status',
            header: t('siteNotices.columns.status'),
            cell: (notice) => {
                const status = siteNoticeStatus(notice);
                return <StatusPill tone={STATUS_TONES[status]}>{t(`siteNotices.statuses.${status}`)}</StatusPill>;
            },
        },
        {
            key: 'actions',
            header: '',
            card: 'full',
            cell: (notice) => (
                <Button
                    aria-label={t('siteNotices.edit')}
                    iconOnly
                    onClick={() => setEditing({ notice })}
                    size="small"
                    variant="ghost"
                >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
            ),
        },
    ];

    return (
        <div className="grid gap-6">
            <PageHeader
                actions={<Button onClick={() => setEditing({})}>{t('siteNotices.newNotice')}</Button>}
                description={t('siteNotices.description')}
                kicker={t('siteNotices.kicker')}
                title={t('siteNotices.title')}
            />

            {error && (
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            )}

            <SectionCard flush>
                <DataTable
                    caption={t('siteNotices.tableCaption')}
                    columns={columns}
                    loading={loading}
                    loadingLabel={t('common.loading')}
                    minWidth="44rem"
                    rowKey={(notice) => notice.id}
                    rows={result?.data ?? []}
                    empty={<EmptyState icon={Megaphone} title={t('siteNotices.empty')} />}
                />

                {result && result.data.length > 0 && (
                    <Pagination
                        nextLabel={t('common.pagination.next')}
                        onChange={setPageNumber}
                        page={pageNumber}
                        previousLabel={t('common.pagination.previous')}
                        disabled={loading}
                        totalPages={totalPages}
                        summary={`${t('common.pagination.page', { page: pageNumber, total: totalPages })} · ${t('siteNotices.countUnit', { count: result.total })}`}
                    />
                )}
            </SectionCard>

            <SiteNoticeFormDialog
                notice={editing?.notice}
                onClose={() => setEditing(null)}
                onSubmit={submit}
                open={editing !== null}
            />
        </div>
    );
}
