'use client';

import { useEffect, useState } from 'react';
import { ActionDialog } from '@/components/admin/ActionDialog';
import { Alert } from '@/components/admin/Alert';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { brl, cny, type AdminTopUp, type AdminTopUpCheck } from '@/types/api';

type Decision = 'CREDIT' | 'CLOSE';

/**
 * Recarga parada em conferência: o que cobramos ao lado do que o provedor diz,
 * e as duas saídas. Creditar só aparece quando o backend diz que dá; as duas
 * pedem TOTP e motivo, e quem decide de fato é o backend, que confere de novo.
 */
export function TopUpReviewDialog({
    topUp,
    onClose,
    onDecided,
}: {
    topUp: AdminTopUp;
    onClose: () => void;
    onDecided: () => void;
}) {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [check, setCheck] = useState<AdminTopUpCheck>();
    const [error, setError] = useState<string>();
    const [decision, setDecision] = useState<Decision>();

    useEffect(() => {
        let active = true;
        api<AdminTopUpCheck>(`/finance/top-ups/${topUp.id}/provider-check`)
            .then((result) => active && setCheck(result))
            .catch((err: unknown) => {
                if (active) setError(err instanceof ApiError ? err.message : t('topUps.review.error'));
            });
        return () => {
            active = false;
        };
    }, [topUp.id, t]);

    if (decision)
        return (
            <ActionDialog
                open
                requireReason
                confirmLabel={t(`topUps.review.${decision === 'CREDIT' ? 'credit' : 'close'}`)}
                description={t(`topUps.review.${decision === 'CREDIT' ? 'creditDescription' : 'closeDescription'}`, {
                    credit: cny(topUp.creditAmountMinor),
                })}
                title={t(`topUps.review.${decision === 'CREDIT' ? 'creditTitle' : 'closeTitle'}`)}
                variant={decision === 'CLOSE' ? 'danger' : 'primary'}
                onCancel={() => setDecision(undefined)}
                onConfirm={async (values) => {
                    await api(`/finance/top-ups/${topUp.id}/decision`, {
                        method: 'POST',
                        body: JSON.stringify({ decision, totpCode: values.totpCode, reason: values.reason }),
                    });
                    notify({
                        tone: 'success',
                        title: t(decision === 'CREDIT' ? 'topUps.review.credited' : 'topUps.review.closed'),
                    });
                    onDecided();
                }}
            />
        );

    const stateLabel = (state: AdminTopUpCheck['state']): string =>
        ({
            PENDING: t('topUps.review.states.PENDING'),
            PAID: t('topUps.review.states.PAID'),
            EXPIRED: t('topUps.review.states.EXPIRED'),
            CANCELLED: t('topUps.review.states.CANCELLED'),
            REFUNDED: t('topUps.review.states.REFUNDED'),
            DISPUTED: t('topUps.review.states.DISPUTED'),
            FAILED: t('topUps.review.states.FAILED'),
            UNREACHABLE: t('topUps.review.states.UNREACHABLE'),
            NOT_OPENED: t('topUps.review.states.NOT_OPENED'),
        })[state];
    const money = (value: string | null, format: (minor: string) => string) =>
        value === null ? '—' : /^\d+$/.test(value) ? format(value) : value;
    const amountsDiffer =
        check?.state === 'PAID' &&
        ((check.providerAmountMinor !== null && check.providerAmountMinor !== check.expectedAmountMinor) ||
            (check.expectedYuanMinor !== null && check.providerYuanMinor !== check.expectedYuanMinor));

    return (
        <Modal
            open
            closeLabel={t('common.closeAria')}
            description={t('topUps.review.description', { customer: topUp.userName || topUp.userId.slice(0, 8) })}
            onClose={onClose}
            size="medium"
            title={t('topUps.review.title')}
            footer={
                <>
                    <Button onClick={onClose} variant="ghost">
                        {t('common.actions.cancel')}
                    </Button>
                    <Button disabled={!check} onClick={() => setDecision('CLOSE')} variant="danger">
                        {t('topUps.review.close')}
                    </Button>
                    <Button disabled={!check?.canCredit} onClick={() => setDecision('CREDIT')}>
                        {t('topUps.review.credit')}
                    </Button>
                </>
            }
        >
            <div className="grid gap-4">
                {error && (
                    <Alert tone="danger">
                        <p>{error}</p>
                    </Alert>
                )}
                {!check && !error && (
                    <p className="m-0 text-sm text-muted dark:text-night-muted" role="status">
                        {t('topUps.review.loading')}
                    </p>
                )}
                {check && (
                    <>
                        <dl className="m-0 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                            <Fact label={t('topUps.review.state')} value={stateLabel(check.state)} />
                            <Fact
                                label={t('topUps.review.payment')}
                                value={`${check.providerName ?? '—'} · ${check.providerPaymentId ?? '—'}`}
                            />
                            <Fact label={t('topUps.review.expected')} value={brl(check.expectedAmountMinor)} />
                            <Fact label={t('topUps.review.received')} value={money(check.providerAmountMinor, brl)} />
                            {check.expectedYuanMinor !== null && (
                                <>
                                    <Fact
                                        label={t('topUps.review.expectedYuan')}
                                        value={cny(check.expectedYuanMinor)}
                                    />
                                    <Fact
                                        label={t('topUps.review.receivedYuan')}
                                        value={money(check.providerYuanMinor, cny)}
                                    />
                                </>
                            )}
                        </dl>
                        {amountsDiffer && (
                            <Alert tone="warning">
                                <p>{t('topUps.review.differs', { credit: cny(topUp.creditAmountMinor) })}</p>
                            </Alert>
                        )}
                        {check.state === 'NOT_OPENED' && check.canCredit && (
                            <Alert tone="warning">
                                <p>{t('topUps.review.checkByHand', { provider: check.providerName ?? '—' })}</p>
                            </Alert>
                        )}
                        {!check.canCredit && (
                            <Alert tone="info">
                                <p>{t('topUps.review.cannotCredit')}</p>
                            </Alert>
                        )}
                    </>
                )}
            </div>
        </Modal>
    );
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid min-w-0 gap-0.5">
            <dt className="text-xs text-muted dark:text-night-subtle">{label}</dt>
            <dd className="m-0 font-semibold break-all text-ink dark:text-night-text">{value}</dd>
        </div>
    );
}
