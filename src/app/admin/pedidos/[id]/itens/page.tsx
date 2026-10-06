import { Suspense } from 'react';
import { ListPageFallback } from '@/components/admin/ListPageFallback';
import { CreateOrderPage } from '../../novo/CreateOrderPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return (
        <Suspense fallback={<ListPageFallback />}>
            <CreateOrderPage editOrderId={id} />
        </Suspense>
    );
}
