'use client';

import { useTranslation } from '@/i18n/LanguageProvider';
import { formatDate } from '@/types/api';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type AgeTone = 'overdue' | 'near' | 'ok' | 'waiting';

/**
 * Situação do prazo: passou, passou da metade, dentro, ou sem prazo (vez do
 * cliente). "Metade" é o aviso antecipado — dá tempo de agir antes do vermelho.
 */
export function ageTone(since: string, deadlineAt: string | null, now = Date.now()): AgeTone {
    if (!deadlineAt) return 'waiting';
    const start = new Date(since).getTime();
    const end = new Date(deadlineAt).getTime();
    if (now >= end) return 'overdue';
    if (now - start >= (end - start) / 2) return 'near';
    return 'ok';
}

/** Duração curta para caber numa célula: "12 min", "5 h", "2d 4h", "12 dias". */
export function useFormatAge() {
    const { t } = useTranslation();
    return (since: string | Date, now = Date.now()) => {
        const elapsed = Math.max(0, now - new Date(since).getTime());
        if (elapsed < HOUR) return t('common.age.minutes', { count: Math.max(1, Math.floor(elapsed / MINUTE)) });
        if (elapsed < DAY) return t('common.age.hours', { count: Math.floor(elapsed / HOUR) });
        const days = Math.floor(elapsed / DAY);
        if (days >= 7) return t('common.age.days', { count: days });
        return t('common.age.daysHours', { days, hours: Math.floor((elapsed % DAY) / HOUR) });
    };
}

const TONE_CLASSES: Record<AgeTone, string> = {
    overdue: 'bg-origin-50 text-origin-700 dark:bg-night-coral-surface dark:text-night-coral',
    near: 'bg-amber-50 text-amber-800 dark:bg-night-warning-surface dark:text-night-warning',
    ok: 'bg-warm-200 text-warm-700 dark:bg-night-raised dark:text-night-muted',
    waiting: 'bg-transparent text-muted dark:text-night-subtle',
};

export interface AgeBadgeProps {
    /** Início da etapa atual. */
    since: string;
    /** Fim do prazo da etapa; `null` quando a vez é do cliente. */
    deadlineAt: string | null;
}

/**
 * Há quanto tempo o registro está na etapa, colorido pelo prazo. A cor é a
 * informação: vermelho passou, âmbar está chegando. O título diz a data exata.
 */
export function AgeBadge({ since, deadlineAt }: AgeBadgeProps) {
    const { t } = useTranslation();
    const formatAge = useFormatAge();
    const tone = ageTone(since, deadlineAt);
    const age = formatAge(since);
    const title =
        tone === 'waiting'
            ? t('common.age.noDeadline')
            : tone === 'overdue'
              ? t('common.age.overdueSince', { date: formatDate(deadlineAt) })
              : t('common.age.dueAt', { date: formatDate(deadlineAt) });

    return (
        <span
            className={`mm-data inline-flex min-w-14 justify-center rounded-md px-2 py-1 text-xs leading-none font-semibold whitespace-nowrap ${TONE_CLASSES[tone]}`}
            title={title}
        >
            <span className="sr-only">{t('common.age.inStage', { age })} · </span>
            <span aria-hidden="true">{age}</span>
            <span className="sr-only">{title}</span>
        </span>
    );
}
