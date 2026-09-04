# Deploy no Easypanel

Guia do zero até o Organizaí no ar com HTTPS.

---

## Antes de começar

Você vai precisar de três coisas que **ainda não existem** nesta máquina:

1. **Git instalado** — https://git-scm.com/download/win
2. **Uma conta no GitHub** (ou GitLab) com um repositório para este projeto
3. **Um servidor com Easypanel** instalado e um domínio apontado para ele

O Easypanel monta a imagem a partir de um repositório Git. Não há como enviar a
pasta direto.

---

## 1. Colocar o código no GitHub

Depois de instalar o Git, na pasta do projeto:

```powershell
git init
git add .
git commit -m "Organizaí"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/organizai.git
git push -u origin main
```

> O `.gitignore` já exclui `.env`, `node_modules` e os arquivos `.db`. **Nenhuma
> senha ou chave vai para o repositório** — as chaves ficam só no Easypanel.

Como o repositório vai conter o código do seu produto, crie-o **privado**.

---

## 2. Gerar os segredos de produção

As chaves que estão hoje no `.env` foram geradas para desenvolvimento. Gere
outras para produção:

```powershell
npm.cmd run push:keys
```

Guarde a saída. Gere também um segredo para o agendador — qualquer texto longo e
aleatório serve:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 3. Criar o serviço no Easypanel

**Project → Create Service → App**

Na aba **Source**:
- Provider: GitHub
- Repositório e branch `main`

Na aba **Build**:
- Method: **Dockerfile**
- Dockerfile path: `Dockerfile`

Na aba **Build Args**, adicione:

| Nome | Valor |
| --- | --- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | a chave **pública** gerada |

> Isto é obrigatório e é o erro mais fácil de cometer. Essa chave é embutida no
> JavaScript que roda no navegador, durante a **construção da imagem**. Se ela
> for informada apenas como variável de ambiente, o build sai sem a chave e o
> botão de ativar notificações nunca funciona — sem nenhuma mensagem de erro.

---

## 4. Volume persistente (obrigatório)

**Aba Volumes → Add Volume**

| Campo | Valor |
| --- | --- |
| Type | Volume |
| Name | `organizai-data` |
| Mount path | `/app/data` |

**Sem isso, todos os dados são apagados a cada novo deploy.** O banco é um
arquivo; se ele ficar dentro do container, some junto com o container.

---

## 5. Variáveis de ambiente

**Aba Environment:**

```env
DATABASE_URL=file:/app/data/organizai.db

SESSION_COOKIE_NAME=organizai_session
SESSION_TTL_DAYS=30

NEXT_PUBLIC_VAPID_PUBLIC_KEY=<a mesma chave pública do Build Arg>
VAPID_PRIVATE_KEY=<a chave privada>
VAPID_SUBJECT=mailto:voce@seudominio.com

ENABLE_REMINDER_SCHEDULER=true
CRON_SECRET=<o segredo aleatório gerado>

ADMIN_EMAIL=voce@seudominio.com
ADMIN_PASSWORD=<uma senha forte>
ADMIN_NAME=Seu Nome
```

`ADMIN_EMAIL` e `ADMIN_PASSWORD` criam a conta de administrador na primeira
subida. Se a conta já existir, nada é alterado e **a senha não é sobrescrita** —
pode deixar as variáveis lá sem risco.

---

## 6. Domínio e HTTPS

**Aba Domains → Add Domain**, informe seu domínio e deixe o **HTTPS ligado**
(o Easypanel emite o certificado Let's Encrypt sozinho).

Três coisas **dependem de HTTPS** e simplesmente não funcionam sem ele:

- **Login** — o cookie de sessão é `Secure` em produção. Acessando por HTTP ou
  por IP direto, o login parece funcionar e devolve para a tela de login.
- **Notificações push** — o navegador exige contexto seguro.
- **Instalar o app (PWA)** — idem.

Configure o domínio antes de testar, ou vai parecer que há um bug de login.

---

## 7. Health check

**Aba Advanced → Health Check:**

| Campo | Valor |
| --- | --- |
| Path | `/api/health` |
| Port | `3000` |

Esse endpoint consulta o banco de verdade. Um container que subiu mas perdeu o
banco é reportado como não saudável, em vez de ficar no ar quebrado.

---

## 8. Deploy

Clique em **Deploy**. Nos logs você deve ver, nesta ordem:

```
[organizai] aplicando migrações...
[organizai] garantindo a conta de administrador...
[organizai] agendador de lembretes ativo (a cada 60s)
✓ Ready
```

Acesse seu domínio e entre com o `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

---

## ⚠️ Uma instância só

Deixe **Replicas = 1**. Não escale este serviço.

Dois componentes vivem dentro do processo do servidor:

- o **barramento de eventos** que faz as telas se atualizarem ao vivo
- o **agendador** que dispara os lembretes

Com duas réplicas, cada uma avisaria apenas os seus próprios conectados, e a
atualização ao vivo passaria a funcionar pela metade — de forma intermitente,
que é o pior tipo de defeito para diagnosticar. Além disso o SQLite é um
arquivo: dois containers escrevendo nele corromperiam o banco.

Para crescer além de uma instância, dois passos, nesta ordem:
1. trocar o SQLite por PostgreSQL (o schema já é compatível — só muda o
   `provider` e a `DATABASE_URL`);
2. trocar o barramento em `src/server/events/bus.ts` por Redis pub/sub, e
   desligar `ENABLE_REMINDER_SCHEDULER`, apontando um cron externo para
   `POST /api/notifications/tick` com o cabeçalho `x-cron-secret`.

---

## Atualizar a aplicação

```powershell
git add .
git commit -m "o que mudou"
git push
```

No Easypanel, **Deploy**. As migrações pendentes são aplicadas sozinhas ao subir.

Quem já instalou o app no celular **não precisa reinstalar**: o service worker
procura versão nova ao reabrir o app e se atualiza sozinho.

---

## Backup

O banco é um arquivo dentro do volume. Para copiá-lo:

```bash
docker ps                          # descubra o nome do container
docker cp <container>:/app/data/organizai.db ./backup-$(date +%F).db
```

Vale agendar isso no servidor. Hoje não há rotina automática de backup.

---

## Se algo der errado

**Login devolve para a tela de login**
Falta HTTPS. Confirme que o domínio está com certificado e que você está
acessando por `https://`, não por IP.

**Botão de ativar notificações não faz nada**
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` não foi informada como **Build Arg**. Corrija e
reconstrua a imagem — só reiniciar não resolve, a chave entra no build.

**Os dados sumiram depois de um deploy**
O volume não estava montado em `/app/data`, ou a `DATABASE_URL` não aponta para
lá. Confira as duas coisas juntas.

**Lembretes não chegam**
Verifique `ENABLE_REMINDER_SCHEDULER=true` e `CRON_SECRET` preenchido. Nos logs
deve aparecer a linha do agendador ao subir.

**No iPhone as notificações não chegam**
No iOS o push só funciona com o app **instalado na tela de início** (iOS 16.4+).
No Safari em aba comum, não chega — é limitação da Apple, não do app.
