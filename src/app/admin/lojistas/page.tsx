import { Suspense } from 'react';
import { WholesaleApplicationsListPage } from './WholesaleApplicationsListPage';

export default function Page() {
    return (
        <Suspense>
            <WholesaleApplicationsListPage />
        </Suspense>
    );
}
