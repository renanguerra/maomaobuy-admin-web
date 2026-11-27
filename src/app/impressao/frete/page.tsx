import { Suspense } from 'react';
import { FreightReceiptPage } from './FreightReceiptPage';

export default function Page() {
    return (
        <Suspense fallback={null}>
            <FreightReceiptPage />
        </Suspense>
    );
}
