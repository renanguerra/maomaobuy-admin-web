'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface SectionTab {
    key: string;
    label: string;
    /** Quantidade ao lado do nome; omitida quando não se sabe sem consultar. */
    count?: number;
    content: ReactNode;
}

export interface SectionTabsProps {
    /** Nome do grupo para leitor de tela. */
    label: string;
    tabs: readonly SectionTab[];
}

/**
 * Cartão com abas para o que se consulta de vez em quando num registro
 * (conversa, arquivos, histórico). Cada aba só monta, e só consulta, na
 * primeira vez que é aberta; trocar de aba esconde em vez de desmontar, para
 * não perder uma mensagem pela metade.
 */
export function SectionTabs({ label, tabs }: SectionTabsProps) {
    const [active, setActive] = useState(tabs[0].key);
    const [visited, setVisited] = useState<ReadonlySet<string>>(() => new Set([tabs[0].key]));
    const listRef = useRef<HTMLDivElement>(null);
    const baseId = useId();

    function select(key: string) {
        setActive(key);
        setVisited((current) => (current.has(key) ? current : new Set(current).add(key)));
    }

    function handleKeyDown(event: KeyboardEvent) {
        const index = tabs.findIndex((tab) => tab.key === active);
        const next =
            event.key === 'ArrowRight'
                ? (index + 1) % tabs.length
                : event.key === 'ArrowLeft'
                  ? (index - 1 + tabs.length) % tabs.length
                  : event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? tabs.length - 1
                      : undefined;
        if (next === undefined) return;
        event.preventDefault();
        select(tabs[next].key);
        listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
    }

    return (
        <section className="mm-card">
            <div
                aria-label={label}
                className="mm-scroll-x flex gap-6 border-b border-line px-5 dark:border-night-line"
                onKeyDown={handleKeyDown}
                ref={listRef}
                role="tablist"
            >
                {tabs.map((tab) => {
                    const selected = tab.key === active;
                    return (
                        <button
                            aria-controls={`${baseId}-panel-${tab.key}`}
                            aria-selected={selected}
                            className={`min-h-12 shrink-0 cursor-pointer border-0 border-b-2 bg-transparent px-0 text-sm font-semibold whitespace-nowrap transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-400 ${
                                selected
                                    ? 'border-primary text-ink dark:border-night-accent dark:text-night-text'
                                    : 'border-transparent text-muted hover:text-ink dark:text-night-muted dark:hover:text-night-text'
                            }`}
                            id={`${baseId}-tab-${tab.key}`}
                            key={tab.key}
                            onClick={() => select(tab.key)}
                            role="tab"
                            tabIndex={selected ? 0 : -1}
                            type="button"
                        >
                            {tab.label}
                            {tab.count !== undefined && (
                                <span className="mm-data ml-1.5 opacity-80">({tab.count})</span>
                            )}
                        </button>
                    );
                })}
            </div>
            {tabs.map((tab) => (
                <div
                    aria-labelledby={`${baseId}-tab-${tab.key}`}
                    className="p-5"
                    hidden={tab.key !== active}
                    id={`${baseId}-panel-${tab.key}`}
                    key={tab.key}
                    role="tabpanel"
                >
                    {visited.has(tab.key) && tab.content}
                </div>
            ))}
        </section>
    );
}
