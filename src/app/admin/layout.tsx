import type { ReactNode } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AuthGuard } from '@/components/auth/AuthGuard';

export default function AdminLayout({ children }: { children: ReactNode }) {
    return (
        <AuthGuard>
            <section className="flex min-h-screen w-full max-[900px]:flex-col">
                <AdminSidebar />
                <div className="min-w-0 w-full px-[max(2rem,calc((100vw-16rem-84rem)/2+2rem))] py-10 [&>main]:w-full [&>main]:max-w-none max-[900px]:px-4 max-[900px]:py-7">
                    {children}
                </div>
            </section>
        </AuthGuard>
    );
}
