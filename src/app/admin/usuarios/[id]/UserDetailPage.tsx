'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, KeyRound, MapPin, Package, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { ApprovalDialog } from '@/components/auth/ApprovalDialog';
import { CreatePackagePanel } from './CreatePackagePanel';
import { LazySection } from './LazySection';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/services/api';
import type { AdminOrder, AdminPackage, AdminUser, AdminUserAddress } from '@/types/api';
import { formatDate, money, orderStatusLabel, packageStatusLabel, userStatusLabel } from '@/types/api';

type DialogKind = 'suspend' | 'reactivate' | 'request-password-reset' | null;

function addressLabel(address: AdminUserAddress) {
    return `${address.recipientFullName} · ${address.addressLine1}, ${address.locality}/${address.administrativeArea}${address.isDefault ? ' (padrão)' : ''}`;
}

export function UserDetailPage() {
    const params = useParams<{ id: string }>();
    const [user, setUser] = useState<AdminUser>();
    const [error, setError] = useState<string>();
    const [dialog, setDialog] = useState<DialogKind>(null);
    const [feedback, setFeedback] = useState<string>();

    function load() {
        api<AdminUser>(`/users/${params.id}`)
            .then(setUser)
            .catch(() => setError('Não foi possível carregar o usuário.'));
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.id]);

    async function handleConfirm(values: { totpCode: string; reason: string }) {
        const action = dialog;
        try {
            const updated = await api<AdminUser>(`/users/${params.id}/${action}`, {
                method: 'POST',
                body: JSON.stringify(values),
            });
            setUser(updated);
            setFeedback(
                action === 'suspend'
                    ? 'Usuário suspenso com sucesso.'
                    : action === 'reactivate'
                      ? 'Usuário reativado com sucesso.'
                      : 'Redefinição de senha solicitada. O usuário não poderá entrar até concluí-la.',
            );
            setDialog(null);
        } catch (err) {
            throw err instanceof ApiError ? err : new Error('Não foi possível concluir a ação.');
        }
    }

    return (
        <main>
            <Link className="inline-flex items-center gap-2 text-sm font-semibold text-muted dark:text-night-muted" href="/admin/usuarios">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Voltar para usuários
            </Link>

            {error && <p className="mt-6 border-l-2 border-origin-500 pl-3 text-sm">{error}</p>}
            {!user && !error && <p className="mt-6 text-muted">Carregando usuário…</p>}

            {user && (
                <>
                    <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="mm-kicker mb-3">Usuário</p>
                            <h1 className="m-0 text-3xl tracking-[-.03em]">{user.name}</h1>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {user.status === 'ACTIVE' ? (
                                <Button variant="danger" onClick={() => setDialog('suspend')}>
                                    Suspender usuário
                                </Button>
                            ) : (
                                <Button variant="primary" onClick={() => setDialog('reactivate')}>
                                    Reativar usuário
                                </Button>
                            )}
                            {!user.passwordResetRequiredAt && (
                                <Button
                                    variant="secondary"
                                    onClick={() => setDialog('request-password-reset')}
                                    leadingIcon={<KeyRound className="h-4 w-4" aria-hidden="true" />}
                                >
                                    Solicitar redefinição de senha
                                </Button>
                            )}
                        </div>
                    </div>

                    {feedback && <p className="mt-4 text-sm text-success">{feedback}</p>}

                    <section className="mm-panel mt-8 grid grid-cols-2 gap-6 p-6 max-[600px]:grid-cols-1">
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">Nome de usuário</p>
                            <p className="mt-1 font-semibold">{user.username}</p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">E-mail</p>
                            <p className="mt-1 font-semibold">{user.email}</p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">E-mail verificado</p>
                            <p className="mt-1 font-semibold">{user.emailVerifiedAt ? formatDate(user.emailVerifiedAt) : 'Não verificado'}</p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">Status</p>
                            <p className="mt-1">
                                <span className="mm-kicker">{userStatusLabel(user.status)}</span>
                            </p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">Criado em</p>
                            <p className="mt-1 font-semibold">{formatDate(user.createdAt)}</p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">ID</p>
                            <p className="mt-1 font-mono text-xs break-all">{user.id}</p>
                        </div>
                        {user.passwordResetRequiredAt && (
                            <div className="col-span-2">
                                <p className="m-0 text-sm text-muted dark:text-night-muted">Redefinição de senha</p>
                                <p className="mt-1">
                                    <span className="mm-kicker">Pendente desde {formatDate(user.passwordResetRequiredAt)}</span>
                                </p>
                                <p className="mt-1 text-sm text-muted dark:text-night-muted">
                                    O usuário não conseguirá entrar até concluir a redefinição pelo link enviado por e-mail.
                                </p>
                            </div>
                        )}
                    </section>

                    <LazySection<AdminUserAddress[]>
                        title="Endereços"
                        icon={<MapPin className="h-5 w-5 text-muted dark:text-night-muted" aria-hidden="true" />}
                        fetcher={() => api<AdminUserAddress[]>(`/users/${user.id}/addresses`)}
                        errorMessage="Não foi possível carregar os endereços."
                    >
                        {(addresses) =>
                            addresses.length === 0 ? (
                                <p className="text-sm text-muted dark:text-night-muted">Nenhum endereço cadastrado.</p>
                            ) : (
                                <div className="grid gap-3">
                                    {addresses.map((address) => (
                                        <div className="mm-panel-soft p-4 text-sm" key={address.id}>
                                            <p className="font-semibold">{addressLabel(address)}</p>
                                            <p className="mt-1 text-muted dark:text-night-muted">
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
                        title="Pedidos"
                        icon={<ShoppingBag className="h-5 w-5 text-muted dark:text-night-muted" aria-hidden="true" />}
                        fetcher={() => api<AdminOrder[]>(`/orders?userId=${user.id}`)}
                        errorMessage="Não foi possível carregar os pedidos."
                    >
                        {(orders) =>
                            orders.length === 0 ? (
                                <p className="text-sm text-muted dark:text-night-muted">Nenhum pedido encontrado.</p>
                            ) : (
                                <div className="grid gap-3">
                                    {orders.map((order) => (
                                        <Link
                                            className="mm-panel-soft flex flex-wrap items-center justify-between gap-3 p-4 text-sm no-underline"
                                            href={`/admin/pedidos/${order.id}`}
                                            key={order.id}
                                        >
                                            <span className="font-semibold text-primary">#{order.id.slice(0, 8)}</span>
                                            <span className="mm-kicker">{orderStatusLabel(order.status)}</span>
                                            <span className="mm-data">{money(order.totalAmountMinor, order.currency)}</span>
                                            <span className="text-muted dark:text-night-muted">{formatDate(order.createdAt)}</span>
                                        </Link>
                                    ))}
                                </div>
                            )
                        }
                    </LazySection>

                    <LazySection<AdminPackage[]>
                        title="Pacotes"
                        icon={<Package className="h-5 w-5 text-muted dark:text-night-muted" aria-hidden="true" />}
                        fetcher={() => api<AdminPackage[]>(`/packages?userId=${user.id}`)}
                        errorMessage="Não foi possível carregar os pacotes."
                    >
                        {(packages) =>
                            packages.length === 0 ? (
                                <p className="text-sm text-muted dark:text-night-muted">Nenhum pacote encontrado.</p>
                            ) : (
                                <div className="grid gap-3">
                                    {packages.map((pkg) => (
                                        <Link
                                            className="mm-panel-soft flex flex-wrap items-center justify-between gap-3 p-4 text-sm no-underline"
                                            href={`/admin/pacotes/${pkg.id}`}
                                            key={pkg.id}
                                        >
                                            <span className="font-semibold text-primary">{pkg.packageCode}</span>
                                            <span className="mm-kicker">{packageStatusLabel(pkg.status)}</span>
                                            <span className="text-muted dark:text-night-muted">{formatDate(pkg.createdAt)}</span>
                                        </Link>
                                    ))}
                                </div>
                            )
                        }
                    </LazySection>

                    <CreatePackagePanel userId={user.id} />
                </>
            )}

            <ApprovalDialog
                open={dialog === 'suspend'}
                title="Suspender usuário"
                description="Essa ação impede o usuário de acessar a conta. Informe o código TOTP e o motivo."
                confirmLabel="Suspender"
                variant="danger"
                onCancel={() => setDialog(null)}
                onConfirm={handleConfirm}
            />
            <ApprovalDialog
                open={dialog === 'reactivate'}
                title="Reativar usuário"
                description="Essa ação restaura o acesso do usuário à conta."
                confirmLabel="Reativar"
                onCancel={() => setDialog(null)}
                onConfirm={handleConfirm}
            />
            <ApprovalDialog
                open={dialog === 'request-password-reset'}
                title="Solicitar redefinição de senha"
                description="O usuário receberá um e-mail para redefinir a senha e não conseguirá entrar até concluir o processo. As sessões ativas dele serão encerradas."
                confirmLabel="Solicitar redefinição"
                variant="danger"
                onCancel={() => setDialog(null)}
                onConfirm={handleConfirm}
            />
        </main>
    );
}
