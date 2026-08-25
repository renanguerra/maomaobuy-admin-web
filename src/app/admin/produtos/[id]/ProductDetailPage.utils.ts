export function minorToAmount(minor: string): string {
    return (Number(minor) / 100).toFixed(2).replace('.', ',');
}
