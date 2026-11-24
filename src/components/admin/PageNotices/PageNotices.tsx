import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { ALERT_ICON_CLASSES, ALERT_ICONS, ALERT_TONE_CLASSES, type AlertTone } from '@/components/admin/Alert';

export interface PageNotice {
    key: string;
    tone: AlertTone;
    title: ReactNode;
    /** Texto corrido, na mesma linha do título quando couber. */
    body?: ReactNode;
    /** Para onde ir a partir do aviso. */
    link?: { href: string; label: string };
}

export interface PageNoticesProps {
    /** Aceita `false`/`undefined` para o chamador escrever `condição && aviso`. */
    notices: (PageNotice | false | null | undefined)[];
}

/**
 * Área padrão de avisos de uma tela de detalhe, logo abaixo do cabeçalho: um
 * bloco só, uma linha por aviso, com o link à direita. Some quando não há aviso.
 * Ação nunca mora aqui — o lugar dela é o cabeçalho (`PageActions`).
 */
export function PageNotices({ notices }: PageNoticesProps) {
    const available = notices.filter((notice): notice is PageNotice => Boolean(notice));
    if (available.length === 0) return null;

    return (
        <ul className="m-0 grid list-none gap-1.5 p-0">
            {available.map((notice) => {
                const Icon = ALERT_ICONS[notice.tone];
                return (
                    <li
                        className={`flex flex-wrap items-start gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-sm leading-snug ${ALERT_TONE_CLASSES[notice.tone]}`}
                        key={notice.key}
                        role={notice.tone === 'danger' || notice.tone === 'warning' ? 'alert' : 'status'}
                    >
                        <div className="flex min-w-60 flex-1 gap-2">
                            <Icon
                                className={`mt-px h-4 w-4 shrink-0 ${ALERT_ICON_CLASSES[notice.tone]}`}
                                aria-hidden="true"
                            />
                            <div className="min-w-0 break-words">
                                <strong className="font-bold">{notice.title}</strong>
                                {notice.body && <span className="opacity-85"> · {notice.body}</span>}
                            </div>
                        </div>
                        {notice.link && (
                            <Link
                                className="ml-6 inline-flex shrink-0 items-center gap-1 font-semibold text-inherit no-underline hover:underline sm:ml-0"
                                href={notice.link.href}
                            >
                                {notice.link.label}
                                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </Link>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
