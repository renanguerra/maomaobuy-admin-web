import { Suspense } from 'react';
import { PackagesListPage } from './PackagesListPage';

export default function Page() {
    return (
        <Suspense fallback={null}>
            <PackagesListPage />
        </Suspense>
    );
}
