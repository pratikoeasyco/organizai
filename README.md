# Organizaí

**Organize. Simplifique. Faça acontecer.**

> Para colocar no ar: **[DEPLOY.md](DEPLOY.md)** — guia do zero até o Easypanel
> com HTTPS.

Plataforma SaaS de organização de empresas, projetos e tarefas em quadros Kanban
totalmente personalizáveis.

```
Conta → Empresas → Projetos → Quadro → Colunas → Tarefas
```

---

## Como rodar

```bash
npm install          # instala dependências e gera o Prisma Client
npm run db:push      # cria o banco interno (SQLite)
npm run db:seed      # opcional: popula uma conta de demonstração
npm run dev          # http://localhost:3000
```

Conta de demonstração criada pelo seed:

| e-mail                | senha          |
| --------------------- | -------------- |
| `demo@organizai.app`  | `organizai123` |

Ou crie a sua em `/cadastro` — o onboarding cria a primeira empresa e o primeiro
projeto e já abre o quadro.

### Outros comandos

```bash
npm run build              # build de produção
npm start                  # servidor de produção
npm run typecheck          # TypeScript sem emitir
npm run lint               # ESLint
npm run db:studio          # inspeciona o banco visualmente
npm run db:migrate-priorities  # migra prioridades antigas (5 níveis) para os 3 atuais
```

> No Windows, se o PowerShell bloquear scripts (`npm.ps1 não pode ser carregado`),
> use `npm.cmd` no lugar de `npm` — ou libere com
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

---

## Stack

| Camada        | Escolha                                             |
| ------------- | --------------------------------------------------- |
| Framework     | Next.js 15 (App Router) + React 19 + TypeScript      |
| Estilo        | Tailwind CSS v4 com design tokens em `@theme`        |
| Banco         | SQLite (arquivo local) via Prisma 6                  |
| Autenticação  | scrypt (`node:crypto`) + sessão opaca em cookie      |
| Drag and drop | `@dnd-kit`                                           |
| Validação     | Zod, sempre no servidor                              |
| Ícones        | lucide-react                                         |

O banco é **interno**: um arquivo `prisma/organizai.db`. Não há serviço externo,
container ou credencial para configurar.

---

## Arquitetura

```
src/
├── app/
│   ├── (auth)/            login, cadastro, recuperar/redefinir senha
│   ├── (app)/             área autenticada (sidebar + topbar)
│   │   ├── dashboard/
│   │   ├── empresas/[slug]/[configuracoes]
│   │   ├── projetos/[projectId]      ← quadro Kanban
│   │   └── perfil/
│   ├── comecar/           onboarding pós-cadastro
│   └── api/               route handlers do quadro (colunas, tarefas, …)
│
├── components/
│   ├── ui/                design system (Button, Modal, Dropdown, Toast, …)
│   ├── layout/            AppShell, Sidebar, Topbar, CompanySwitcher
│   ├── kanban/            BoardProvider, KanbanBoard, KanbanColumn, TaskCard, TaskPanel
│   ├── companies/ projects/ dashboard/ auth/ onboarding/ profile/
│   └── brand/             logo
│
├── server/
│   ├── services/          regras de negócio + autorização (board, companies, …)
│   └── actions/           server actions consumidas por formulários
│
├── lib/
│   ├── auth/              password (scrypt), session, guards
│   ├── validation/        schemas Zod
│   ├── utils/             cn, format, colors, slug
│   ├── db.ts              singleton do Prisma Client
│   └── api-client.ts      fetch tipado para o quadro
│
└── types/domain.ts        papéis, prioridades e formas serializadas do quadro
```

### Divisão de mutações

- **Server Actions** — autenticação, empresas, projetos, perfil. Formulários com
  `useActionState`, com progressive enhancement (funcionam sem JavaScript).
- **Route Handlers + optimistic updates** — tudo do quadro. O `BoardProvider`
  aplica a mudança na hora, chama a API e faz rollback com toast em caso de erro.
  Isso evita re-renderizar o quadro inteiro a cada arraste.

### Segurança

- Autorização **sempre no servidor**: `requireCompanyAccess` / `requireProjectAccess`
  / `requireColumnAccess` / `requireTaskAccess` em `src/lib/auth/guards.ts`.
  Nenhum serviço lê ou escreve sem passar por um deles.
- Recursos de outra empresa retornam **404**, não 403 — não revela que o ID existe.
- Senhas com scrypt (N=2^15) e salt por usuário; o formato guarda os parâmetros,
  então o custo pode subir no futuro sem invalidar senhas.
- Sessões são tokens aleatórios de 32 bytes; o banco guarda apenas o SHA-256.
  Cookie `httpOnly`, `SameSite=Lax`, `Secure` em produção.
- Trocar a senha encerra todas as sessões abertas.
- Toda entrada passa por Zod na fronteira do servidor. IDs enviados pelo cliente
  (ordem de colunas, coluna de destino, responsável, etiquetas) são verificados
  contra o projeto antes de qualquer escrita.

### Permissões

| Papel        | O que pode fazer                                        |
| ------------ | ------------------------------------------------------- |
| `OWNER`      | Tudo, incluindo excluir a empresa                       |
| `ADMIN`      | Gerencia projetos, membros e configurações              |
| `MEMBER`     | Cria e edita projetos, colunas e tarefas                |
| `VIEWER`     | Só visualiza                                            |

A hierarquia vive em `ROLE_RANK` (`src/types/domain.ts`) e é verificada por
`hasRole` tanto na UI quanto — de forma decisiva — no servidor.

---

## Decisões que valem explicação

**Posições densas em vez de ordenação fracionária.** Mover uma tarefa reindexa
as colunas afetadas (0..n) dentro de uma transação. Custa uma escrita a mais e
elimina qualquer chance de posições duplicadas ou empatadas.

**Excluir coluna nunca apaga tarefas em silêncio.** O diálogo obriga a escolher:
mover para outra coluna, arquivar, ou excluir junto — e essa escolha é validada
de novo no servidor.

**"Concluídas" = última coluna do quadro.** É a leitura que o usuário espera de
um Kanban, sem exigir que ele configure um status especial. Projetos com uma
única coluna não contam nada como concluído. No quadro, essa coluna ganha um
check verde no cabeçalho e seus cards ficam neutros com o check no título — a
urgência deixa de importar depois que a tarefa termina.

**Três níveis de urgência, não cinco.** Baixa · Moderada · Urgente. Cinco níveis
com "Alta" e "Urgente" lado a lado é uma distinção que ninguém aplica com
critério. A urgência aparece na **borda do card**: Baixa fica neutra (card
silencioso), Moderada azul, Urgente vermelha. Como cor não pode ser o único
sinal, Moderada e Urgente também exibem o rótulo escrito.

**Calendário é uma visão, não um tipo de projeto.** Considerei perguntar
"Tarefas ou Calendário?" na criação e descartei: obrigaria a escolher, de forma
irreversível, algo que na vida real se mistura — um projeto de marketing tem
tarefas *e* a reunião de kickoff. Além disso, um projeto sem colunas exigiria um
caminho especial em `getBoard`, `getDashboard`, `ProjectCard` e na sidebar. Em
vez disso: **um conjunto de dados, duas lentes** (`?vista=calendario`). O
calendário lê exatamente o mesmo estado do `BoardProvider`, então alternar é
instantâneo e qualquer edição aparece nas duas visões sem sincronização.

**Reunião é tarefa com hora.** Em vez de um modelo `Event` separado, `Task`
ganhou `hasTime` e `durationMinutes`. Assim uma reunião herda responsável,
descrição, etiquetas, checklist (= pauta) e comentários (= ata) sem duplicar
nada. `hasTime` distingue "12/09 às 14h" (bloco no calendário) de "entregar até
12/09" (faixa do dia inteiro).

**Datas são sempre construídas em hora local.** `new Date("2026-09-12")` é lido
como UTC pelo JavaScript e exibe **11/09** em qualquer fuso negativo — o Brasil
inteiro. Datas sem hora são fixadas ao meio-dia local, o que também as torna
imunes a horário de verão. Isso é validado em `parseLocalDate`, não na interface.

**Concluir pelo calendário move para a última coluna.** Nada de um segundo
conceito de "concluído" competindo com a posição no quadro — há uma única fonte
de verdade, e marcar o check no calendário é literalmente o mesmo `move` do
drag-and-drop.

**Criar tarefa abre um modal com título, descrição e urgência.** A entrada
inline era mais rápida para digitar em série, então o modal tem "Salvar e criar
outra", que limpa o formulário e devolve o foco ao título. No card só o título
aparece; um ícone de linhas (`≡`) indica que existe descrição por trás.

**Recuperação de senha sem serviço de e-mail.** O link de redefinição é exibido
na própria tela, com aviso explícito. A resposta é idêntica para e-mails que
existem e que não existem, então o fluxo não enumera contas.

**Sem `loading.tsx` nas rotas que podem dar 404.** O streaming envia o status 200
antes de o `notFound()` acontecer. Nas rotas de projeto e empresa a correção do
status vale mais que o esqueleto de carregamento.

---

## Preparado para crescer

O schema já contempla, sem que estejam implementados na interface:
anexos (`TaskAttachment`), histórico por tarefa (`Activity`), múltiplos membros
por empresa com papéis, e etiquetas por projeto. Comentários em tempo real,
timeline, templates e billing entram sem remodelar o banco.

**Próximos passos planejados** (nesta ordem, por dependência):

1. **PWA instalável** — manifest, service worker, ícones. Pré-requisito do item 2.
2. **Notificações push** — avisar o responsável quando alguém move a tarefa dele
   de coluna, e lembrar de reuniões com antecedência escolhida pelo usuário.
   Depende de `hasTime`, que já existe. Duas restrições reais a considerar antes:
   no **iOS**, Web Push só funciona com o app instalado na tela de início (não em
   aba do Safari); e o lembrete exige um **processo agendador rodando no
   servidor** — em `npm run dev` local, só dispara enquanto o servidor estiver
   ligado.
3. **Recorrência** ("toda terça às 10h") — parece simples e não é: exige regra de
   repetição, exceções e "editar só esta ocorrência". Merece um passo próprio.

---

## Estado do MVP

Tudo abaixo foi verificado com 120 testes de integração contra o servidor real
(48 do quadro/autorização + 17 de autenticação + 21 de criação de tarefa e
urgência + 34 do calendário, fuso horário e agendamento):

- Cadastro, login, logout, recuperação de senha, rotas protegidas
- Criar / editar / arquivar / excluir empresas e alternar entre elas
- Criar / editar / arquivar / excluir projetos, com busca e abas
- Criar, renomear, recolorir, duplicar, reordenar e excluir colunas
- Criar tarefa por modal (título + descrição + urgência), editar, mover,
  reordenar, arquivar e excluir
- Responsável, urgência, prazo, etiquetas, checklist e comentários
- Drag and drop entre colunas e dentro da coluna, com persistência
- Visão Calendário: mês atual, navegação para meses passados e futuros,
  compromissos com hora e duração, arrastar para remarcar (preservando a hora),
  marcar concluída no chip e criar tarefa clicando no dia
- Filtros (responsável, urgência, etiqueta, prazo) e pesquisa com debounce
- Isolamento de dados entre empresas verificado no servidor
- Loading states, empty states, error states, toasts e confirmações
