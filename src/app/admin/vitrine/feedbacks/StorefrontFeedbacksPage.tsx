'use client';

import { PageHeader } from '@/components/admin/PageHeader';
import { useTranslation } from '@/i18n/LanguageProvider';
import { FeedbacksTab } from '../FeedbacksTab';

/** Posts de unboxing do Instagram que vão para o bloco "Quem comprou, mostrou". */
export function StorefrontFeedbacksPage() {
    const { t } = useTranslation();
    return (
        <div className="grid gap-6">
            <PageHeader
                description={t('storefront.feedbacksDescription')}
                kicker={t('storefront.kicker')}
                title={t('storefront.tabs.feedbacks')}
            />
            <FeedbacksTab />
        </div>
    );
}
