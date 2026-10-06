import { Suspense } from 'react';
import { ProfitReportPrintPage } from './ProfitReportPrintPage';

export default function Page() {
    return (
        <Suspense fallback={null}>
            <ProfitReportPrintPage />
        </Suspense>
    );
}
