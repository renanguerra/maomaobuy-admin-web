import { Suspense } from 'react';
import { ListPageFallback } from '@/components/admin/ListPageFallback';
import { CreateOrderPage } from './CreateOrderPage';

export default function Page() {
    return (
        <Suspense fallback={<ListPageFallback />}>
            <CreateOrderPage />
        </Suspense>
    );
}
