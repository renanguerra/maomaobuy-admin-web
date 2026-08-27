import type { ReactNode } from 'react';
import { FileText, ImageOff } from 'lucide-react';

export interface MediaGridProps {
    children: ReactNode;
    className?: string;
}

/** Grade de miniaturas usada por produto, pedido, pacote e comprovantes. */
export function MediaGrid({ children, className = '' }: MediaGridProps) {
    return (
        <div
            /*
             * `auto-fill` em vez de breakpoints: a grade também aparece dentro
             * da coluna estreita da tela de detalhe, onde uma contagem fixa de
             * colunas espremeria a miniatura e cortaria o rótulo do botão.
             */
            className={['grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3', className]
                .filter(Boolean)
                .join(' ')}
        >
            {children}
        </div>
    );
}

export interface MediaTileProps {
    url: string | null;
    /** `IMAGE`, `VIDEO`, `PDF` ou qualquer outro rótulo vindo da API. */
    kind: string;
    alt?: string;
    /** Rodapé com as ações da mídia (remover, texto alternativo). */
    footer?: ReactNode;
    /** Texto do link que abre o arquivo em outra aba. */
    openLabel: string;
}

/**
 * Miniatura de um arquivo. Imagem e vídeo aparecem em pré-visualização; PDF e
 * tipos desconhecidos viram um cartão com ícone — nunca um quadrado vazio sem
 * explicação.
 */
export function MediaTile({ url, kind, alt, footer, openLabel }: MediaTileProps) {
    const isImage = kind === 'IMAGE';
    const isVideo = kind === 'VIDEO';

    return (
        <figure className="mm-card m-0 flex flex-col">
            <div className="relative aspect-square w-full bg-warm-200 dark:bg-night-raised">
                {isImage && url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="h-full w-full object-cover" src={url} alt={alt ?? ''} loading="lazy" />
                ) : isVideo && url ? (
                    <video className="h-full w-full object-cover" src={url} controls />
                ) : (
                    <span className="grid h-full w-full place-items-center gap-2 text-xs font-semibold text-muted dark:text-night-muted">
                        {url ? (
                            <FileText className="h-6 w-6" aria-hidden="true" />
                        ) : (
                            <ImageOff className="h-6 w-6" aria-hidden="true" />
                        )}
                        {kind}
                    </span>
                )}

                {url && !isVideo && (
                    <a
                        className="absolute inset-0 grid place-items-center bg-warm-950/0 text-xs font-semibold text-transparent transition hover:bg-warm-950/55 hover:text-white focus-visible:bg-warm-950/55 focus-visible:text-white"
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                    >
                        {openLabel}
                    </a>
                )}
            </div>

            {footer && (
                <figcaption className="grid gap-2 border-t border-line p-2.5 dark:border-night-line">
                    {footer}
                </figcaption>
            )}
        </figure>
    );
}
