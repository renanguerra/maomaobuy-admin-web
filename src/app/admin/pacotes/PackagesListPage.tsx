'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { api } from '@/services/api';
import { PACKAGE_STATUSES, formatDate, packageStatusLabel, type AdminPackage, type Page } from '@/types/api';

const LIMIT = 20;

export function PackagesListPage() {
    const searchParams = useSearchParams();
    const initialStatus = searchParams.get('status') ?? '';
    const [status, setStatus] = useState(initialStatus);
    const [page, setPage] = useState<Page<AdminPackage>>();
    const [pageNumber, setPageNumber] = useState(1);
    const [error, setError] = useState<string>();
    const [loading, setLoading] = useState(true);

    function load(currentStatus: string, currentPage: number) {
        setLoading(true);
        const query = new URLSearchParams({ page: String(currentPage), limit: String(LIMIT) });
        if (currentStatus) query.set('status', currentStatus);
        api<Page<AdminPackage>>(`/packages?${query.toString()}`)
            .then(setPage)
            .catch(() => setError('Não foi possível carregar os pacotes.'))
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        load(initialStatus, 1);

    }, []);

    function handleSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setPageNumber(1);
        load(status, 1);
    }

    function goToPage(next: number) {
        setPageNumber(next);
        load(status, next);
    }

    const totalPages = page ? Math.max(1, Math.ceil(page.total / page.limit)) : 1;

    return (
        <main>
            <p className="mm-kicker mb-3">Logística</p>
            <h1 className="m-0 text-3xl tracking-[-.03em]">Pacotes</h1>
            <p className="mt-2 max-w-2xl text-muted dark:text-night-muted">
                Consolidação, aprovação de frete, cobrança e despacho dos pacotes dos clientes.
            </p>

            <form className="mt-6 flex flex-wrap items-end gap-4" onSubmit={handleSearch}>
                <label className="grid gap-2 text-sm font-semibold">
                    Status
                    <select
                        className="min-h-10 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                    >
                        <option value="">Todos</option>
                        {PACKAGE_STATUSES.map((value) => (
                            <option key={value} value={value}>
                                {packageStatusLabel(value)}
                            </option>
                        ))}
                    </select>
                </label>
                <Button type="submit" variant="secondary">
                    Pesquisar
                </Button>
            </form>

            {error && <p className="mt-6 border-l-2 border-origin-500 pl-3 text-sm">{error}</p>}
            {loading && <p className="mt-6 text-muted">Carregando pacotes…</p>}

            {!loading && page && (
                <>
                    <div className="mt-6 overflow-x-auto">
                        <table className="w-full min-w-[860px] border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-line text-left text-xs font-bold tracking-wide text-muted uppercase dark:border-night-line dark:text-night-subtle">
                                    <th className="py-3 pr-4">Pacote</th>
                                    <th className="py-3 pr-4">Cliente</th>
                                    <th className="py-3 pr-4">Itens</th>
                                    <th className="py-3 pr-4">Rastreio</th>
                                    <th className="py-3 pr-4">Status</th>
                                    <th className="py-3 pr-4">Criado em</th>
                                </tr>
                            </thead>
                            <tbody>
                                {page.data.map((pkg) => (
                                    <tr className="border-b border-line dark:border-night-line" key={pkg.id}>
                                        <td className="py-3 pr-4">
                                            <Link className="font-semibold text-primary" href={`/admin/pacotes/${pkg.id}`}>
                                                {pkg.packageCode}
                                            </Link>
                                        </td>
                                        <td className="py-3 pr-4">
                                            <Link className="font-semibold text-primary hover:underline" href={`/admin/usuarios/${pkg.userId}`}>
                                                {pkg.userName}
                                            </Link>
                                            <p className="mt-0.5 text-xs text-muted dark:text-night-muted">{pkg.userEmail}</p>
                                        </td>
                                        <td className="py-3 pr-4">{pkg.items.length}</td>
                                        <td className="py-3 pr-4">{pkg.trackingCode ?? '—'}</td>
                                        <td className="py-3 pr-4">
                                            <span className="mm-kicker">{packageStatusLabel(pkg.status)}</span>
                                        </td>
                                        <td className="py-3 pr-4 text-muted dark:text-night-muted">{formatDate(pkg.createdAt)}</td>
                                    </tr>
                                ))}
                                {page.data.length === 0 && (
                                    <tr>
                                        <td className="py-6 text-muted" colSpan={6}>
                                            Nenhum pacote encontrado para este filtro.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-4 text-sm">
                        <span className="text-muted dark:text-night-muted">
                            Página {pageNumber} de {totalPages} · {page.total} pacotes
                        </span>
                        <div className="flex gap-3">
                            <Button
                                size="small"
                                variant="secondary"
                                onClick={() => goToPage(pageNumber - 1)}
                                disabled={pageNumber <= 1}
                            >
                                Anterior
                            </Button>
                            <Button
                                size="small"
                                variant="secondary"
                                onClick={() => goToPage(pageNumber + 1)}
                                disabled={pageNumber >= totalPages}
                            >
                                Próxima
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </main>
    );
}
