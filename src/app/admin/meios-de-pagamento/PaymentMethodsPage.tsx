'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { CreditCard, QrCode, UserMinus, UserPlus } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { StatusPill, type StatusTone } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import {
    PAYMENT_METHOD_ACCESS_MODES,
    cny,
    brl,
    formatDate,
    type AdminPaymentMethod,
    type PaymentMethodAccessMode,
} from '@/types/api';

const MODE_TONES: Record<PaymentMethodAccessMode, StatusTone> = {
    ENABLED: 'success',
    DISABLED: 'neutral',
    ONLY_LISTED: 'info',
    EXCEPT_LISTED: 'warning',
};

/**
 * A chave de cada meio de pagamento da recarga. Serve para soltar o cartão
 * aos poucos — primeiro para a equipe, depois para alguns clientes, depois
 * para todos — e para tirar um meio do ar, ou de um cliente, sem deploy.
 *
 * A lista de clientes muda de sentido com o modo: em "só para alguns" são os
 * liberados, em "todos menos alguns" os bloqueados. Nos outros modos ela
 * continua guardada para a próxima troca, sem efeito.
 */
export function PaymentMethodsPage() {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [methods, setMethods] = useState<AdminPaymentMethod[]>();
    const [error, setError] = useState<string>();

    const load = useCallback(() => {
        api<AdminPaymentMethod[]>('/payment-methods')
            .then((fresh) => {
                setMethods(fresh);
                setError(undefined);
            })
            .catch((err) =>
                setError(
                    err instanceof ApiError && err.status === 403
                        ? t('paymentMethods.forbidden')
                        : t('paymentMethods.error'),
                ),
            );
    }, [t]);

    useEffect(() => {
        load();
    }, [load]);

    /** Toda mudança devolve a lista inteira já atualizada. */
    async function mutate(request: Promise<AdminPaymentMethod[]>) {
        try {
            setMethods(await request);
            notify({ tone: 'success', title: t('paymentMethods.saved') });
        } catch (err) {
            notify({
                tone: 'danger',
                title: t('paymentMethods.saveError'),
                description: err instanceof ApiError ? err.message : undefined,
            });
            throw err;
        }
    }

    return (
        <div className="grid gap-6">
            <PageHeader
                description={t('paymentMethods.description')}
                kicker={t('paymentMethods.kicker')}
                title={t('paymentMethods.title')}
            />

            {error && (
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            )}

            {!methods && !error && (
                <p className="m-0 text-sm text-muted dark:text-night-muted">{t('paymentMethods.loading')}</p>
            )}

            {methods?.map((method) => (
                <MethodCard
                    key={method.method}
                    method={method}
                    onMode={(accessMode) =>
                        mutate(
                            api<AdminPaymentMethod[]>(`/payment-methods/${method.method}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ accessMode }),
                            }),
                        )
                    }
                    onAdd={(email) =>
                        mutate(
                            api<AdminPaymentMethod[]>(`/payment-methods/${method.method}/users`, {
                                method: 'POST',
                                body: JSON.stringify({ email }),
                            }),
                        )
                    }
                    onRemove={(userId) =>
                        mutate(
                            api<AdminPaymentMethod[]>(`/payment-methods/${method.method}/users/${userId}`, {
                                method: 'DELETE',
                            }),
                        )
                    }
                />
            ))}
        </div>
    );
}

function MethodCard({
    method,
    onMode,
    onAdd,
    onRemove,
}: {
    method: AdminPaymentMethod;
    onMode: (mode: PaymentMethodAccessMode) => Promise<void>;
    onAdd: (email: string) => Promise<void>;
    onRemove: (userId: string) => Promise<void>;
}) {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);
    const [email, setEmail] = useState('');

    const fee = [
        method.feeBasisPoints > 0
            ? `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(method.feeBasisPoints / 100)}%`
            : null,
        Number(method.feeFixedMinor) > 0 ? brl(method.feeFixedMinor) : null,
    ]
        .filter(Boolean)
        .join(' + ');

    const listActive = method.accessMode === 'ONLY_LISTED' || method.accessMode === 'EXCEPT_LISTED';
    const listTitle =
        method.accessMode === 'ONLY_LISTED'
            ? t('paymentMethods.listTitleOnly')
            : method.accessMode === 'EXCEPT_LISTED'
              ? t('paymentMethods.listTitleExcept')
              : t('paymentMethods.listTitleInactive');

    async function run(action: () => Promise<void>) {
        setBusy(true);
        try {
            await action();
            return true;
        } catch {
            return false;
        } finally {
            setBusy(false);
        }
    }

    async function add(event: FormEvent) {
        event.preventDefault();
        if (!email.trim()) return;
        if (await run(() => onAdd(email.trim()))) setEmail('');
    }

    const Icon = method.method === 'CARD' ? CreditCard : QrCode;

    return (
        <SectionCard
            icon={<Icon className="h-4 w-4" aria-hidden="true" />}
            title={t(`paymentMethods.names.${method.method}`)}
            action={
                <StatusPill tone={MODE_TONES[method.accessMode]}>
                    {t(`paymentMethods.modes.${method.accessMode}`)}
                </StatusPill>
            }
        >
            <div className="grid gap-5">
                <div className="grid gap-1 text-sm text-muted dark:text-night-muted">
                    <p className="m-0">{fee ? t('paymentMethods.fee', { fee }) : t('paymentMethods.noFee')}</p>
                    <p className="m-0">{t('paymentMethods.max', { max: cny(method.maxCreditAmountMinor) })}</p>
                    <p className="m-0">
                        <Link
                            className="text-primary no-underline hover:underline dark:text-night-accent"
                            href="/admin/configuracoes"
                        >
                            {t('paymentMethods.feeSource')}
                        </Link>
                    </p>
                    {method.method === 'CARD' && <p className="m-0">{t('paymentMethods.cardKeyNote')}</p>}
                </div>

                <Select
                    label={t('paymentMethods.modeLabel')}
                    value={method.accessMode}
                    disabled={busy}
                    hint={t(`paymentMethods.modeHints.${method.accessMode}`)}
                    options={PAYMENT_METHOD_ACCESS_MODES.map((mode) => ({
                        value: mode,
                        label: t(`paymentMethods.modes.${mode}`),
                    }))}
                    onChange={(event) => void run(() => onMode(event.target.value as PaymentMethodAccessMode))}
                />

                <div className={`grid gap-3 ${listActive ? '' : 'opacity-70'}`}>
                    <h3 className="m-0 text-sm font-semibold text-ink dark:text-night-text">
                        {listTitle} ({method.users.length})
                    </h3>

                    <form className="flex flex-wrap items-end gap-3" onSubmit={add}>
                        <Input
                            fieldClassName="min-w-0 flex-1"
                            label={t('paymentMethods.emailLabel')}
                            placeholder={t('paymentMethods.emailPlaceholder')}
                            type="email"
                            value={email}
                            disabled={busy}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                        <Button type="submit" disabled={busy || !email.trim()} loading={busy}>
                            <UserPlus className="h-4 w-4" aria-hidden="true" />
                            {t('paymentMethods.add')}
                        </Button>
                    </form>

                    {method.users.length === 0 ? (
                        <p className="m-0 text-sm text-muted dark:text-night-muted">{t('paymentMethods.listEmpty')}</p>
                    ) : (
                        <ul className="m-0 grid list-none gap-0 p-0">
                            {method.users.map((user) => (
                                <li
                                    className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-2.5 first:border-t-0 dark:border-night-line"
                                    key={user.userId}
                                >
                                    <span className="min-w-0">
                                        <Link
                                            className="block text-sm font-semibold text-primary no-underline hover:underline dark:text-night-accent"
                                            href={`/admin/usuarios/${user.userId}`}
                                        >
                                            {user.name || user.email}
                                        </Link>
                                        <span className="block text-xs text-muted dark:text-night-subtle">
                                            {user.email} ·{' '}
                                            {t('paymentMethods.addedAt', { date: formatDate(user.addedAt) })}
                                        </span>
                                    </span>
                                    <Button
                                        size="small"
                                        variant="dangerGhost"
                                        disabled={busy}
                                        onClick={() => void run(() => onRemove(user.userId))}
                                    >
                                        <UserMinus className="h-4 w-4" aria-hidden="true" />
                                        {t('paymentMethods.remove')}
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </SectionCard>
    );
}
