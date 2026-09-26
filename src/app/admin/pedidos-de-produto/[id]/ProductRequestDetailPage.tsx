'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ExternalLink, MessageSquare, Pencil } from 'lucide-react';
import { ActionBar } from '@/components/admin/ActionBar';
import { Alert } from '@/components/admin/Alert';
import { MessageThread } from '@/components/admin/MessageThread';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { productRequestStatusTone, StatusPill } from '@/components/admin/StatusPill';
import { SummaryList } from '@/components/admin/SummaryList';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { refreshPendingCounts } from '@/services/admin/pending-counts';
import { api } from '@/services/api';
import { formatDate, productRequestStatusLabel, type AdminProductRequest } from '@/types/api';
import { ProductRequestStatusDialog } from '../ProductRequestStatusDialog';

/**
 * Um "traga esse produto" com a conversa ao lado. É aqui que a equipe
 * pergunta o que a descrição não diz antes de decidir o status.
 */
export function ProductRequestDetailPage() {
    const { t } = useTranslation();
    const { notify } = useToast();
    const params = useParams<{ id: string }>();
    const [request, setRequest] = useState<AdminProductRequest>();
    const [error, setError] = useState<string>();
    const [editing, setEditing] = useState(false);

    const load = useCallback(() => {
        api<AdminProductRequest>(`/product-requests/${params.id}`)
            .then((data) => {
                setRequest(data);
                setError(undefined);
            })
            .catch(() => setError(t('productRequests.error')));
    }, [params.id, t]);

    useEffect(() => {
        load();
    }, [load]);

    const header = {
        backHref: '/admin/pedidos-de-produto',
        backLabel: t('productRequests.detail.backLink'),
    };

    if (error) {
        return (
            <div className="grid gap-6">
                <PageHeader {...header} title={t('productRequests.detail.titleFallback')} />
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            </div>
        );
    }

    if (!request) {
        return (
            <div className="grid gap-6">
                <PageHeader {...header} title={t('productRequests.detail.loading')} />
                <SkeletonCards label={t('productRequests.detail.loading')} />
            </div>
        );
    }

    return (
        <div className="grid gap-6">
            <PageHeader
                {...header}
                badge={
                    <StatusPill tone={productRequestStatusTone(request.status)}>
                        {productRequestStatusLabel(request.status)}
                    </StatusPill>
                }
                kicker={t('productRequests.detail.titleFallback')}
                title={`#${request.id.slice(0, 8)}`}
                meta={
                    <>
                        <Link
                            className="font-semibold text-primary no-underline hover:underline dark:text-night-accent"
                            href={`/admin/usuarios/${request.userId}`}
                        >
                            {request.userName ?? request.userId.slice(0, 8)}
                        </Link>
                        {request.userEmail ? ` · ${request.userEmail}` : ''}
                    </>
                }
            />

            <ActionBar
                description={t('productRequests.detail.actionBarDescription')}
                title={t('productRequests.detail.actionBarTitle', {
                    status: productRequestStatusLabel(request.status),
                })}
            >
                <Button
                    leadingIcon={<Pencil className="h-4 w-4" aria-hidden="true" />}
                    onClick={() => setEditing(true)}
                    size="small"
                    variant="secondary"
                >
                    {t('productRequests.updateButton')}
                </Button>
            </ActionBar>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
                <div className="grid min-w-0 gap-5">
                    <SectionCard title={t('productRequests.detail.requestSection')}>
                        <p className="m-0 text-sm leading-relaxed whitespace-pre-wrap text-ink dark:text-night-text">
                            {request.description}
                        </p>
                        {request.referenceUrl && (
                            <a
                                className="mt-3 inline-flex max-w-full items-center gap-1 text-sm text-primary no-underline hover:underline dark:text-night-accent"
                                href={request.referenceUrl}
                                rel="noopener noreferrer"
                                target="_blank"
                            >
                                <span className="truncate">{request.referenceUrl}</span>
                                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            </a>
                        )}
                    </SectionCard>

                    <SectionCard
                        description={t('productRequests.detail.messagesDescription')}
                        icon={<MessageSquare aria-hidden="true" />}
                        title={t('messages.title')}
                    >
                        <MessageThread endpoint={`/product-requests/${request.id}/messages`} />
                    </SectionCard>
                </div>

                <div className="grid min-w-0 gap-5">
                    <SectionCard dense title={t('productRequests.detail.summarySection')}>
                        <SummaryList
                            rows={[
                                {
                                    label: t('productRequests.detail.fields.status'),
                                    value: productRequestStatusLabel(request.status),
                                },
                                {
                                    label: t('productRequests.detail.fields.createdAt'),
                                    value: formatDate(request.createdAt),
                                },
                                {
                                    label: t('productRequests.detail.fields.updatedAt'),
                                    value: formatDate(request.updatedAt),
                                },
                                {
                                    label: t('productRequests.detail.fields.note'),
                                    value: request.adminNote || t('common.dash'),
                                },
                            ]}
                        />
                    </SectionCard>
                </div>
            </div>

            <ProductRequestStatusDialog
                onCancel={() => setEditing(false)}
                onUpdated={(updated) => {
                    setRequest(updated);
                    setEditing(false);
                    notify({ tone: 'success', title: t('productRequests.feedback.updated') });
                    void refreshPendingCounts();
                }}
                request={editing ? request : undefined}
            />
        </div>
    );
}
