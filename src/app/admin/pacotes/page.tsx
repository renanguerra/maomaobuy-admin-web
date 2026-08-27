import { Suspense } from 'react';
import { ListPageFallback } from '@/components/admin/ListPageFallback';
import { PackagesListPage } from './PackagesListPage';

export default function Page() {
    return (
        <Suspense fallback={<ListPageFallback />}>
            <PackagesListPage />
        </Suspense>
    );
}
