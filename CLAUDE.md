@AGENTS.md

## Git workflow

- Never commit directly to `main`. Before starting any new feature or code change (each new chat/task), create a new branch from `main`.
- Sync first: `git checkout main && git pull` before branching off.
- Branch naming: `feature/<short-description>` for features, `fix/<short-description>` for bug fixes.
- Each task gets its own branch; do not reuse a branch left over from an unrelated task.

## Áreas do painel (24/11/2026)

- O menu (`components/admin/AdminSidebar/menu.ts`) é por área de trabalho: Operação, Loja, Clientes, Finanças e Ajustes. Só o agrupamento mora ali: **endereço não muda**, e a área sai dele (`areaOfPath`). Dois níveis e nada mais; assunto dentro de uma tela vira aba (`PageTabs`, `FreightTabs`).
- Ajustes troca a barra inteira e volta para a última tela de trabalho. Frete é um item só com três endereços (`also`).
- Tela nova entra em `menu.ts`, `AdminSidebar.types.ts`, nos dois dicionários (`sidebar.items`) e, se só alguns papéis escrevem, em `roles.ts`. Área sem item visível some; não deixe um papel com uma área de um item que ele não usa.
- Fixados (até 6) ficam no `localStorage` e os últimos acessos no `sessionStorage` (levam nome de cliente, saem no logout), os dois por admin: `services/admin/panel-prefs.ts`.
- Busca geral (`CommandPalette`, Ctrl+K) usa a busca das listas (`/orders`, `/packages`, `/users`, `/products`) e só mostra o que o papel vê no menu.
- Configurações: nome, assunto e unidade em `configuracoes/settings-catalog.ts` + `settings.names` nos dicionários. Chave sem cadastro aparece com o nome técnico.
- Ficha do cliente: link a partir de pedido, pacote ou encomenda usa `customerHref` (`?de=`), para o "voltar" levar de onde se veio.

## Vitrine da home (14/11/2026)

- Área "Loja", uma página por assunto:
  - **Categorias** (`/admin/categorias`): o cadastro de categorias e, embaixo, foto e ordem dos atalhos da home (`CategoriesTab`).
  - **Feedbacks** (`/admin/vitrine/feedbacks`): posts de unboxing do Instagram.
  - **Avisos** (`/admin/avisos`).
  Tudo fala com `/home/*` no backend.
- Toda gravação pede TOTP (`TotpModal` ou o campo no formulário); sem cadastro de TOTP, abre o cadastro antes. Imagens sobem por PUT presignado (`ImageUploadField`, alvo `BANNER`/`CATEGORY`/`FEEDBACK`) e só valem depois de salvas.
- Feedback só vai ao site com a autorização do cliente marcada. Banner e prateleiras escolhem só produtos da loja de varejo (o backend recusa CoinShop, "Leve junto" e só atacado).
- O cadastro de produto tem idioma, estado (lacrado/avulso) e conteúdo da caixa — alimentam o card e os filtros da loja.
- Textos do painel ficam nos dois dicionários (`pt-br.ts` e `zh-hans.ts`, namespace `storefront`).
