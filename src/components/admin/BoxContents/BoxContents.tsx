import type { BoxContent } from '@/types/api';

/** O que vem dentro da box comprada, para quem separa e para quem atende. */
export function BoxContents({ contents, className = '' }: { contents?: BoxContent[] | null; className?: string }) {
    if (!contents || contents.length === 0) return null;
    return (
        <span className={['mt-1 grid gap-0.5', className].filter(Boolean).join(' ')}>
            {contents.map((item, index) => (
                <span className="block" key={index}>
                    {item.quantity} × {item.name}
                    {item.variantLabel ? ` (${item.variantLabel})` : ''}
                </span>
            ))}
        </span>
    );
}
