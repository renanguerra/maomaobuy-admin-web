'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ActionDialog } from '@/components/admin/ActionDialog';
import { Alert } from '@/components/admin/Alert';
import { DescriptionList } from '@/components/admin/DescriptionList';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { formatCnpj, formatDate, formatPhone, type WholesaleApplication } from '@/types/api';
import { blocksApproval, cnpjLookupTone, formatIsoDay, readCnpjLookup, wholesaleStatusTone } from '../wholesale-format';

type Dialog = 'approve' | 'reject' | 'request-info' | null;

/**
 * Uma solicitação de lojista: os dados da empresa, a consulta de CNPJ (que só
 * avisa) e as três decisões. Recusa e pedido de correção levam texto, porque
 * o cliente lê.
 */
export function WholesaleApplicationDetailPage() {
    const params = useParams<{ id: string }>();
    const { t } = useTranslation();
    const { notify } = useToast();
    const [application, setApplication] = useState<WholesaleApplication>();
    const [error, setError] = useState<string>();
    const [dialog, setDialog] = useState<Dialog>(null);
    const [lookingUp, setLookingUp] = useState(false);

    const load = useCallback(() => {
        api<WholesaleApplication>(`/wholesale-applications/${params.id}`)
            .then((loaded) => {
                setApplication(loaded);
                setError(undefined);
            })
            .catch((err) =>
                setError(
                    err instanceof ApiError && err.status === 404
                        ? t('wholesale.detail.notFound')
                        : t('wholesale.error'),
                ),
            );
    }, [params.id, t]);

    useEffect(() => {
        load();
    }, [load]);

    async function decide(action: Exclude<Dialog, null>, values: { totpCode: string; reason: string }) {
        const updated = await api<WholesaleApplication>(`/wholesale-applications/${params.id}/${action}`, {
            method: 'POST',
            body: JSON.stringify(action === 'approve' && !values.reason ? { totpCode: values.totpCode } : values),
        });
        setApplication(updated);
        setDialog(null);
        notify({
            tone: 'success',
            title: t(
                action === 'approve'
                    ? 'wholesale.feedback.approved'
                    : action === 'reject'
                      ? 'wholesale.feedback.rejected'
                      : 'wholesale.feedback.infoRequested',
            ),
        });
    }

    async function refreshLookup() {
        setLookingUp(true);
        try {
            const updated = await api<WholesaleApplication>(`/wholesale-applications/${params.id}/cnpj-lookup`, {
                method: 'POST',
            });
            setApplication(updated);
            notify({ tone: 'success', title: t('wholesale.feedback.lookupRefreshed') });
        } catch (err) {
            notify({
                tone: 'danger',
                title: t('common.errors.actionTitle'),
                description: err instanceof ApiError ? err.message : t('common.errors.generic'),
            });
        } finally {
            setLookingUp(false);
        }
    }

    if (error)
        return (
            <div className="grid gap-6">
                <PageHeader
                    backHref="/admin/lojistas"
                    backLabel={t('wholesale.detail.back')}
                    title={t('wholesale.detail.kicker')}
                />
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            </div>
        );

    if (!application)
        return (
            <div className="grid gap-6">
                <PageHeader
                    backHref="/admin/lojistas"
                    backLabel={t('wholesale.detail.back')}
                    title={t('common.loading')}
                />
                <SkeletonCards label={t('common.loading')} />
            </div>
        );

    const { status } = application;
    const open = status === 'PENDING' || status === 'NEEDS_INFO';
    const blocked = blocksApproval(application);
    const receita = readCnpjLookup(application.cnpjLookup);
    const yesNo = (value: boolean | null) =>
        value === null ? t('common.dash') : t(value ? 'wholesale.receita.yes' : 'wholesale.receita.no');

    return (
        <div className="grid gap-6">
            <PageHeader
                actions={
                    open ? (
                        <div className="flex flex-wrap gap-2">
                            <Button onClick={() => setDialog('reject')} variant="ghost">
                                {t('wholesale.actions.reject')}
                            </Button>
                            {status === 'PENDING' && (
                                <>
                                    <Button onClick={() => setDialog('request-info')} variant="secondary">
                                        {t('wholesale.actions.requestInfo')}
                                    </Button>
                                    <Button disabled={blocked} onClick={() => setDialog('approve')}>
                                        {t('wholesale.actions.approve')}
                                    </Button>
                                </>
                            )}
                        </div>
                    ) : undefined
                }
                backHref="/admin/lojistas"
                backLabel={t('wholesale.detail.back')}
                badge={<StatusPill tone={wholesaleStatusTone(status)}>{t(`wholesale.statuses.${status}`)}</StatusPill>}
                description={
                    <Link
                        className="text-primary no-underline hover:underline dark:text-night-accent"
                        href={`/admin/usuarios/${application.user.id}`}
                    >
                        {application.user.name} · {application.user.email}
                    </Link>
                }
                kicker={t('wholesale.detail.kicker')}
                title={application.tradeName ?? application.legalName}
            />

            {blocked && (
                <Alert tone="warning" title={t('wholesale.detail.influencerTitle')}>
                    <p>{t('wholesale.detail.influencerBody')}</p>
                    <p>
                        <Link className="font-semibold text-inherit underline" href="/admin/influencers">
                            {t('wholesale.detail.influencerLink')}
                        </Link>
                    </p>
                </Alert>
            )}

            {application.cnpjLookupStatus === 'ALERT' && (
                <Alert tone="danger" title={t('wholesale.detail.lookupAlertTitle')}>
                    {receita && receita.divergences.length > 0 ? (
                        <ul className="m-0 grid gap-1 pl-5">
                            {receita.divergences.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    ) : null}
                    <p>{t('wholesale.detail.lookupAlertBody')}</p>
                </Alert>
            )}

            {status === 'NEEDS_INFO' && application.infoRequest && (
                <Alert tone="info" title={t('wholesale.detail.infoRequested')}>
                    <p>{application.infoRequest}</p>
                </Alert>
            )}

            {(status === 'REJECTED' || status === 'REVOKED') && application.rejectionReason && (
                <Alert
                    tone="danger"
                    title={t(
                        status === 'REVOKED' ? 'wholesale.detail.revokedReason' : 'wholesale.detail.rejectedReason',
                    )}
                >
                    <p>{application.rejectionReason}</p>
                </Alert>
            )}

            <SectionCard title={t('wholesale.detail.company')}>
                <DescriptionList
                    items={[
                        { label: t('wholesale.fields.cnpj'), value: formatCnpj(application.cnpj), numeric: true },
                        { label: t('wholesale.fields.legalName'), value: application.legalName },
                        { label: t('wholesale.fields.tradeName'), value: application.tradeName ?? t('common.dash') },
                        {
                            label: t('wholesale.fields.stateRegistration'),
                            value: application.stateRegistration ?? t('common.dash'),
                        },
                        { label: t('wholesale.fields.contactName'), value: application.contactName },
                        {
                            label: t('wholesale.fields.phone'),
                            value: formatPhone(application.phoneE164),
                            numeric: true,
                        },
                        {
                            label: t('wholesale.fields.address'),
                            wide: true,
                            value: [
                                application.addressLine1,
                                application.addressLine2,
                                application.district,
                                `${application.locality}/${application.administrativeArea}`,
                                application.postalCode.replace(/^(\d{5})(\d{3})$/, '$1-$2'),
                            ]
                                .filter(Boolean)
                                .join(', '),
                        },
                    ]}
                />
            </SectionCard>

            <SectionCard
                action={
                    <Button disabled={lookingUp} onClick={refreshLookup} size="small" variant="secondary">
                        {lookingUp ? t('wholesale.actions.lookingUp') : t('wholesale.actions.refreshLookup')}
                    </Button>
                }
                title={t('wholesale.detail.review')}
            >
                <DescriptionList
                    items={[
                        { label: t('wholesale.fields.origin'), value: t(`wholesale.origins.${application.origin}`) },
                        {
                            label: t('wholesale.fields.submittedAt'),
                            value: formatDate(application.submittedAt),
                            numeric: true,
                        },
                        {
                            label: t('wholesale.fields.lookup'),
                            value: (
                                <StatusPill hideDot tone={cnpjLookupTone(application.cnpjLookupStatus)}>
                                    {t(`wholesale.lookupStatuses.${application.cnpjLookupStatus ?? 'PENDING'}`)}
                                </StatusPill>
                            ),
                        },
                        {
                            label: t('wholesale.fields.lookupAt'),
                            value: application.cnpjLookupAt ? formatDate(application.cnpjLookupAt) : t('common.dash'),
                            numeric: true,
                        },
                        {
                            label: t('wholesale.fields.reviewedBy'),
                            value: application.reviewedBy
                                ? `${application.reviewedBy.name} · ${formatDate(application.reviewedAt)}`
                                : t('common.dash'),
                        },
                    ]}
                />
                {application.cnpjLookupStatus === 'UNAVAILABLE' && (
                    <p className="m-0 mt-4 text-sm text-muted dark:text-night-muted">
                        {receita?.note ?? t('wholesale.detail.lookupManual')}
                    </p>
                )}
                {application.cnpjLookup && !receita && (
                    <pre className="mt-4 mb-0 max-h-64 overflow-auto rounded-lg border border-line p-3 text-xs dark:border-night-line">
                        {JSON.stringify(application.cnpjLookup, null, 2)}
                    </pre>
                )}
            </SectionCard>

            {receita?.found && (
                <SectionCard description={t('wholesale.receita.description')} title={t('wholesale.receita.title')}>
                    <DescriptionList
                        items={[
                            {
                                label: t('wholesale.receita.situation'),
                                value: [
                                    receita.situation ?? t('common.dash'),
                                    receita.situationDate
                                        ? t('wholesale.receita.since', {
                                              date: formatIsoDay(receita.situationDate) ?? '',
                                          })
                                        : null,
                                    receita.situationReason && receita.situationReason !== 'SEM MOTIVO'
                                        ? receita.situationReason
                                        : null,
                                ]
                                    .filter(Boolean)
                                    .join(' · '),
                            },
                            { label: t('wholesale.fields.legalName'), value: receita.legalName ?? t('common.dash') },
                            { label: t('wholesale.fields.tradeName'), value: receita.tradeName ?? t('common.dash') },
                            {
                                label: t('wholesale.receita.openedAt'),
                                value: formatIsoDay(receita.openedAt) ?? t('common.dash'),
                                numeric: true,
                            },
                            { label: t('wholesale.receita.size'), value: receita.size ?? t('common.dash') },
                            {
                                label: t('wholesale.receita.taxRegime'),
                                value: `${t('wholesale.receita.simples')}: ${yesNo(receita.simples)} · MEI: ${yesNo(receita.mei)}`,
                            },
                            { label: t('wholesale.receita.cnae'), value: receita.cnae ?? t('common.dash'), wide: true },
                            {
                                label: t('wholesale.receita.legalNature'),
                                value: receita.legalNature ?? t('common.dash'),
                                wide: true,
                            },
                            {
                                label: t('wholesale.fields.address'),
                                wide: true,
                                value:
                                    [
                                        receita.address,
                                        receita.city && receita.state
                                            ? `${receita.city}/${receita.state}`
                                            : (receita.city ?? receita.state),
                                        receita.postalCode?.replace(/^(\d{5})(\d{3})$/, '$1-$2'),
                                    ]
                                        .filter(Boolean)
                                        .join(', ') || t('common.dash'),
                            },
                            {
                                label: t('wholesale.receita.partners'),
                                wide: true,
                                value:
                                    receita.partners.length > 0
                                        ? receita.partners
                                              .map((partner) =>
                                                  partner.role ? `${partner.name} (${partner.role})` : partner.name,
                                              )
                                              .join('; ')
                                        : t('common.dash'),
                            },
                        ]}
                    />
                </SectionCard>
            )}

            <ActionDialog
                confirmLabel={t('wholesale.actions.approve')}
                description={t('wholesale.dialogs.approveDescription')}
                onCancel={() => setDialog(null)}
                onConfirm={(values) => decide('approve', values)}
                open={dialog === 'approve'}
                title={t('wholesale.dialogs.approveTitle')}
            />
            <ActionDialog
                confirmLabel={t('wholesale.actions.requestInfo')}
                description={t('wholesale.dialogs.requestInfoDescription')}
                onCancel={() => setDialog(null)}
                onConfirm={(values) => decide('request-info', values)}
                open={dialog === 'request-info'}
                requireReason
                title={t('wholesale.dialogs.requestInfoTitle')}
            />
            <ActionDialog
                confirmLabel={t('wholesale.actions.reject')}
                description={t('wholesale.dialogs.rejectDescription')}
                onCancel={() => setDialog(null)}
                onConfirm={(values) => decide('reject', values)}
                open={dialog === 'reject'}
                requireReason
                title={t('wholesale.dialogs.rejectTitle')}
                variant="danger"
            />
        </div>
    );
}
