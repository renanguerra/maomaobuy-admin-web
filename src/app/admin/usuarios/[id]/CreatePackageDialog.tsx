'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { PackageOpen } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { EmptyState } from '@/components/admin/EmptyState';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { money, type AdminOrderItem, type AdminPackage, type AdminUserAddress } from '@/types/api';

const FORM_ID = 'create-package-form';

interface CreatePackageDialogProps {
    open: boolean;
    userId: string;
    onClose: () => void;
}

/**
 * Monta um pacote a partir dos itens já elegíveis do usuário. Os dados são
 * carregados só quando o diálogo abre — a tela de detalhe do usuário não
 * precisa pagar por duas consultas que quase nunca são usadas.
 */
export function CreatePackageDialog({ open, userId, onClose }: CreatePackageDialogProps) {
    const { t } = useTranslation();
    const [submitting, setSubmitting] = useState(false);
    const [canSubmit, setCanSubmit] = useState(false);

    return (
        <Modal
            closeLabel={t('common.closeAria')}
            description={t('users.createPackage.description')}
            onClose={onClose}
            open={open}
            size="medium"
            title={t('users.createPackage.title')}
            footer={
                <>
                    <Button onClick={onClose} type="button" variant="ghost">
                        {t('users.createPackage.closeButton')}
                    </Button>
                    <Button disabled={!canSubmit} form={FORM_ID} loading={submitting} type="submit">
                        {t('users.createPackage.submitButton')}
                    </Button>
                </>
            }
        >
            {/* Montado só enquanto aberto: a lista de itens elegíveis é buscada
                a cada abertura, e não fica presa ao estado da vez anterior. */}
            <CreatePackageForm onCanSubmitChange={setCanSubmit} onSubmittingChange={setSubmitting} userId={userId} />
        </Modal>
    );
}

function CreatePackageForm({
    userId,
    onSubmittingChange,
    onCanSubmitChange,
}: {
    userId: string;
    onSubmittingChange: (submitting: boolean) => void;
    onCanSubmitChange: (canSubmit: boolean) => void;
}) {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>();
    const [addresses, setAddresses] = useState<AdminUserAddress[]>();
    const [items, setItems] = useState<AdminOrderItem[]>();
    const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
    const [created, setCreated] = useState<AdminPackage>();

    useEffect(() => {
        let active = true;

        Promise.all([
            api<AdminUserAddress[]>(`/users/${userId}/addresses`),
            api<AdminOrderItem[]>(`/packages/eligible-items?userId=${userId}`),
        ])
            .then(([addressList, itemList]) => {
                if (!active) return;
                setAddresses(addressList);
                setItems(itemList);
            })
            .catch(() => {
                if (active) setError(t('users.createPackage.error'));
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [t, userId]);

    function updateSelection(next: string[]) {
        setSelectedItemIds(next);
        onCanSubmitChange(next.length > 0 && Boolean(addresses?.length));
    }

    function addressLabel(address: AdminUserAddress) {
        return `${address.recipientFullName} · ${address.addressLine1}, ${address.locality}/${address.administrativeArea}${
            address.isDefault ? t('users.detail.addressDefaultSuffix') : ''
        }`;
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const addressId = String(data.get('addressId') ?? '');
        if (!addressId || selectedItemIds.length === 0) return;

        onSubmittingChange(true);
        setError(undefined);
        try {
            const pkg = await api<AdminPackage>('/packages', {
                method: 'POST',
                body: JSON.stringify({ userId, addressId, orderItemIds: selectedItemIds }),
            });
            setCreated(pkg);
            setItems((current) => current?.filter((item) => !selectedItemIds.includes(item.id)));
            updateSelection([]);
            notify({ tone: 'success', title: t('users.createPackage.createdToast', { code: pkg.packageCode }) });
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('common.errors.generic'));
        } finally {
            onSubmittingChange(false);
        }
    }

    if (loading) return <SkeletonCards count={2} label={t('users.createPackage.loading')} />;

    return (
        <>
            {error && (
                <Alert className="mb-4" tone="danger">
                    <p>{error}</p>
                </Alert>
            )}

            {created && (
                <Alert className="mb-4" tone="success" title={t('users.createPackage.createdTitle')}>
                    <p>
                        <Link
                            className="font-semibold text-primary underline dark:text-night-accent"
                            href={`/admin/pacotes/${created.id}`}
                        >
                            {created.packageCode}
                        </Link>
                    </p>
                </Alert>
            )}

            {addresses && items && (
                <form className="grid gap-5" id={FORM_ID} onSubmit={handleSubmit}>
                    {addresses.length === 0 ? (
                        <Alert tone="warning">
                            <p>{t('users.createPackage.noAddresses')}</p>
                        </Alert>
                    ) : (
                        <Select
                            defaultValue={addresses.find((address) => address.isDefault)?.id ?? addresses[0]?.id}
                            label={t('users.createPackage.addressLabel')}
                            name="addressId"
                            options={addresses.map((address) => ({ value: address.id, label: addressLabel(address) }))}
                            required
                        />
                    )}

                    <fieldset className="m-0 grid gap-2 border-0 p-0">
                        <legend className="mb-1 text-sm font-semibold text-ink dark:text-night-text">
                            {t('users.createPackage.eligibleItemsLabel')}
                        </legend>

                        {items.length === 0 ? (
                            <EmptyState
                                icon={PackageOpen}
                                title={t('users.createPackage.noEligibleItems')}
                                variant="bordered"
                            />
                        ) : (
                            items.map((item) => (
                                <Checkbox
                                    boxed
                                    checked={selectedItemIds.includes(item.id)}
                                    key={item.id}
                                    label={item.productName}
                                    description={`${t('users.createPackage.quantityLabel', { count: item.quantity })} · ${money(
                                        item.unitAmountMinor,
                                        item.currency,
                                    )}`}
                                    onChange={() =>
                                        updateSelection(
                                            selectedItemIds.includes(item.id)
                                                ? selectedItemIds.filter((value) => value !== item.id)
                                                : [...selectedItemIds, item.id],
                                        )
                                    }
                                />
                            ))
                        )}
                    </fieldset>
                </form>
            )}
        </>
    );
}
