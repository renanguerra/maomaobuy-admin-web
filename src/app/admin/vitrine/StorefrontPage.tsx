'use client';

import { PageHeader } from '@/components/admin/PageHeader';
import { useTranslation } from '@/i18n/LanguageProvider';
import { BannersTab } from './BannersTab';
import { SectionsTab } from './SectionsTab';

/**
 * Destaques da home (exploração de 14/11/2026): a estrutura da home (ordem e
 * conteúdo dos blocos) e, abaixo, o banner principal, numa página só.
 * Categorias, Feedbacks e Avisos têm páginas próprias no grupo "Vitrine do
 * site" do menu. O site lê com até 30 s de atraso.
 */
export function StorefrontPage() {
    const { t } = useTranslation();
    return (
        <div className="grid gap-6">
            <PageHeader
                description={t('storefront.highlightsDescription')}
                kicker={t('storefront.kicker')}
                title={t('storefront.highlightsTitle')}
            />
            <SectionsTab />
            <BannersTab />
        </div>
    );
}
