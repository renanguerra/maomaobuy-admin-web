import { redirect } from 'next/navigation';

/**
 * "Destaques da home" era só o banner principal, que saiu em 17/11/2026 (o
 * site tem banner fixo). O endereço antigo leva aos feedbacks, que continuam
 * aqui embaixo.
 */
export default function StorefrontIndex() {
    redirect('/admin/vitrine/feedbacks');
}
