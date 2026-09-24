import { Suspense } from 'react';
import { AssemblySheetPage } from './AssemblySheetPage';

export default function Page() {
    return (
        <Suspense fallback={null}>
            <AssemblySheetPage />
        </Suspense>
    );
}
