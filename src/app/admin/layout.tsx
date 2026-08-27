import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ConfirmProvider } from '@/components/ui/ConfirmDialog';

export default function AdminLayout({ children }: { children: ReactNode }) {
    return (
        <AuthGuard>
            <ConfirmProvider>
                <AdminShell>{children}</AdminShell>
            </ConfirmProvider>
        </AuthGuard>
    );
}
