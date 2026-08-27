import { Suspense } from 'react';
import { ListPageFallback } from '@/components/admin/ListPageFallback';
import { AdminInspectionsPage } from './InspectionsPage';

export default function Page() {
    return (
        <Suspense fallback={<ListPageFallback />}>
            <AdminInspectionsPage />
        </Suspense>
    );
}
