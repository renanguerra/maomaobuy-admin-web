'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { CreditCard, QrCode, Repeat, UserMinus, UserPlus } from 'lucide-react';
import { ActionDialog } from '@/components/admin/ActionDialog';
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
import { useAdminAccountAuth } from '@/services/auth/admin-account-auth';
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
 *
 * Cada meio também diz qual provedor cobra. Trocar é do SUPERADMIN, com TOTP,
 * entre os provedores que o deploy ligou; a lista de piloto manda alguns
 * clientes para outro provedor antes de virar para todos.
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
                    onProvider={(body) =>
                        mutate(
                            api<AdminPaymentMethod[]>(`/payment-methods/${method.method}/provider`, {
                                method: 'PATCH',
                                body: JSON.stringify(body),
                            }),
                        )
                    }
                    onAddPilot={(email) =>
                        mutate(
                            api<AdminPaymentMethod[]>(`/payment-methods/${method.method}/pilot-users`, {
                                method: 'POST',
                                body: JSON.stringify({ email }),
                            }),
                        )
                    }
                    onRemovePilot={(userId) =>
                        mutate(
                            api<AdminPaymentMethod[]>(`/payment-methods/${method.method}/pilot-users/${userId}`, {
                                method: 'DELETE',
                            }),
                        )
                    }
                />
            ))}
        </div>
    );
}

interface ProviderChange {
    providerName: string;
    pilotProviderName: string | null;
    totpCode: string;
}

function MethodCard({
    method,
    onMode,
    onAdd,
    onRemove,
    onProvider,
    onAddPilot,
    onRemovePilot,
}: {
    method: AdminPaymentMethod;
    onMode: (mode: PaymentMethodAccessMode) => Promise<void>;
    onAdd: (email: string) => Promise<void>;
    onRemove: (userId: string) => Promise<void>;
    onProvider: (change: ProviderChange) => Promise<void>;
    onAddPilot: (email: string) => Promise<void>;
    onRemovePilot: (userId: string) => Promise<void>;
}) {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);

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
                    {method.method === 'CARD' && <InstallmentFees method={method} />}
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

                <UserList
                    active={listActive}
                    busy={busy}
                    title={listTitle}
                    users={method.users}
                    onAdd={(email) => run(() => onAdd(email))}
                    onRemove={(userId) => void run(() => onRemove(userId))}
                />

                <ProviderSection method={method} busy={busy} onProvider={onProvider} />

                <UserList
                    active={method.pilotProviderName !== null}
                    busy={busy}
                    title={
                        method.pilotProviderName
                            ? t('paymentMethods.provider.pilotListTitle')
                            : t('paymentMethods.provider.pilotListInactive')
                    }
                    users={method.pilotUsers}
                    onAdd={(email) => run(() => onAddPilot(email))}
                    onRemove={(userId) => void run(() => onRemovePilot(userId))}
                />
            </div>
        </SectionCard>
    );
}

/** Nome do provedor para a tela; um nome que a tradução não conhece aparece cru. */
function useProviderLabel() {
    const { t } = useTranslation();
    return (name: string) =>
        name === 'ABACATEPAY' || name === 'AIRWALLEX' ? t(`paymentMethods.providerNames.${name}`) : name;
}

/**
 * Quem cobra o meio. O SUPERADMIN troca, com TOTP; os outros papéis só leem.
 * O backend recusa provedor desligado ou sem taxa antes de pedir o código.
 */
function ProviderSection({
    method,
    busy,
    onProvider,
}: {
    method: AdminPaymentMethod;
    busy: boolean;
    onProvider: (change: ProviderChange) => Promise<void>;
}) {
    const { t } = useTranslation();
    const { admin } = useAdminAccountAuth();
    const label = useProviderLabel();
    const [open, setOpen] = useState(false);
    const canChange = admin?.role === 'SUPERADMIN';
    const options = [...new Set([...method.availableProviders, method.providerName])].map((name) => ({
        value: name,
        label: label(name),
    }));

    return (
        <div className="grid gap-2">
            <h3 className="m-0 text-sm font-semibold text-ink dark:text-night-text">
                {t('paymentMethods.provider.title')}
            </h3>
            <div className="grid gap-1 text-sm text-muted dark:text-night-muted">
                <p className="m-0">{t('paymentMethods.provider.current', { provider: label(method.providerName) })}</p>
                <p className="m-0">
                    {method.pilotProviderName
                        ? t('paymentMethods.provider.pilot', { provider: label(method.pilotProviderName) })
                        : t('paymentMethods.provider.noPilot')}
                </p>
            </div>
            {method.providerUnavailable && (
                <Alert tone="warning" title={label(method.providerName)}>
                    <p>{t('paymentMethods.provider.unavailable', { provider: label(method.providerName) })}</p>
                </Alert>
            )}
            {method.pilotProviderName && !method.availableProviders.includes(method.pilotProviderName) && (
                <Alert tone="warning" title={label(method.pilotProviderName)}>
                    <p>
                        {t('paymentMethods.provider.pilotUnavailable', {
                            provider: label(method.pilotProviderName),
                        })}
                    </p>
                </Alert>
            )}
            {canChange ? (
                <div>
                    <Button disabled={busy} onClick={() => setOpen(true)} variant="secondary">
                        <Repeat className="h-4 w-4" aria-hidden="true" />
                        {t('paymentMethods.provider.change')}
                    </Button>
                </div>
            ) : (
                <p className="m-0 text-xs text-muted dark:text-night-subtle">
                    {t('paymentMethods.provider.onlySuperadmin')}
                </p>
            )}
            <ActionDialog
                open={open}
                title={t('paymentMethods.provider.dialogTitle', {
                    method: t(`paymentMethods.names.${method.method}`),
                })}
                description={t('paymentMethods.provider.dialogDescription')}
                confirmLabel={t('paymentMethods.provider.confirm')}
                fields={[
                    {
                        name: 'providerName',
                        label: t('paymentMethods.provider.providerLabel'),
                        kind: 'select',
                        defaultValue: method.providerName,
                        options,
                        wide: true,
                    },
                    {
                        name: 'pilotProviderName',
                        label: t('paymentMethods.provider.pilotLabel'),
                        kind: 'select',
                        optional: true,
                        defaultValue: method.pilotProviderName ?? '',
                        hint: t('paymentMethods.provider.pilotHint'),
                        options: [{ value: '', label: t('paymentMethods.provider.noPilotOption') }, ...options],
                        wide: true,
                    },
                ]}
                onCancel={() => setOpen(false)}
                onConfirm={async (values) => {
                    // O erro do backend (provedor desligado, taxa faltando,
                    // código errado) aparece dentro do diálogo.
                    await onProvider({
                        providerName: values.providerName,
                        pilotProviderName: values.pilotProviderName || null,
                        totpCode: values.totpCode,
                    });
                    setOpen(false);
                }}
            />
        </div>
    );
}

/** Lista de clientes por e-mail: a do meio e a do piloto têm o mesmo jeito. */
function UserList({
    title,
    active,
    busy,
    users,
    onAdd,
    onRemove,
}: {
    title: string;
    active: boolean;
    busy: boolean;
    users: AdminPaymentMethod['users'];
    onAdd: (email: string) => Promise<boolean>;
    onRemove: (userId: string) => void;
}) {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');

    async function add(event: FormEvent) {
        event.preventDefault();
        if (!email.trim()) return;
        if (await onAdd(email.trim())) setEmail('');
    }

    return (
        <div className={`grid gap-3 ${active ? '' : 'opacity-70'}`}>
            <h3 className="m-0 text-sm font-semibold text-ink dark:text-night-text">
                {title} ({users.length})
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

            {users.length === 0 ? (
                <p className="m-0 text-sm text-muted dark:text-night-muted">{t('paymentMethods.listEmpty')}</p>
            ) : (
                <ul className="m-0 grid list-none gap-0 p-0">
                    {users.map((user) => (
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
                                    {user.email} · {t('paymentMethods.addedAt', { date: formatDate(user.addedAt) })}
                                </span>
                            </span>
                            <Button
                                size="small"
                                variant="dangerGhost"
                                disabled={busy}
                                onClick={() => onRemove(user.userId)}
                            >
                                <UserMinus className="h-4 w-4" aria-hidden="true" />
                                {t('paymentMethods.remove')}
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

const PERCENT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

/** A taxa de cada parcela que o cliente paga no cartão, só para leitura. */
function InstallmentFees({ method }: { method: AdminPaymentMethod }) {
    const { t } = useTranslation();
    if (method.installmentFees.length <= 1) return <p className="m-0">{t('paymentMethods.installmentsOnlyCash')}</p>;
    return (
        <div className="mt-2 grid gap-1.5">
            <p className="m-0 font-semibold text-ink dark:text-night-text">{t('paymentMethods.installmentsTitle')}</p>
            <ul className="m-0 grid list-none grid-cols-3 gap-x-4 gap-y-1 p-0 max-[520px]:grid-cols-2">
                {method.installmentFees.map((fee) => (
                    <li className="flex justify-between gap-2 tabular-nums" key={fee.installmentCount}>
                        <span>{fee.installmentCount}x</span>
                        <span className="text-ink dark:text-night-text">
                            {PERCENT.format(fee.feeBasisPoints / 100)}%
                        </span>
                    </li>
                ))}
            </ul>
            <p className="m-0 text-xs">
                {t('paymentMethods.installmentsHint', { min: brl(method.minInstallmentMinor) })}
            </p>
        </div>
    );
}
