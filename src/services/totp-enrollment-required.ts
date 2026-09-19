/**
 * Ponte entre `api()` e a sessão do admin: quando o backend responde 428
 * (`totp_enrollment_required`), a sessão em memória precisa voltar para
 * "sem autenticador" para o diálogo aberto trocar o formulário pelo cadastro.
 * Fica num módulo próprio porque `admin-account-auth` já importa `api` —
 * o caminho inverso criaria um ciclo.
 */
let handler: (() => void) | undefined;

export function onTotpEnrollmentRequired(listener: () => void) {
    handler = listener;
}

export function notifyTotpEnrollmentRequired() {
    handler?.();
}
