'use client';

import { PageHeader } from '@/components/admin/PageHeader';
import { useTranslation } from '@/i18n/LanguageProvider';
import { BannersTab } from './BannersTab';

/**
 * Destaques da home: o banner principal. A ordem dos blocos da home é fixa
 * no código do site (14/11/2026), sem escolha aqui.
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
            <BannersTab />
        </div>
    );
}
