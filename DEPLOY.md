# Deploy no Easypanel

Guia do zero até o Organizaí no ar com HTTPS.

---

## Antes de começar

Já estão prontos:

- **Git instalado** e o código publicado em
  https://github.com/pratikoeasyco/organizai (branch `main`)
- **PostgreSQL** rodando e com o schema aplicado

Falta:

- **Um servidor com Easypanel** e um domínio apontado para ele

O Easypanel monta a imagem a partir do repositório Git.

---

## 1. Enviar as alterações

```powershell
git add .
git commit -m "o que mudou"
git push
```

> O `.gitignore` exclui `.env`, `node_modules` e arquivos `.db`. **Nenhuma senha
> ou chave vai para o repositório** — elas ficam só no Easypanel.

O repositório contém o código do seu produto: mantenha-o **privado**.

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

## 4. Banco de dados (PostgreSQL)

O banco é um **PostgreSQL externo**, fora do container. Nada de volume: o
container é descartável e pode ser reconstruído sem perder dado nenhum.

O schema é aplicado sozinho ao subir, pelo `migrate deploy`. Você não precisa
criar tabela nenhuma à mão.

### Prefira o host interno

Se o PostgreSQL está no **mesmo servidor Easypanel** que a aplicação, use o
nome interno do serviço em vez do domínio público:

```env
# interno — o tráfego não sai da máquina
DATABASE_URL=postgres://postgres:SENHA@meu-projeto_postgres:5432/site?sslmode=disable

# público — sai para a internet e volta
DATABASE_URL=postgres://postgres:SENHA@sgcsolutions.com.br:7543/site?sslmode=disable
```

O host interno é mais rápido e, principalmente, **não trafega a senha pela
internet**. Este servidor não aceita conexão criptografada (testado: recusa
SSL), então pelo host público a senha e todos os dados viajam em texto claro.
Pela rede interna isso deixa de importar.

O nome do host interno aparece no Easypanel, na página do serviço PostgreSQL.

---

## 5. Variáveis de ambiente

**Aba Environment:**

```env
DATABASE_URL=postgres://postgres:SENHA@HOST:PORTA/site?sslmode=disable

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
que é o pior tipo de defeito para diagnosticar. O agendador, por sua vez,
dispararia o mesmo lembrete uma vez por réplica.

O banco já não é obstáculo: o PostgreSQL aguenta várias instâncias sem
problema. O que falta para escalar:

1. trocar o barramento em `src/server/events/bus.ts` por Redis pub/sub;
2. desligar `ENABLE_REMINDER_SCHEDULER` e apontar um cron externo para
   `POST /api/notifications/tick` com o cabeçalho `x-cron-secret`, para o
   lembrete sair uma vez só.

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

Cópia completa do banco, de qualquer máquina que alcance o PostgreSQL:

```bash
pg_dump "postgres://postgres:SENHA@HOST:PORTA/site" -Fc -f backup-$(date +%F).dump
```

Para restaurar:

```bash
pg_restore -d "postgres://postgres:SENHA@HOST:PORTA/site" --clean backup-2026-09-04.dump
```

Vale agendar isso no servidor. **Hoje não há rotina automática de backup** — e
com dados reais em produção isso deixa de ser detalhe.

---

## Se algo der errado

**Login devolve para a tela de login**
Falta HTTPS. Confirme que o domínio está com certificado e que você está
acessando por `https://`, não por IP.

**Botão de ativar notificações não faz nada**
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` não foi informada como **Build Arg**. Corrija e
reconstrua a imagem — só reiniciar não resolve, a chave entra no build.

**O container não sobe e o log para em "aplicando migrações"**
A `DATABASE_URL` está errada ou o PostgreSQL não é alcançável de dentro do
container. Se você usou o domínio público, tente o **host interno** do serviço
PostgreSQL no Easypanel. O entrypoint falha de propósito nesse caso: subir com
o banco inacessível só adiaria o erro para o primeiro usuário.

**Aparece "database ... does not exist"**
O banco precisa existir antes; o `migrate deploy` cria as *tabelas*, não o
banco. Crie-o pelo painel do PostgreSQL no Easypanel.

**Lembretes não chegam**
Verifique `ENABLE_REMINDER_SCHEDULER=true` e `CRON_SECRET` preenchido. Nos logs
deve aparecer a linha do agendador ao subir.

**No iPhone as notificações não chegam**
No iOS o push só funciona com o app **instalado na tela de início** (iOS 16.4+).
No Safari em aba comum, não chega — é limitação da Apple, não do app.
