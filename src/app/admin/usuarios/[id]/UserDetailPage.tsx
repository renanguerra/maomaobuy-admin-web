'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { KeyRound, MapPin, Package, PackagePlus, ShieldOff, ShieldCheck, ShoppingBag } from 'lucide-react';
import { ActionDialog } from '@/components/admin/ActionDialog';
import { Alert } from '@/components/admin/Alert';
import { DescriptionList } from '@/components/admin/DescriptionList';
import { EmptyState } from '@/components/admin/EmptyState';
import { LazySection } from '@/components/admin/LazySection';
import { ListRow, ListRows } from '@/components/admin/ListRow';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { orderStatusTone, packageStatusTone, StatusPill, userStatusTone } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import type { AdminOrder, AdminPackage, AdminUser, AdminUserAddress } from '@/types/api';
import { formatDate, money, orderStatusLabel, packageStatusLabel, userStatusLabel } from '@/types/api';
import { CreatePackageDialog } from './CreatePackageDialog';

type DialogKind = 'suspend' | 'reactivate' | 'request-password-reset' | 'create-package' | null;

export function UserDetailPage() {
    const { t } = useTranslation();
    const { notify } = useToast();
    const params = useParams<{ id: string }>();
    const [user, setUser] = useState<AdminUser>();
    const [error, setError] = useState<string>();
    const [dialog, setDialog] = useState<DialogKind>(null);

    useEffect(() => {
        let active = true;
        api<AdminUser>(`/users/${params.id}`)
            .then((loaded) => {
                if (active) setUser(loaded);
            })
            .catch(() => {
                if (active) setError(t('users.detail.error'));
            });
        return () => {
            active = false;
        };
    }, [params.id, t]);

    const addressLabel = useCallback(
        (address: AdminUserAddress) =>
            `${address.recipientFullName} · ${address.addressLine1}, ${address.locality}/${address.administrativeArea}${
                address.isDefault ? t('users.detail.addressDefaultSuffix') : ''
            }`,
        [t],
    );

    async function handleConfirm(values: { totpCode: string; reason: string }) {
        const action = dialog;
        if (!action || action === 'create-package') return;

        try {
            const updated = await api<AdminUser>(`/users/${params.id}/${action}`, {
                method: 'POST',
                body: JSON.stringify(values),
            });
            setUser(updated);
            setDialog(null);
            notify({
                tone: 'success',
                title:
                    action === 'suspend'
                        ? t('users.detail.feedback.suspended')
                        : action === 'reactivate'
                          ? t('users.detail.feedback.reactivated')
                          : t('users.detail.feedback.passwordResetRequested'),
            });
        } catch (err) {
            throw err instanceof ApiError ? err : new Error(t('common.errors.generic'));
        }
    }

    if (error) {
        return (
            <div className="grid gap-6">
                <PageHeader
                    backHref="/admin/usuarios"
                    backLabel={t('users.detail.backLink')}
                    title={t('users.detail.kicker')}
                />
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="grid gap-6">
                <PageHeader
                    backHref="/admin/usuarios"
                    backLabel={t('users.detail.backLink')}
                    title={t('users.detail.loading')}
                />
                <SkeletonCards label={t('users.detail.loading')} />
            </div>
        );
    }

    const isActive = user.status === 'ACTIVE';

    return (
        <div className="grid gap-6">
            <PageHeader
                backHref="/admin/usuarios"
                backLabel={t('users.detail.backLink')}
                badge={<StatusPill tone={userStatusTone(user.status)}>{userStatusLabel(user.status)}</StatusPill>}
                kicker={t('users.detail.kicker')}
                meta={`@${user.username} · ${user.email}`}
                title={user.name}
                actions={
                    <>
                        <Button
                            leadingIcon={<PackagePlus className="h-4 w-4" aria-hidden="true" />}
                            onClick={() => setDialog('create-package')}
                            variant="secondary"
                        >
                            {t('users.createPackage.title')}
                        </Button>
                        {!user.passwordResetRequiredAt && (
                            <Button
                                leadingIcon={<KeyRound className="h-4 w-4" aria-hidden="true" />}
                                onClick={() => setDialog('request-password-reset')}
                                variant="secondary"
                            >
                                {t('users.detail.requestPasswordResetButton')}
                            </Button>
                        )}
                        {isActive ? (
                            <Button
                                leadingIcon={<ShieldOff className="h-4 w-4" aria-hidden="true" />}
                                onClick={() => setDialog('suspend')}
                                variant="danger"
                            >
                                {t('users.detail.suspendButton')}
                            </Button>
                        ) : (
                            <Button
                                leadingIcon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
                                onClick={() => setDialog('reactivate')}
                            >
                                {t('users.detail.reactivateButton')}
                            </Button>
                        )}
                    </>
                }
            />

            {user.passwordResetRequiredAt && (
                <Alert
                    tone="warning"
                    title={t('users.detail.fields.passwordResetPendingSince', {
                        date: formatDate(user.passwordResetRequiredAt),
                    })}
                >
                    <p>{t('users.detail.fields.passwordResetHint')}</p>
                </Alert>
            )}

            <SectionCard title={t('users.detail.accountSection')}>
                <DescriptionList
                    items={[
                        { label: t('users.detail.fields.username'), value: user.username },
                        { label: t('users.detail.fields.email'), value: user.email },
                        {
                            label: t('users.detail.fields.emailVerified'),
                            value: user.emailVerifiedAt
                                ? formatDate(user.emailVerifiedAt)
                                : t('users.detail.fields.notVerified'),
                        },
                        {
                            label: t('users.detail.fields.status'),
                            value: (
                                <StatusPill tone={userStatusTone(user.status)}>
                                    {userStatusLabel(user.status)}
                                </StatusPill>
                            ),
                        },
                        { label: t('users.detail.fields.createdAt'), value: formatDate(user.createdAt), numeric: true },
                        {
                            label: t('users.detail.fields.id'),
                            value: <span className="font-mono text-xs break-all">{user.id}</span>,
                        },
                    ]}
                />
            </SectionCard>

            <LazySection<AdminUserAddress[]>
                description={t('users.detail.addressesSection.description')}
                errorMessage={t('users.detail.addressesSection.error')}
                fetcher={() => api<AdminUserAddress[]>(`/users/${user.id}/addresses`)}
                icon={<MapPin aria-hidden="true" />}
                summary={(addresses) => t('users.detail.addressesSection.count', { count: addresses.length })}
                title={t('users.detail.addressesSection.title')}
            >
                {(addresses) =>
                    addresses.length === 0 ? (
                        <EmptyState icon={MapPin} title={t('users.detail.addressesSection.empty')} />
                    ) : (
                        <div className="grid gap-2">
                            {addresses.map((address) => (
                                <div
                                    className="rounded-lg border border-line px-4 py-3 dark:border-night-line"
                                    key={address.id}
                                >
                                    <p className="m-0 text-sm font-semibold text-ink dark:text-night-text">
                                        {addressLabel(address)}
                                    </p>
                                    <p className="mt-1 mb-0 text-xs text-muted dark:text-night-muted">
                                        {address.postalCode} · {address.phoneE164}
                                        {address.deliveryInstructions ? ` · ${address.deliveryInstructions}` : ''}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )
                }
            </LazySection>

            <LazySection<AdminOrder[]>
                description={t('users.detail.ordersSection.description')}
                errorMessage={t('users.detail.ordersSection.error')}
                fetcher={() => api<AdminOrder[]>(`/orders?userId=${user.id}`)}
                icon={<ShoppingBag aria-hidden="true" />}
                summary={(orders) => t('users.detail.ordersSection.count', { count: orders.length })}
                title={t('users.detail.ordersSection.title')}
            >
                {(orders) =>
                    orders.length === 0 ? (
                        <EmptyState icon={ShoppingBag} title={t('users.detail.ordersSection.empty')} />
                    ) : (
                        <div className="-mx-5 -my-5">
                            <ListRows>
                                {orders.map((order) => (
                                    <li key={order.id}>
                                        <ListRow
                                            href={`/admin/pedidos/${order.id}`}
                                            meta={formatDate(order.createdAt)}
                                            title={`#${order.id.slice(0, 8)}`}
                                            value={money(order.totalAmountMinor, order.currency)}
                                            pill={
                                                <StatusPill tone={orderStatusTone(order.status)}>
                                                    {orderStatusLabel(order.status)}
                                                </StatusPill>
                                            }
                                        />
                                    </li>
                                ))}
                            </ListRows>
                        </div>
                    )
                }
            </LazySection>

            <LazySection<AdminPackage[]>
                description={t('users.detail.packagesSection.description')}
                errorMessage={t('users.detail.packagesSection.error')}
                fetcher={() => api<AdminPackage[]>(`/packages?userId=${user.id}`)}
                icon={<Package aria-hidden="true" />}
                summary={(packages) => t('users.detail.packagesSection.count', { count: packages.length })}
                title={t('users.detail.packagesSection.title')}
            >
                {(packages) =>
                    packages.length === 0 ? (
                        <EmptyState icon={Package} title={t('users.detail.packagesSection.empty')} />
                    ) : (
                        <div className="-mx-5 -my-5">
                            <ListRows>
                                {packages.map((pkg) => (
                                    <li key={pkg.id}>
                                        <ListRow
                                            href={`/admin/pacotes/${pkg.id}`}
                                            meta={formatDate(pkg.createdAt)}
                                            title={pkg.packageCode}
                                            pill={
                                                <StatusPill tone={packageStatusTone(pkg.status)}>
                                                    {packageStatusLabel(pkg.status)}
                                                </StatusPill>
                                            }
                                        />
                                    </li>
                                ))}
                            </ListRows>
                        </div>
                    )
                }
            </LazySection>

            <ActionDialog
                confirmLabel={t('users.detail.dialogs.suspend.confirmLabel')}
                description={t('users.detail.dialogs.suspend.description')}
                onCancel={() => setDialog(null)}
                onConfirm={handleConfirm}
                open={dialog === 'suspend'}
                requireReason
                title={t('users.detail.dialogs.suspend.title')}
                variant="danger"
            />
            <ActionDialog
                confirmLabel={t('users.detail.dialogs.reactivate.confirmLabel')}
                description={t('users.detail.dialogs.reactivate.description')}
                onCancel={() => setDialog(null)}
                onConfirm={handleConfirm}
                open={dialog === 'reactivate'}
                title={t('users.detail.dialogs.reactivate.title')}
            />
            <ActionDialog
                confirmLabel={t('users.detail.dialogs.requestPasswordReset.confirmLabel')}
                description={t('users.detail.dialogs.requestPasswordReset.description')}
                onCancel={() => setDialog(null)}
                onConfirm={handleConfirm}
                open={dialog === 'request-password-reset'}
                title={t('users.detail.dialogs.requestPasswordReset.title')}
                variant="danger"
            />
            <CreatePackageDialog onClose={() => setDialog(null)} open={dialog === 'create-package'} userId={user.id} />
        </div>
    );
}
