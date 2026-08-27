import { Suspense } from 'react';
import { ListPageFallback } from '@/components/admin/ListPageFallback';
import { OrdersListPage } from './OrdersListPage';

export default function Page() {
    return (
        <Suspense fallback={<ListPageFallback />}>
            <OrdersListPage />
        </Suspense>
    );
}
