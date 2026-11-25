# Colocar o BiblioTech na internet (versão fácil: Render + TiDB Cloud)

Este é o caminho com **menos cliques** para este projeto. Ele usa dois serviços grátis, **sem
cartão de crédito**:

- **TiDB Cloud Starter** guarda o banco. Ele fala a mesma língua do MySQL (os comandos e o
  `mysql2` do projeto funcionam igual), tem **5 GB grátis** e não dorme.
- **Render** roda o site Node.

O `render.yaml` da raiz já deixa o Render quase todo configurado: você só cola os dados do banco.

> O Filess.io, que era a primeira opção, está **sem vagas para novos bancos**. Se um dia abrir
> vaga, os passos são os mesmos — muda só de onde vêm host/usuário/senha.

Tempo: 20 minutos. Se algo der errado, vá direto para **Problemas comuns** no final.

---

## Passo 0 — Mandar o código para o GitHub

```bash
git status          # precisa dizer "working tree clean"
git push origin henriqu
```

O Render não pega código do seu computador: ele pega do GitHub. Então esse push precisa ter
acontecido, inclusive com o `render.yaml`.

> A branch de trabalho é a **`henriqu`** — é ela que o Render observa (a `main` foi removida do
> repositório). Confira o campo **Branch** ao criar o serviço.

---

## Passo 1 — Criar o banco no TiDB Cloud

1. Abra <https://tidbcloud.com/free-trial> e crie a conta (pode entrar com GitHub ou Google).
   Não pede cartão.
2. Ao entrar, o TiDB já cria uma instância chamada **`Instance0`**. Se não aparecer, clique em
   **Create Resource** → plano **Starter** → modo **MySQL Compatible** → escolha a região mais
   próxima (para o Brasil, algo como **AWS / us-east-1**) → **Create**. Fica pronta em ~30 s.
3. Clique no nome da instância e depois em **Connect** (canto superior direito).
4. No quadro que abre:
   - **Connection Type**: deixe **Public** (é por onde o Render e o seu PC vão conectar);
   - clique em **Generate Password** e **copie a senha na hora** — ela só aparece uma vez;
   - no exemplo de conexão aparecem o **host**, a **porta** (normalmente `4000`) e o **usuário**.
5. Guarde no bloco de notas estes cinco dados:

   | Campo | Onde está |
   |---|---|
   | `DB_HOST` | endereço tipo `gateway01.us-east-1.prod.aws.tidbcloud.com` |
   | `DB_PORT` | número ao lado do host (geralmente `4000`) |
   | `DB_USER` | usuário que **termina em `.root`**, tipo `3AbCdEfGhIjK.root` |
   | `DB_PASSWORD` | a senha que você gerou agora |
   | `DB_NAME` | `bibliotech` (você vai criar no passo seguinte) |

   > O usuário tem esse prefixo esquisito de propósito: **copie inteiro**, com o ponto e o
   > `.root` no final. Só ele consegue entrar nessa instância.

6. **Crie o banco de dados.** Na página da instância, abra a aba **SQL Editor** e rode:

   ```sql
   CREATE DATABASE IF NOT EXISTS bibliotech;
   ```

   (cole no editor e clique em **Run** / `Ctrl + Enter`). Sem isso, o próximo passo dá
   `Unknown database 'bibliotech'`. Deixe `DB_NAME=bibliotech` no `.env`, com esse nome mesmo.

---

## Passo 2 — Criar as tabelas no banco da nuvem

O banco novo está vazio (tem só a "casca"). Este passo roda no **seu computador**, uma única vez.

1. Abra o `.env` da raiz do projeto e troque o conteúdo por:

   ```env
   DB_HOST=gateway01.us-east-1.prod.aws.tidbcloud.com
   DB_PORT=4000
   DB_USER=3AbCdEfGhIjK.root
   DB_PASSWORD=a_senha_que_voce_gerou
   DB_NAME=bibliotech
   DB_SSL=true
   ```

   O `DB_SSL=true` **não é opcional** no TiDB: ele só aceita conexão criptografada. Sem essa
   linha o erro é de SSL/handshake.

2. Rode os três comandos, um de cada vez:

   ```bash
   npm run db:tabelas
   npm run db:contas
   npm run db:livros
   ```

   O que deve aparecer:
   - `db:tabelas` → `Tabelas criadas em bibliotech.` e, na linha seguinte, os nomes das tabelas
     (`Banco bibliotech — tabelas: usuarios, categorias, ...`)
   - `db:contas` → mensagem sobre a conta base `dev@gmail.com` criada
   - `db:livros` → `Coluna ativo criada em livros.` (ou aviso de que já existe)

3. Depois de terminar, **volte o `.env` para o seu MySQL local**, senão os testes na sua
   máquina passam a mexer no banco da nuvem.

---

## Passo 3 — Publicar o site no Render

1. Abra <https://dashboard.render.com/register> e crie a conta com **GitHub** (sem cartão).
2. No painel, clique em **New** e escolha **Blueprint**.
   *(Blueprint é o modo em que o Render lê o `render.yaml` do projeto e monta tudo sozinho.)*
3. Conecte o GitHub e escolha o repositório **`gomes4devs/reformulacao-biblio`**.
4. O Render mostra uma tela chamada *Blueprint* com o serviço **bibliotech** e pede os valores
   das variáveis que estão como `sync: false`. Preencha com os mesmos dados do passo 1:

   | Campo | Valor |
   |---|---|
   | `DB_HOST` | host do TiDB |
   | `DB_PORT` | `4000` |
   | `DB_USER` | usuário `.root` do TiDB |
   | `DB_PASSWORD` | senha gerada no TiDB |
   | `DB_NAME` | `bibliotech` |

   (`HOST=0.0.0.0` e `DB_SSL=true` já vêm preenchidos pelo `render.yaml` — não mexa.)

5. Clique em **Deploy Blueprint** / **Apply** e espere. A primeira construção leva alguns
   minutos; acompanhe em **Logs**. O final feliz é uma linha parecida com:

   ```
   MySQL conectado em bibliotech.
   Site: http://127.0.0.1:10000/src/index.html
   ```

6. No topo da página do serviço aparece o endereço público, algo como
   **`https://bibliotech-xxxx.onrender.com`**. Abra no navegador.

---

## Passo 4 — Conferir se está funcionando de verdade

Na URL do Render:

1. Entre com `dev@gmail.com` / `1234devs`.
2. **Cadastrar Livro** → cadastre um livro de teste (quantidade 1).
3. **Emprestar Livro** → escolha o livro e a data de hoje.
4. **Devolver Livro** → devolva o mesmo empréstimo.
5. **Livros** → exclua o livro de teste (deve sair do catálogo, sem erro).
6. **Usuários** → crie uma conta comum e veja se ela entra.

Se os seis passos funcionaram, o site está publicado de verdade — não é só a página abrindo.

---

## Passo 5 — Atualizar o site depois

O Render observa o GitHub e publica sozinho a cada push:

```bash
git add .
git commit -m "feat: o que você mudou"
git push origin henriqu
```

Os dados do banco **não** são apagados nesse processo.

> O repositório usa **apenas a branch `henriqu`** (a `main` foi removida). Por isso, no painel do
> Render, o campo **Settings → Build & Deploy → Branch** precisa estar `henriqu` — se estiver
> apontando para uma branch que não existe, o deploy falha.

---

## O que esperar dos planos grátis

| | TiDB Cloud Starter (banco) | Render (site) |
|---|---|---|
| Preço | R$ 0, sem cartão | R$ 0, sem cartão |
| Limite | 5 GB + 50 milhões de operações/mês | 750 horas de máquina por mês |
| Dorme? | não | sim, após ~15 min sem visita |
| Primeira visita depois de dormir | — | 30 a 60 segundos |

Se a apresentação for ao vivo, **abra o site 1 minuto antes** da sua vez: a primeira requisição
depois do sono é a demorada.

---

## Por que não Vercel (e por que o InfinityFree não serve)

- **Vercel** roda funções curtas, não um servidor Node que fica ligado escutando uma porta. O
  `server.js` deste projeto (e as sessões guardadas na memória) não cabem lá sem reescrever a
  aplicação. Não é uma questão de configuração.
- **InfinityFree** roda somente PHP e o MySQL dele só aceita conexão de dentro da própria
  conta. Não executa Node e não serve como banco para outro host.
- **Railway, Clever Cloud, Aiven, PlanetScale**: o acesso grátis a MySQL foi limitado ou
  encerrado nesses serviços em 2025–2026. O TiDB Cloud é o único que continua abrindo conta
  grátis sem cartão.

---

## Problemas comuns

**A página demora muito na primeira vez / "service is spinning up"**
Normal no plano grátis do Render. Recarregue depois de ~1 minuto.

**"Application failed to respond" (502)**
Confira nas *Environment Variables* do Render se existe `HOST` com valor `0.0.0.0` (o
`render.yaml` já cria) e veja os **Logs** do deploy.

**`Unknown database 'bibliotech'`**
Você não rodou o `CREATE DATABASE` no **SQL Editor** do TiDB (passo 1.6), ou o `DB_NAME` do
`.env` está com outro nome.

**`Access denied for user ...`**
O `DB_USER` precisa ser o nome **completo**, terminando em `.root`. Copie de novo do quadro
**Connect** do TiDB.

**Erro de SSL / `HANDSHAKE_NO_SSL_SUPPORT`**
Falta `DB_SSL=true`. No TiDB ele é obrigatório — tanto no `.env` quanto no Render.

**O site abre, mas as telas ficam vazias**
As variáveis `DB_*` estão erradas. Nos logs do Render deve aparecer `MySQL conectado em ...`;
se aparecer aviso de conexão, corrija em *Environment → Environment Variables* e clique em
**Manual Deploy → Deploy latest commit**.

**`Unknown column 'ativo'`**
Você não rodou `npm run db:livros` no banco da nuvem. Volte ao passo 2.

**Fui deslogado do nada**
As sessões ficam na memória do servidor: todo deploy/reinício desloga geral. É esperado.

**O banco ficou cheio**
5 GB de plano grátis é muita coisa para um trabalho acadêmico. Se chegar perto, apague os
dados de teste pelo SQL Editor do TiDB (`DELETE FROM emprestimos;` etc.).
