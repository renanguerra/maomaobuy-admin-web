'use client';

import { useState } from 'react';
import { FilterTabs } from '@/components/admin/FilterTabs';
import { PageHeader } from '@/components/admin/PageHeader';
import { useTranslation } from '@/i18n/LanguageProvider';
import { BannersTab } from './BannersTab';
import { CategoriesTab } from './CategoriesTab';
import { FeedbacksTab } from './FeedbacksTab';
import { SectionsTab } from './SectionsTab';

type Tab = 'sections' | 'banners' | 'categories' | 'feedbacks';

/**
 * Vitrine da home: banner principal, ordem e conteúdo dos blocos, fotos dos
 * atalhos de categoria e posts de feedback. O site lê com até 30 s de atraso.
 */
export function StorefrontPage() {
    const { t } = useTranslation();
    const [tab, setTab] = useState<Tab>('sections');
    return (
        <div className="grid gap-6">
            <PageHeader
                description={t('storefront.description')}
                kicker={t('storefront.kicker')}
                title={t('storefront.title')}
            />
            <FilterTabs
                label={t('storefront.title')}
                onChange={setTab}
                options={(['sections', 'banners', 'categories', 'feedbacks'] as const).map((value) => ({
                    value,
                    label: t(`storefront.tabs.${value}`),
                }))}
                value={tab}
            />
            {tab === 'sections' && <SectionsTab />}
            {tab === 'banners' && <BannersTab />}
            {tab === 'categories' && <CategoriesTab />}
            {tab === 'feedbacks' && <FeedbacksTab />}
        </div>
    );
}
