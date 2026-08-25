'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Package, PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/services/api';
import { money, type AdminOrderItem, type AdminPackage, type AdminUserAddress } from '@/types/api';

interface CreatePackagePanelProps {
    userId: string;
}

function addressLabel(address: AdminUserAddress) {
    return `${address.recipientFullName} · ${address.addressLine1}, ${address.locality}/${address.administrativeArea}${address.isDefault ? ' (padrão)' : ''}`;
}

export function CreatePackagePanel({ userId }: CreatePackagePanelProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();
    const [addresses, setAddresses] = useState<AdminUserAddress[]>();
    const [items, setItems] = useState<AdminOrderItem[]>();
    const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [created, setCreated] = useState<AdminPackage>();

    async function openPanel() {
        setOpen(true);
        setCreated(undefined);
        if (addresses && items) return;
        setLoading(true);
        setError(undefined);
        try {
            const [addressList, itemList] = await Promise.all([
                api<AdminUserAddress[]>(`/users/${userId}/addresses`),
                api<AdminOrderItem[]>(`/packages/eligible-items?userId=${userId}`),
            ]);
            setAddresses(addressList);
            setItems(itemList);
        } catch {
            setError('Não foi possível carregar os dados para criação do pacote.');
        } finally {
            setLoading(false);
        }
    }

    function toggleItem(id: string) {
        setSelectedItemIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const addressId = String(data.get('addressId') ?? '');
        if (!addressId || selectedItemIds.length === 0) return;
        setSubmitting(true);
        setError(undefined);
        try {
            const pkg = await api<AdminPackage>('/packages', {
                method: 'POST',
                body: JSON.stringify({ userId, addressId, orderItemIds: selectedItemIds }),
            });
            setCreated(pkg);
            setItems((current) => current?.filter((item) => !selectedItemIds.includes(item.id)));
            setSelectedItemIds([]);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Não foi possível criar o pacote.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <section className="mt-10">
            <div className="flex items-center justify-between">
                <h2 className="m-0 text-xl">Criar pacote</h2>
                {!open && (
                    <Button size="small" variant="ghost" onClick={openPanel} leadingIcon={<PackagePlus className="h-4 w-4" aria-hidden="true" />}>
                        Criar pacote
                    </Button>
                )}
            </div>

            {open && (
                <div className="mm-panel-soft mt-4 p-5">
                    {loading && <p className="text-sm text-muted dark:text-night-muted">Carregando endereços e itens elegíveis…</p>}
                    {error && <p className="border-l-2 border-origin-500 pl-3 text-sm">{error}</p>}

                    {created && (
                        <p className="mb-4 text-sm text-success">
                            Pacote{' '}
                            <Link className="font-semibold text-primary" href={`/admin/pacotes/${created.id}`}>
                                {created.packageCode}
                            </Link>{' '}
                            criado com sucesso.
                        </p>
                    )}

                    {!loading && addresses && items && (
                        <form className="grid gap-5" onSubmit={handleSubmit}>
                            {addresses.length === 0 ? (
                                <p className="text-sm text-muted dark:text-night-muted">Este usuário não possui endereços cadastrados.</p>
                            ) : (
                                <label className="grid gap-2 text-sm font-semibold">
                                    Endereço de destino
                                    <select
                                        className="min-h-11 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                                        name="addressId"
                                        defaultValue={addresses.find((address) => address.isDefault)?.id ?? addresses[0]?.id}
                                        required
                                    >
                                        {addresses.map((address) => (
                                            <option key={address.id} value={address.id}>
                                                {addressLabel(address)}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}

                            <div>
                                <p className="mb-2 text-sm font-semibold">Itens elegíveis</p>
                                {items.length === 0 && (
                                    <p className="text-sm text-muted dark:text-night-muted">
                                        Nenhum item liberado para envio (READY_TO_SHIP) e sem pacote ativo.
                                    </p>
                                )}
                                <div className="grid gap-2">
                                    {items.map((item) => (
                                        <label
                                            className="mm-panel-soft flex items-center gap-3 p-3 text-sm"
                                            key={item.id}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedItemIds.includes(item.id)}
                                                onChange={() => toggleItem(item.id)}
                                            />
                                            <Package className="h-4 w-4 shrink-0 text-muted dark:text-night-muted" aria-hidden="true" />
                                            <span className="flex-1">
                                                <strong>{item.productName}</strong>
                                                <span className="ml-2 text-muted dark:text-night-muted">
                                                    quantidade {item.quantity} · {money(item.unitAmountMinor, item.currency)}
                                                </span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3">
                                <Button size="small" type="button" variant="ghost" onClick={() => setOpen(false)}>
                                    Fechar
                                </Button>
                                <Button size="small" type="submit" loading={submitting} disabled={addresses.length === 0 || selectedItemIds.length === 0}>
                                    Criar pacote
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            )}
        </section>
    );
}
