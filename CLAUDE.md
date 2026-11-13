@AGENTS.md

## Git workflow

- Never commit directly to `main`. Before starting any new feature or code change (each new chat/task), create a new branch from `main`.
- Sync first: `git checkout main && git pull` before branching off.
- Branch naming: `feature/<short-description>` for features, `fix/<short-description>` for bug fixes.
- Each task gets its own branch; do not reuse a branch left over from an unrelated task.

## Vitrine da home (14/11/2026)

- `/admin/vitrine` (`src/app/admin/vitrine/`) edita a home do site: blocos (ordem, textos, prateleiras), banner principal, fotos dos atalhos de categoria e posts de feedback do Instagram. Fala com `/home/*` no backend.
- Toda gravação pede TOTP (`TotpModal` ou o campo no formulário); sem cadastro de TOTP, abre o cadastro antes. Imagens sobem por PUT presignado (`ImageUploadField`, alvo `BANNER`/`CATEGORY`/`FEEDBACK`) e só valem depois de salvas.
- Feedback só vai ao site com a autorização do cliente marcada. Banner e prateleiras escolhem só produtos da loja de varejo (o backend recusa CoinShop, "Leve junto" e só atacado).
- O cadastro de produto tem idioma, estado (lacrado/avulso) e conteúdo da caixa — alimentam o card e os filtros da loja.
- Textos do painel ficam nos dois dicionários (`pt-br.ts` e `zh-hans.ts`, namespace `storefront`).
