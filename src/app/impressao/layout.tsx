import type { ReactNode } from 'react';
import { AuthGuard } from '@/components/auth/AuthGuard';

/**
 * Páginas de impressão: mesma sessão do painel, mas sem a moldura (barra
 * lateral, cabeçalho). O que vai para o papel é só a folha.
 */
export default function PrintLayout({ children }: { children: ReactNode }) {
    return <AuthGuard>{children}</AuthGuard>;
}
