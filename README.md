# BiblioTech 📚

Sistema de gestão de biblioteca com **Node.js + MySQL**: acervo, empréstimos, devoluções,
relatórios e contas com dois níveis de acesso (**Usuário** e **Dev**). O site é servido pelo
próprio Node, sem framework de front-end, e conversa com o MySQL por uma API JSON em `/api`.

---

## 1. O que você precisa ter instalado

| Ferramenta | Versão | Como conferir |
|---|---|---|
| Node.js | 18 ou mais novo | `node -v` |
| npm | vem com o Node | `npm -v` |
| MySQL Server | 8.x | `sc query MySQL80` (Windows) |

Não precisa de MySQL Workbench nem do `mysql.exe` no PATH — dá para criar o banco pelo próprio
projeto (passo 4).

---

## 2. Colocar o projeto para rodar (primeira vez)

### 2.1 Clonar o repositório

```bash
git clone https://github.com/gomes4devs/reformulacao-biblio.git
cd reformulacao-biblio
```

Repositório: [`gomes4devs/reformulacao-biblio`](https://github.com/gomes4devs/reformulacao-biblio)

Se você vai testar a branch de desenvolvimento deste trabalho:

```bash
git fetch origin
git switch henriqu
```

> A branch de trabalho é a `henriqu`. Se ela ainda não aparecer na lista
> (`git branch -r`), é porque o commit dela ainda não foi enviado — nesse caso teste a `dev`
> (`git switch dev`).

### 2.2 Instalar as dependências

```bash
npm install
```

### 2.3 Criar o arquivo `.env`

Na **raiz** do projeto (junto do `package.json`), crie um arquivo chamado `.env` com as
credenciais do seu MySQL:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha_do_mysql
DB_NAME=BIBLIOTECA_BD
```

> O `.env` está no `.gitignore`: ele é seu, não vai para o GitHub e não deve ser commitado.
> Se o seu `root` não tiver senha, deixe `DB_PASSWORD=` vazio.

### 2.4 Criar o banco e as tabelas

```bash
npm run db:criar
```

Isso lê o `src/back-end/schema.sql` e cria o banco `BIBLIOTECA_BD` com as tabelas
`usuarios`, `categorias`, `livros`, `acervo` e `emprestimos`. Se elas já existirem, o comando
só avisa e não estraga nada.

> Banco criado antes da exclusão de livros? Rode também `npm run db:livros`, que adiciona a
> coluna `ativo` usada para tirar um livro do catálogo sem perder o histórico.

> Alternativa, se você tem o cliente `mysql` no PATH:
> `mysql -u root -p < src/back-end/schema.sql`

### 2.5 Preparar as contas de acesso

```bash
npm run db:contas
```

Esse passo adiciona as colunas de senha e permissão (em bancos criados antes do login), cria a
**conta base de dev** e dá a senha padrão `1234` a contas antigas que não teriam como entrar.

```
E-mail: dev@gmail.com
Senha:  1234devs
```

### 2.6 Subir o site

```bash
npm start
```

Abra no navegador: **http://127.0.0.1:3000/src/index.html**

Abrir só `http://127.0.0.1:3000` também funciona (redireciona para a página inicial). Sem
login, o site manda você para a tela de entrada.

Durante o desenvolvimento, `npm run dev` reinicia o servidor sozinho a cada alteração no
código.

---

## 3. Contas e permissões

O sistema tem dois papéis. A conta nasce como **Usuário** e só vira **Dev** por promoção de
outro dev.

| Ação | Usuário | Dev |
|---|:---:|:---:|
| Ver início, catálogo, empréstimos e consulta | ✅ | ✅ |
| Emprestar para a própria conta | ✅ | ✅ |
| Devolver os próprios empréstimos | ✅ | ✅ |
| Emprestar/devolver para qualquer pessoa | ❌ | ✅ |
| Cadastrar, editar e excluir livro | ❌ | ✅ |
| Ver a lista de usuários | ❌ | ✅ |
| Criar usuário, mudar permissão e excluir conta | ❌ | ✅ |

**Criar conta:** qualquer pessoa pode se cadastrar em *Criar conta de usuário* (link na tela de
login). O servidor sempre cria como `Usuario` — não adianta forçar `papel: "Dev"` na requisição.

**Esconder não é proteger:** o menu e os botões somem para o usuário comum, mas a garantia real
está no servidor, que responde **403** nas rotas de dev mesmo se alguém chamar a API na mão.

**Sessão:** o login guarda a sessão na memória do servidor e devolve apenas um cookie
`HttpOnly` (o JavaScript da página não consegue ler o token), válido por 8 horas. Por isso,
**reiniciar o servidor desloga todo mundo** — é esperado, não é bug.

---

## 4. Como usar as telas

Todas as páginas ficam em `src/pages/` e são acessadas pelo menu lateral.

### Início
Três cartões com o total de livros, empréstimos ativos e usuários cadastrados, mais a lista dos
empréstimos mais recentes com o status de cada um.

### Livros (catálogo)
Lista o acervo com busca por título/autor e filtros de categoria e disponibilidade. Cada livro
mostra quantos exemplares estão livres.
- **Dev:** a coluna **Ações** aparece com lápis (editar) e lixeira (excluir com confirmação).
- A exclusão tira o livro do catálogo **sem apagar o histórico**: ele some das listas e não pode
  mais ser emprestado, mas os empréstimos antigos continuam nos relatórios. Só é bloqueada
  (409) quando há exemplar emprestado no momento — registre a devolução antes.

### Emprestar Livro
Formulário curto, sem digitar título:
1. Escolha o livro no seletor — só aparecem os que têm exemplar disponível.
2. Informe a data do empréstimo.
3. **Dev:** escolhe também para quem é o empréstimo. **Usuário comum:** empresta para si mesmo
   e o campo de usuário nem aparece.
4. A data prevista de devolução é calculada pelo servidor (14 dias por padrão).

### Devolver Livro
O seletor lista apenas os **empréstimos em aberto**: o dev vê os de todo mundo, o usuário comum
só os dele. Escolha o empréstimo, informe a data real da devolução e confirme — o exemplar volta
a ficar disponível.

### Usuários
Só para dev. Lista nome, e-mail, permissão e ações.
- O seletor de **Permissão** salva na hora, sem botão de confirmar.
- A lixeira exclui a conta, com modal de confirmação.
- Travas: o dev não consegue rebaixar a si mesmo nem remover o último dev do sistema, e não é
  possível excluir alguém que tenha empréstimo em aberto **ou** no histórico (409) — pelo mesmo
  motivo dos livros.

### Cadastrar Usuário
Só para dev. Pede nome, e-mail, senha (mínimo 4 caracteres) e permissão inicial.

### Cadastrar Livro
Só para dev. Pede título, autor, ISBN, editora, ano, categoria, sinopse e **quantidade**. Cada
unidade da quantidade vira uma linha no `acervo` (um exemplar físico). ISBN repetido é barrado.

### Consulta
Relatórios do acervo e da circulação, montados a partir dos mesmos dados da API.

---

## 5. Roteiro rápido de teste (para quem está revisando)

1. Abra o site e entre com `dev@gmail.com` / `1234devs`.
2. **Cadastrar Livro:** cadastre um livro de teste com quantidade 2.
3. **Emprestar Livro:** escolha esse livro, a data de hoje e um usuário; confirme.
4. Volte ao **catálogo**: a disponibilidade deve ter caído de 2 para 1.
5. **Devolver Livro:** o empréstimo deve aparecer no seletor; devolva com a data de hoje.
6. **Usuários:** crie uma conta comum, saia e entre com ela.
7. Confira que o menu de gestão sumiu, que a coluna **Ações** do catálogo não aparece e que o
   campo de usuário não existe em *Emprestar*.
8. Faça um empréstimo com essa conta: deve cair automaticamente nela.
9. Tente abrir `src/pages/usuarios-cadastrados.html` na URL: deve aparecer o cartão de
   **Acesso restrito**.
10. Volte como dev, promova a conta a **Dev** e recarregue: as permissões mudam na hora, sem
    precisar relogar.

---

## 6. Scripts disponíveis

| Comando | O que faz |
|---|---|
| `npm start` | Sobe o site e a API em `http://127.0.0.1:3000` |
| `npm run dev` | Mesmo servidor, reiniciando a cada alteração |
| `npm run db:criar` | Cria o banco e as tabelas a partir do `schema.sql` |
| `npm run db:tabelas` | Cria só as tabelas no banco que já existe (MySQL hospedado) |
| `npm run db:contas` | Adiciona senha/permissão, cria a conta base de dev, migra contas antigas |
| `npm run db:livros` | Adiciona a coluna `ativo` em `livros` (exclusão sem perder histórico) |

Variáveis opcionais no `.env`:

```env
DB_PORT=3306          # só mude se o banco não estiver na 3306 (MySQL hospedado)
PORT=3000             # outra porta, se a 3000 estiver ocupada
HOST=127.0.0.1        # use 0.0.0.0 quando o site estiver hospedado
DIAS_EMPRESTIMO=7     # prazo padrão do empréstimo em dias (padrão: 14)
DEV_EMAIL=...         # e-mail da conta base criada por db:contas
DEV_SENHA=...         # senha da conta base criada por db:contas
```

---

## 7. Estrutura do projeto

```
reformulacao-biblio/
├── src/
│   ├── index.html            # página inicial
│   ├── style.css             # tema visual do site inteiro
│   ├── script.js             # sessão, permissões e todas as telas
│   ├── login.js              # tela de entrada
│   ├── cadastro.js           # criação de conta pelo próprio usuário
│   ├── pages/                # catálogo, empréstimos, usuários, relatórios...
│   └── back-end/
│       ├── server.js         # servidor HTTP + API JSON + regras de acesso
│       ├── connectionDB.js   # pool de conexões com o MySQL
│       ├── senhas.js         # hash de senha (scrypt) e token de sessão
│       ├── criarBanco.js     # npm run db:criar
│       ├── migrarContas.js   # npm run db:contas
│       └── schema.sql        # estrutura do banco
├── docs/STATUS.md            # histórico de alterações do grupo
├── docs/HOSPEDAGEM.md        # tutorial de como publicar o site na internet
├── .env                      # suas credenciais (não versionado)
├── render.yaml               # configuração de deploy no Render
└── package.json
```

---

## 8. API (resumo)

Todas as rotas precisam de login, menos as de sessão e o cadastro aberto.

```
POST   /api/contas         criar conta comum e já entrar
POST   /api/sessoes        entrar (e-mail + senha)
GET    /api/sessoes/atual  quem está logado (401 se ninguém)
DELETE /api/sessoes        sair

GET    /api/dashboard      números da tela inicial
GET    /api/livros         catálogo
GET    /api/emprestimos    empréstimos
POST   /api/emprestimos    emprestar (idLivro + data; dev pode enviar idUsuario)
POST   /api/devolucoes     devolver (idEmprestimo + dataDevolucao)

# somente Dev:
POST   /api/livros         cadastrar livro
PUT    /api/livros/:id     editar livro
DELETE /api/livros/:id     excluir livro do catálogo (409 só com exemplar emprestado)
GET    /api/usuarios       listar usuários
POST   /api/usuarios       cadastrar usuário (com papel)
PUT    /api/usuarios/:id   trocar permissão
DELETE /api/usuarios/:id   excluir conta (409 se houver empréstimo)
```

---

## 9. Problemas comuns

**`'mysql' não é reconhecido como comando`**
O `mysql.exe` não está no PATH. Use `npm run db:criar` (não precisa do cliente) ou rode o
`schema.sql` pelo MySQL Workbench. Para colocar no PATH, adicione
`C:\Program Files\MySQL\MySQL Server 8.0\bin` em *Variáveis de Ambiente → Path* e abra um
terminal novo.

**`ERROR 2003 (HY000): Can't connect to MySQL server on 'localhost:3306'`**
O serviço do MySQL está parado. Confira com `sc query MySQL80` e inicie com `net start MySQL80`
(em um **cmd como administrador**). Depois, `netstat -ano | findstr :3306` precisa mostrar
`LISTENING`.

**`ERROR 1045 (28000): Access denied for user 'root'@'localhost'`**
A senha do `.env` está errada ou ainda é o texto de exemplo.

**O site abre, mas as telas ficam vazias com aviso de conexão**
O MySQL está desligado ou o `.env` não confere. O servidor continua no ar de propósito, para
mostrar o aviso em vez de quebrar.

**`Unknown column 'senha_hash'` / login diz que a conta não tem senha**
O banco é anterior ao sistema de contas. Rode `npm run db:contas`.

**`Unknown column 'ativo'` ao abrir o catálogo ou excluir livro**
O banco é anterior à exclusão sem perda de histórico. Rode `npm run db:livros`.

**Fui deslogado do nada**
O servidor foi reiniciado (as sessões ficam em memória) ou passaram as 8 horas. Entre de novo.

**"Application failed to respond" / 502 no site hospedado**
Falta a variável `HOST=0.0.0.0` no painel da hospedagem, ou o deploy ainda está construindo.
Veja os logs do serviço.

**A porta 3000 já está em uso**
Rode com outra porta: `PORT=3001 npm start` (no PowerShell, `$env:PORT=3001; npm start`).

---

## 10. Colocar o site na internet (Render + Filess.io)

O projeto não roda em hospedagem só de PHP (é o caso do InfinityFree): ele precisa de um lugar
que execute o **Node** e de um **MySQL** acessível pela internet. O caminho mais fácil e grátis
é **Render** (o site) + **Filess.io** (o banco), e o `render.yaml` da raiz já deixa o Render
configurado — você só cola os dados do banco.

Passo a passo completo, escrito para quem nunca hospedou nada:
**[`docs/HOSPEDAGEM.md`](docs/HOSPEDAGEM.md)**.

Resumo em 4 passos:

1. `git push origin main` — o Render lê o código do GitHub, não do seu PC.
2. Criar um MySQL grátis no Filess.io e copiar host, porta, usuário, senha e nome do banco.
3. No seu PC, com o `.env` apontando para esse banco: `npm run db:tabelas`,
   `npm run db:contas` e `npm run db:livros`.
4. No Render: *New → Blueprint* → escolher o repositório → colar os cinco valores do banco →
   *Deploy*. O endereço público aparece como `https://bibliotech-xxxx.onrender.com`.

> Limites do grátis: o banco tem **10 MB** (sobra para um trabalho acadêmico) e o site **dorme
> após ~15 minutos** sem visita, acordando na primeira requisição (30–60 s).

---

## 11. Antes de enviar alterações

```bash
git switch henriqu
git pull origin henriqu
# ... suas alterações ...
npm start            # confira o site
git status
git add .
git commit -m "feat: <o que você fez>"
git push origin henriqu
```

Anote o que mudou em [`docs/STATUS.md`](docs/STATUS.md) — o grupo usa esse arquivo como
histórico do projeto.
