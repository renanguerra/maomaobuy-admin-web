import { Suspense } from 'react';
import { UserDetailPage } from './UserDetailPage';

export default function Page() {
    return (
        <Suspense>
            <UserDetailPage />
        </Suspense>
    );
}
