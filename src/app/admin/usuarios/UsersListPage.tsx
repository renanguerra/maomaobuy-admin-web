'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { api } from '@/services/api';
import type { AdminUser, Page } from '@/types/api';
import { formatDate, userStatusLabel } from '@/types/api';

const LIMIT = 20;

export function UsersListPage() {
    const [page, setPage] = useState<Page<AdminUser>>();
    const [search, setSearch] = useState('');
    const [pageNumber, setPageNumber] = useState(1);
    const [error, setError] = useState<string>();
    const [loading, setLoading] = useState(true);

    function load(currentSearch: string, currentPage: number) {
        setLoading(true);
        const query = new URLSearchParams({ page: String(currentPage), limit: String(LIMIT) });
        if (currentSearch) query.set('search', currentSearch);
        api<Page<AdminUser>>(`/users?${query.toString()}`)
            .then(setPage)
            .catch(() => setError('Não foi possível carregar os usuários.'))
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        load('', 1);
         
    }, []);

    function handleSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setPageNumber(1);
        load(search, 1);
    }

    function goToPage(next: number) {
        setPageNumber(next);
        load(search, next);
    }

    const totalPages = page ? Math.max(1, Math.ceil(page.total / page.limit)) : 1;

    return (
        <main>
            <p className="mm-kicker mb-3">Operação</p>
            <h1 className="m-0 text-3xl tracking-[-.03em]">Usuários</h1>

            <form className="mt-6 flex max-w-md gap-3" onSubmit={handleSearch}>
                <input
                    className="min-h-11 w-full rounded-md border border-line bg-surface px-4 dark:border-night-line dark:bg-night-surface"
                    name="search"
                    placeholder="Buscar por nome, usuário ou e-mail"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />
                <Button type="submit" variant="secondary">
                    Buscar
                </Button>
            </form>

            {error && <p className="mt-6 border-l-2 border-origin-500 pl-3 text-sm">{error}</p>}
            {loading && <p className="mt-6 text-muted">Carregando usuários…</p>}

            {!loading && page && (
                <>
                    <div className="mt-6 overflow-x-auto">
                        <table className="w-full min-w-[720px] border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-line text-left text-xs font-bold tracking-wide text-muted uppercase dark:border-night-line dark:text-night-subtle">
                                    <th className="py-3 pr-4">Nome</th>
                                    <th className="py-3 pr-4">Usuário</th>
                                    <th className="py-3 pr-4">E-mail</th>
                                    <th className="py-3 pr-4">Status</th>
                                    <th className="py-3 pr-4">Criado em</th>
                                </tr>
                            </thead>
                            <tbody>
                                {page.data.map((user) => (
                                    <tr className="border-b border-line dark:border-night-line" key={user.id}>
                                        <td className="py-3 pr-4">
                                            <Link className="font-semibold text-primary" href={`/admin/usuarios/${user.id}`}>
                                                {user.name}
                                            </Link>
                                        </td>
                                        <td className="py-3 pr-4">{user.username}</td>
                                        <td className="py-3 pr-4">{user.email}</td>
                                        <td className="py-3 pr-4">
                                            <span className="mm-kicker">{userStatusLabel(user.status)}</span>
                                        </td>
                                        <td className="py-3 pr-4 text-muted dark:text-night-muted">
                                            {formatDate(user.createdAt)}
                                        </td>
                                    </tr>
                                ))}
                                {page.data.length === 0 && (
                                    <tr>
                                        <td className="py-6 text-muted" colSpan={5}>
                                            Nenhum usuário encontrado.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-4 text-sm">
                        <span className="text-muted dark:text-night-muted">
                            Página {pageNumber} de {totalPages} · {page.total} usuários
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
