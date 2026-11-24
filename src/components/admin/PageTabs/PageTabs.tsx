'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface PageTab<T extends string> {
    key: T;
    label: string;
    content: ReactNode;
}

export interface PageTabsProps<T extends string> {
    /** Nome do grupo para leitor de tela. */
    label: string;
    tabs: readonly PageTab<T>[];
    value: T;
    onChange: (key: T) => void;
}

/**
 * Abas de uma tela inteira. Como em `SectionTabs`, cada aba só monta (e
 * consulta) na primeira vez que abre, e trocar esconde em vez de desmontar.
 */
export function PageTabs<T extends string>({ label, tabs, value, onChange }: PageTabsProps<T>) {
    const [visited, setVisited] = useState<ReadonlySet<T>>(() => new Set([value]));
    const listRef = useRef<HTMLDivElement>(null);
    const baseId = useId();

    function select(key: T) {
        setVisited((current) => (current.has(key) ? current : new Set(current).add(key)));
        onChange(key);
    }

    function handleKeyDown(event: KeyboardEvent) {
        const index = tabs.findIndex((tab) => tab.key === value);
        const target = {
            ArrowRight: (index + 1) % tabs.length,
            ArrowLeft: (index - 1 + tabs.length) % tabs.length,
            Home: 0,
            End: tabs.length - 1,
        }[event.key];
        if (target === undefined) return;
        event.preventDefault();
        select(tabs[target].key);
        listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[target]?.focus();
    }

    return (
        <div className="grid gap-5">
            <div
                aria-label={label}
                className="mm-scroll-x flex gap-6 border-b border-line dark:border-night-line"
                onKeyDown={handleKeyDown}
                ref={listRef}
                role="tablist"
            >
                {tabs.map((tab) => {
                    const selected = tab.key === value;
                    return (
                        <button
                            aria-controls={`${baseId}-panel-${tab.key}`}
                            aria-selected={selected}
                            className={`min-h-11 shrink-0 cursor-pointer border-0 border-b-2 bg-transparent px-0 text-sm font-semibold whitespace-nowrap transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-400 ${
                                selected
                                    ? 'border-brand-700 text-ink dark:border-night-accent dark:text-night-text'
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
                        </button>
                    );
                })}
            </div>
            {tabs.map((tab) =>
                visited.has(tab.key) ? (
                    <div
                        aria-labelledby={`${baseId}-tab-${tab.key}`}
                        className="grid gap-5"
                        hidden={tab.key !== value}
                        id={`${baseId}-panel-${tab.key}`}
                        key={tab.key}
                        role="tabpanel"
                    >
                        {tab.content}
                    </div>
                ) : null,
            )}
        </div>
    );
}
