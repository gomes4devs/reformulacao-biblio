# Colocar o BiblioTech na internet (versão fácil: Render + Filess.io)

Este é o caminho com **menos cliques** que achei para este projeto. Ele usa dois sites grátis,
sem cartão de crédito:

- **Filess.io** guarda o banco MySQL (criar o banco leva ~1 minuto e ele já te entrega
  prontinho o endereço, o usuário e a senha).
- **Render** roda o site Node.

O projeto já vem com o arquivo `render.yaml`, que faz o Render configurar o serviço sozinho:
você só cola os dados do banco.

Tempo: 15 a 20 minutos. Se algo der errado, vá direto para **Problemas comuns** no final.

---

## Passo 0 — Mandar o código para o GitHub

```bash
git status          # precisa dizer "working tree clean"
git push origin main
```

O Render e o Filess.io não pegam código do seu computador: eles pegam do GitHub. Então esse
push precisa ter acontecido, inclusive com o `render.yaml`.

---

## Passo 1 — Criar o banco no Filess.io

1. Abra <https://panel.filess.io/register> e crie a conta (pode entrar com o GitHub).
   Não pede cartão.
2. No painel, escolha criar um **banco de dados** (*Create database* / *New database*).
3. Escolha:
   - Engine: **MySQL** (versão **8**);
   - Plano: **Free** (Shared);
   - Nome: pode ser `bibliotech`.
4. Clique em criar. Em poucos segundos aparece a **connection string**, parecida com:

   ```
   mysql://usuario:senha@alguma-coisa.filess.io:3306/bibliotech
   ```

   (o host e a porta podem ser diferentes; o formato é sempre esse)

5. Guarde essa linha em um bloco de notas. Dela saem os quatro dados que o site precisa:
   - **DB_HOST** → o pedaço depois do `@` e antes dos dois-pontos
   - **DB_PORT** → o número depois dos dois-pontos
   - **DB_USER** → o pedaço antes dos dois-pontos iniciais
   - **DB_PASSWORD** → o pedaço entre os dois-pontos iniciais e o `@`
   - **DB_NAME** → o pedaço depois da última `/`

> Dica: no painel do Filess.io esses mesmos valores aparecem separados, em um quadro de
> "Connection details". Se estiverem à mão, use-os direto, sem precisar quebrar a URL.

---

## Passo 2 — Criar as tabelas no banco da nuvem

O banco novo está vazio. Este passo roda no **seu computador**, uma única vez.

1. Abra o `.env` da raiz do projeto e troque o conteúdo por:

   ```env
   DB_HOST=alguma-coisa.filess.io
   DB_PORT=3306
   DB_USER=usuario
   DB_PASSWORD=senha
   DB_NAME=bibliotech
   ```

2. Rode os três comandos, um de cada vez:

   ```bash
   npm run db:tabelas
   npm run db:contas
   npm run db:livros
   ```

   O que deve aparecer:
   - `db:tabelas` → `Tabelas criadas em bibliotech.` e, na linha seguinte, os nomes das
     tabelas (`Banco bibliotech — tabelas: usuarios, categorias, ...`)
   - `db:contas` → mensagem sobre a conta base `dev@gmail.com` criada
   - `db:livros` → `Coluna ativo criada em livros.` (ou aviso de que já existe)

3. Depois de terminar, **volte o `.env` para o seu MySQL local** (o que estava antes), senão os
   testes na sua máquina passam a mexer no banco da nuvem.

> Se aparecer erro de SSL, acrescente a linha `DB_SSL=true` no `.env` e rode de novo.

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
   | `DB_HOST` | host do Filess.io |
   | `DB_PORT` | porta do Filess.io |
   | `DB_USER` | usuário do Filess.io |
   | `DB_PASSWORD` | senha do Filess.io |
   | `DB_NAME` | nome do banco (`bibliotech`) |

   (`HOST=0.0.0.0` já vem preenchido pelo `render.yaml` — não mexa.)

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
git push origin main
```

Os dados do banco **não** são apagados nesse processo.

---

## O que esperar dos planos grátis

| | Filess.io (banco) | Render (site) |
|---|---|---|
| Preço | R$ 0, sem cartão | R$ 0, sem cartão |
| Limite | 10 MB (sobra muito para um trabalho) | 750 horas de máquina por mês |
| Dorme? | pode suspender e acordar sozinho | sim, após ~15 min sem visita |
| Primeira visita depois de dormir | alguns segundos | 30 a 60 segundos |

Se a apresentação for ao vivo, **abra o site 1 minuto antes** da sua vez: a primeira requisição
depois do sono é a demorada.

---

## Por que não Vercel (e por que o InfinityFree não serve)

- **Vercel** roda funções curtas, não um servidor Node que fica ligado escutando uma porta. O
  `server.js` deste projeto (e as sessões guardadas na memória) não cabem lá sem reescrever a
  aplicação. Não é uma questão de configuração.
- **InfinityFree** roda somente PHP e o MySQL dele só aceita conexão de dentro da própria
  conta. Não executa Node e não serve como banco para outro host.

---

## Problemas comuns

**A página demora muito na primeira vez / "service is spinning up"**
Normal no plano grátis do Render. Recarregue depois de ~1 minuto.

**"Application failed to respond" (502)**
Confira nas *Environment Variables* do Render se existe `HOST` com valor `0.0.0.0` (o
`render.yaml` já cria) e veja os **Logs** do deploy.

**O site abre, mas as telas ficam vazias**
As variáveis `DB_*` estão erradas. Nos logs deve aparecer `MySQL conectado em ...`; se aparecer
"sem conexão", corrija os dados do Filess.io em *Environment → Environment Variables* e clique
em **Manual Deploy → Deploy latest commit**.

**`Unknown column 'ativo'`**
Você não rodou `npm run db:livros` no banco da nuvem. Volte ao passo 2.

**Erro de SSL ao rodar `db:tabelas`**
Acrescente `DB_SSL=true` no `.env` (e no Render, em *Environment Variables*) e repita.

**Fui deslogado do nada**
As sessões ficam na memória do servidor: todo deploy/reinício desloga geral. É esperado.

**O banco ficou cheio / não aceita mais dados**
O plano grátis do Filess.io tem 10 MB. Para um trabalho acadêmico é bastante, mas cadastros em
massa podem estourar. Dá para apagar os dados de teste pelo painel do Filess.io.
