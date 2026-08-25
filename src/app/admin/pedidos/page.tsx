import { Suspense } from 'react';
import { OrdersListPage } from './OrdersListPage';

export default function Page() {
    return (
        <Suspense fallback={null}>
            <OrdersListPage />
        </Suspense>
    );
}
