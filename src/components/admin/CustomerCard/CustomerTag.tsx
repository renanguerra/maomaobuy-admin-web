/** Etiqueta da equipe no cliente. */
export function CustomerTag({ label }: { label: string }) {
    return (
        <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800 dark:bg-night-brand dark:text-night-accent">
            {label}
        </span>
    );
}
