/** Remove tudo que não é dígito e descarta zeros à esquerda (mantendo pelo menos um "0"). */
export function sanitizeMinorDigits(value: string): string {
    const digits = value.replace(/\D/g, '');
    return digits.replace(/^0+(?=\d)/, '') || '0';
}

/** Formata um valor em unidades mínimas (centavos), ex.: "12990" -> "129,90". */
export function formatMinorAmount(minor: string): string {
    const padded = sanitizeMinorDigits(minor).padStart(3, '0');
    const cents = padded.slice(-2);
    const units = padded.slice(0, -2).replace(/^0+(?=\d)/, '') || '0';
    const withThousands = units.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${withThousands},${cents}`;
}
