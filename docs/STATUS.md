# Alterações

---

Feat Charlinho 28/09:

Estrutura Inicial do Projeto
Importação imagens
Criação branch main e dev

---

## Feat Charlinho 01/10:

- No computador na escola abri e me loguei no mysql e criei um database "BIBLIOTECA_BD".
- Instalei o node com ``npm install``
- Instalei o driver mysql para tornar possível a conexão com o servidor mysql:
``npm install mysql2`` (Rodar no terminal)
- 
- No caminho src/backend/connectionDB.js digitei e executei:

```js 
let mysql = require('mysql2'); 

let con = mysql.createConnection({
  host: "localhost",         // Endereço (máquina local)  
  user: "root",              // Usuário padrão
  password: "",              // Deixei vazio já que não tem senha
  database: "BIBLIOTECA_BD"  // O nome do banco entra aqui separadamente
});

con.connect(function(err) {
  if (err) throw err;
  console.log("Connected!");
}); 

```
Ali em vez de 'localhost' poderia deixar apenas o ip também da máquina local, que é sempre 127.0.0.1
Vai funcionar do mesmo jeito

- Executei com `node connectionDB.js` na pasta do arquivo. Resultado:

``Connected!``

**Erros:**

Antes de ter dado certo, teve alguns erros:

Na linha ``let mysql = require('mysql2');`` eu tinha deixado apenas ``let mysql = require('mysql');``. Tomar cuidado porque o nome do driver que tem que instalar é mysql2.

### Depois disso:

Pesquisando na net a IA disse que era preciso criar um arquivo .env porque é nesse arquivo que vai ficar as credenciais de login como senha e usuário que usamos quando abrimos o mysql.

```env

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=minha_senha
DB_NAME=BIBLIOTECA_BD

```

E no connectionDB.js:

```js
require('dotenv').config({ path: '../../.env' });
let mysql = require('mysql2');

let con = mysql.createConnection({
  host: process.env.DB_HOST,         // Apenas o endereço, sem "mysql://"
  user: process.env.DB_USER,              // Usuário padrão
  password: process.env.DB_PASSWORD,              // Deixe vazio já que não tem senha
  database: process.env.DB_NAME  // O nome do banco entra aqui separadamente
});

con.connect(function(err) {
  if (err) throw err;
  console.log("Connected!");
});
```

Agora qualquer um que importar o projeto do github pode usar o próprio banco de dados colocando suas próprias credenciais.

---
## Feat Charlinho 03/10:

- Reescrevi o `connectionDB.js` usando `import` em vez de `require` (ES Modules):

```js
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

let connect = await mysql.createPool({
  host: process.env.DB_HOST,         // Apenas o endereço, sem "mysql://"
  user: process.env.DB_USER,              // Usuário padrão
  password: process.env.DB_PASSWORD,              // Deixe vazio já que não tem senha
  database: process.env.DB_NAME  // O nome do banco entra aqui separadamente
})

console.log("Connected!");

export default connect;
```
A IA me recomendou fazer iss porque é mais moderno do que usar o require.

E para que isso funcionasse, foi necessário dar um ``npm init -y` para criar um package.json, e escrever em baixo de description: 

```json
"type": "module",

```

**O que mudou:**

- `require('dotenv').config({ path: '../../.env' })` virou `import dotenv from 'dotenv'` + `dotenv.config()`.
- `require('mysql2')` virou `import mysql from 'mysql2/promise'`. Com a versão `/promise` dá pra usar `await` em vez de callback, então não precisei mais do `con.connect(function(err) {...})`.
- Troquei `createConnection` por `createPool`. Deu certo com os dois, mas o pool é melhor porque guarda um conjunto de conexões que podem ser reaproveitadas, em vez de ficar só em uma.
- Adicionei `export default connect;` para qualquer outro arquivo `.js` do projeto importar a conexão sem criar outra a cada consulta.
- Escrevi comentários no código para quem clonar o projeto entender o que cada parte faz.

**Como usar em outro arquivo:**

```js
import pool from './connectionDB.js';

const [livros] = await pool.query('SELECT * FROM livros');
```

**Atenção:**

- Não usar `pool.end()` dentro do `connectionDB.js`, senão o pool fecha logo depois de ser criado.
- O `console.log("Connected!")` aparece mesmo se o banco não conectar, porque o pool só abre a conexão de verdade quando faz a primeira consulta.

---

## Feat Henrique 05/10:**

- Começamos a reconstruir o JavaScript da página de cadastro do zero, descartando o JS antigo para evitar código desnecessário e facilitar a organização do projeto.

- Primeiro, testamos a ligação entre o HTML e o JavaScript usando um `alert`, confirmando que o arquivo `.js` estava sendo carregado corretamente.

- Depois, adicionamos um `eventListener` no formulário para detectar o evento `submit`:

```js
formulario.addEventListener("submit", function(event) {
    event.preventDefault();
});
```

O `event.preventDefault()` impede que o comportamento padrão do formulário aconteça, permitindo que o JavaScript controle o envio dos dados.

- Em seguida, aprendemos a buscar os campos do formulário pelo `id` e acessar o conteúdo digitado pelo usuário através de `.value`:

```js
const nome = document.getElementById("input-nome").value;
const email = document.getElementById("input-email").value;
```

- Testamos os valores usando `console.log()`, confirmando que o JavaScript consegue receber corretamente o nome e o e-mail preenchidos no formulário.

- Inicialmente seria utilizado `localStorage` para armazenar os dados, mas decidimos não seguir por esse caminho, pois o objetivo do projeto é utilizar o banco de dados SQL. Assim, evitamos implementar uma solução temporária que posteriormente precisaria ser removida.

- O próximo passo será fazer o JavaScript do frontend enviar os dados para um backend, que ficará responsável por realizar a comunicação com o MySQL/MariaDB e inserir os usuários no banco de dados.

---
## Feat Charlinho: 15/10/2026

- Modelagem de Dados Conceitual, Lógica e Física
- Documentação da Modelagem de Dados Conceitual, Lógica e Física em ../docs/Modelagem_De_Dados
- Criação do Schema.sql que será o banco de dados para o backend no projeto.

Próximos passos:

- Testar a integridade do banco de dados fazendo registros válidos e inválidos no mysql, pra ver se está funcionando.

---
## Feat Henrique : Port das páginas do Biblio-Tech: 25/11/2026

- O projeto só tinha `src/pages/cadastro-usuarios.html`; o `index.html` já linkava todas as outras telas, então os links caíam em 404.
- Portadas do repositório `DevKhal-EL/Biblio-Tech` (branch `main`) para `src/pages/`: `catalogo-livros.html`, `consulta.html`, `usuarios-cadastrados.html`, `cadastro-livros.html`, `emprestimos.html` e `devolucao.html`.
- Os caminhos já funcionam com a estrutura atual, sem precisar mudar nada: `../style.css`, `../script.js`, `../index.html`, `../../assets/icons/...` e os links entre páginas da mesma pasta.
- `src/script.js` foi trocado pela versão completa do mesmo repositório (19 KB). A versão anterior tinha um `alert("JavaScript funcionando!")` e prendia um `addEventListener` em `formulario-cadastro-usuarios`, o que estourava `TypeError` em qualquer outra página. A nova versão confere se cada elemento existe antes de usar, e trata catálogo, usuários, empréstimo, devolução e relatórios.
- `src/style.css` já era idêntico ao da referência, com todos os estilos dessas páginas — nada foi alterado nele.
- Corrigido `</ul>` duplicado no menu lateral de `usuarios-cadastrados.html`, `cadastro-livros.html` e `emprestimos.html`.
- Formulário de `emprestimos.html` reduzido a 3 campos: Título, Email Usuário e Data Empréstimo. Ajustado `realizarEmprestimo` no `script.js` para buscar o livro pelo título e o usuário pelo email (antes comparava 7 campos do livro). Como não há mais data de devolução prevista no empréstimo, o campo ficou `null`, a tabela de recentes mostra `—` e a contagem de atrasos só é feita quando existe data prevista.

---
## Feat Henrique : Reformulação do front-end: 25/11/2026

- `src/style.css` reescrito do zero: tema de biblioteca aconchegante (fundo papel `#fdf7f0`, terracota `#e7744c`, sálvia e amarelo), cantos bem arredondados, sombras suaves, botões em pílula e cartões de métricas com ícone em bloco colorido. Tipografia: `Baloo 2` nos títulos e `Nunito` no texto (Google Fonts), com fallback para fontes do sistema.
- Os PNGs do menu (`assets/icons/*.png`) foram substituídos por ícones vetoriais do [Lucide](https://lucide.dev) (licença ISC), embutidos como SVG inline em cada página. Assim eles herdam a cor do CSS (`currentColor`), ficam nítidos em qualquer zoom e não dependem de imagem externa. Os PNGs antigos continuam na pasta, sem uso.
- Cabeçalho e menu lateral foram reescritos nas 8 páginas com a mesma marcação (logo `BiblioTech`, ícone em bloco, item ativo destacado, botão Sair no rodapé do menu) e o item ativo agora corresponde à página aberta (antes todas marcavam "Início").
- Adicionado favicon em SVG embutido (`data:image/svg+xml`) e `<meta name="theme-color">` em todas as páginas.
- Responsivo: abaixo de 900px o menu lateral vira uma barra horizontal rolável no topo; abaixo de 760px os cartões e as linhas de formulário passam a uma coluna.
- Ajustes no `script.js` por causa do novo layout: os status de empréstimo agora recebem as classes `chip chip-ativo` / `chip chip-devolvido` (pílulas coloridas); as tabelas mostram mensagem quando estão vazias ("Nenhum livro cadastrado ainda."), e os menus de filtro do catálogo ganharam a função `configurarDropdowns()` — antes nada abria o menu (`display: none` sem classe `.ativo`), e o rótulo do botão era atualizado em `firstChild`, que pegava o nó de espaço em branco; agora o texto fica em `#btn-categoria-label` / `#btn-disponibilidade-label`.
- Removido o `<style>` inline de `consulta.html`, que sobrescrevia a tipografia dos relatórios.

---
## Feat Henrique : Front-end ligado no MySQL (fim do localStorage): 25/11/2026

- Criado `src/back-end/server.js`: um servidor HTTP (Node puro, sem framework) que serve o site e uma API JSON em `/api`, usando o pool do `connectionDB.js`. Rodar com `npm start` e abrir `http://127.0.0.1:3000/src/index.html`.
- Rotas: `GET /api/dashboard`, `GET|POST /api/livros`, `GET|POST /api/usuarios`, `GET /api/emprestimos`, `POST /api/emprestimos`, `POST /api/devolucoes`.
- `src/script.js` reescrito: nenhuma linha de `localStorage`/`sessionStorage` sobrou. As telas fazem `fetch` na API, e a busca/paginação continuam no navegador sobre a lista que veio do banco.
- Mapeamento com o `schema.sql`:
  - `usuarios` → tabela `usuarios`.
  - cadastro de livro → `livros` + a categoria é criada em `categorias` se ainda não existir; a **quantidade** vira N linhas em `acervo` (um exemplar por linha, mesma localização), e a disponibilidade do catálogo é `COUNT` de exemplares com `status = 'Disponivel'`.
  - empréstimo → escolhe o primeiro exemplar `Disponivel` com `FOR UPDATE`, insere em `emprestimos` e marca o exemplar como `Emprestado`; devolução faz o contrário (`Devolvido` + exemplar `Disponivel`). Tudo em transação, com `rollback` em caso de erro.
  - O schema exige `data_devolucao_esperada`, então o servidor calcula a data **14 dias** depois do empréstimo (`DIAS_EMPRESTIMO=7` para mudar).
- Validações no servidor (não dá para burlar pelo console): e-mail, ISBN/e-mail duplicados (409), data inexistente (`31/02`), data de devolução anterior ao empréstimo (o `CHECK` do schema vira mensagem amigável), quantidade e ano do livro.
- Erros de banco traduzidos para o usuário: sem MySQL o site abre e a tela mostra "Sem conexão com o MySQL..." (503) em vez de quebrar; `ER_DUP_ENTRY`, `ER_NO_REFERENCED_ROW_2` e `ER_CHECK_CONSTRAINT_VIOLATED` também têm mensagens próprias.
- Corrigido um bug no `connectionDB.js`: o `con.getConnection()` sem `.catch()` derrubava o processo inteiro quando o MySQL estava desligado. Agora a conexão é testada com `try/catch`, o "Connected!" só aparece quando conecta de verdade e o servidor continua no ar para avisar o usuário.
- `consulta.html` ganhou `#mensagem-feedback` para mostrar o erro de conexão; os cards de métrica mostram `—` quando a API falha.
- `package.json` ganhou `npm start` e `npm run dev` (`node --watch`). README atualizado com o passo de rodar o site e a lista de endpoints.

### Feat Henrique : Correções da revisão (mesmo dia)

- **Ano do livro:** a coluna `ano_publicacao` é `YEAR`, que no MySQL só aceita **1901 a 2155**. A validação aceitava a partir de 1000, então um livro de 1899 estourava o tipo (erro/truncamento no INSERT). Agora o servidor barra antes, com a mensagem "O ano precisa estar entre 1901 e 2027 (no banco, YEAR aceita de 1901 a 2155).", e o `input-ano` ganhou `min="1901" max="2155"`. Também mapeamos `ER_WARN_DATA_OUT_OF_RANGE` / `ER_TRUNCATED_WRONG_VALUE_FOR_FIELD` para 400.
- **Campo Usuário na devolução:** o formulário tinha `input-usuario` mas a API recebia só título, e-mail e data — o nome era ignorado. Agora o front envia `usuario` e o `POST /api/devolucoes` usa `AND u.nome = ?` na busca do empréstimo ativo (obrigatório; sem ele responde 400). Assim livro + e-mail + nome identificam o empréstimo, e um nome errado dá 404 em vez de devolver o livro de outra pessoa.
- **Placeholders copiados do formulário de livro:** em `devolucao.html` o e-mail dizia "Digite o ISBN do livro", a data "Digite a Editora do livro" e o usuário "Digite o autor do livro". Corrigido para "Digite o email do usuário", "DD/MM/AAAA" e "Digite o nome do usuário". Conferi as outras páginas: catalogo, usuários, empréstimo, cadastro de usuário e cadastro de livro estavam certos. A data do empréstimo estava como "DD-MM-YYYY" e virou "DD/MM/AAAA" para ficar igual à da devolução (a API aceita 25/11/2026, 25-11-2026 e 2026-11-25).
- **CRUD completo de livros (U e D):** o projeto tinha Create e Read (e o Update de status na devolução), mas nenhum DELETE nem edição de cadastro. Foram adicionados `PUT /api/livros/:id` e `DELETE /api/livros/:id`, além do modal de edição e do botão de excluir no catálogo (coluna "Ações" com lápis e lixeira). O `PUT` valida tudo de novo (inclusive o intervalo do `YEAR`), reaproveita `buscarOuCriarCategoria` e usa `FOR UPDATE` + transação; não altera quantidade, porque exemplares são linhas de `acervo` e remover um emprestado quebraria a FK. O `DELETE` segue a **regra A**: bloqueia com **409** quando existe qualquer empréstimo do livro (mensagem diferente para exemplar em aberto e para histórico), preservando o `ON DELETE RESTRICT` do schema; sem empréstimo, apaga `acervo` e depois `livros` na mesma transação. **Melhoria futura anotada:** soft delete (`ALTER TABLE livros ADD ativo TINYINT DEFAULT 1` e os SELECTs filtrando `ativo = 1`), que some do catálogo sem perder histórico.
- **MySQL instalado mas sem serviço (máquina de teste):** o `mysql -u root -p < schema.sql` dava `ERROR 2003 (HY000) ... (10061)`. Investigação no Windows: o MySQL Server 8.0 estava instalado (bin com `mysqld.exe` 8.0.46, `my.ini` e `Data` em `C:\ProgramData\MySQL\MySQL Server 8.0`), mas **nenhum serviço MySQL existia** (`Get-Service *mysql*` vazio, nada escutando na 3306), então a etapa de *Apply Configuration* do instalador nunca rodou. Subir o `mysqld` na mão também falhava: `Failed to set datadir ... (OS errno: 13 - Permission denied)` — a pasta `Data` tem ACL fechada até para o usuário que instalou (`icacls` responde "Acesso negado"). Correção aplicada com elevação: `mysqld --install MySQL80 --defaults-file="C:\ProgramData\MySQL\MySQL Server 8.0\my.ini"` + `net start MySQL80`. Resultado: serviço RUNNING, 3306/33060 em LISTENING, e `mysql -u root` sem senha responde `ERROR 1045` (prova de que o servidor está de pé e o root tem senha). Criado também um `.env` com `DB_PASSWORD` pendente de preenchimento (já coberto pelo `.gitignore`) e a seção de troubleshooting do README.
- **Criação do banco sem o cliente mysql:** quem não tem o `mysql.exe` no PATH (erro `'mysql' não é reconhecido`) recebia um beco sem saída. Adicionei `src/back-end/criarBanco.js` + `npm run db:criar`, que lê o `schema.sql` e executa tudo pelo `mysql2` já instalado, listando as tabelas ao final. Se as tabelas já existirem, avisa em vez de estourar `ER_TABLE_EXISTS_ERROR`.

---
## Feat Henrique : Sistema de contas e permissões (dev / usuário): 25/11/2026

- **Banco:** a tabela `usuarios` ganhou `senha_hash VARCHAR(255) NULL` (guardamos `salt:hash` do **scrypt**, que já vem no `node:crypto` — nenhuma dependência nova) e `papel ENUM('Usuario','Dev') NOT NULL DEFAULT 'Usuario'`. O `schema.sql` já nasce com as duas colunas; para bancos que já existiam, `npm run db:contas` roda `src/back-end/migrarContas.js`, que acrescenta o que falta, cria/redefine a conta base de dev e dá a senha padrão `1234` às contas antigas (que ficariam sem conseguir entrar).
- **Conta base:** `dev@gmail.com` / `1234devs`, papel `Dev`. A senha pode ser trocada por `DEV_EMAIL` / `DEV_SENHA` no `.env` antes de rodar a migração.
- **Sessão:** `POST /api/sessoes` confere a senha com `scrypt` + `timingSafeEqual` e devolve um token aleatório (`randomBytes(32)`) num cookie `biblio_sessao` com `HttpOnly; Path=/; SameSite=Lax; Max-Age=28800` (8 h). As sessões vivem num `Map` em memória — reiniciar o servidor desloga todo mundo, o que é aceitável aqui e está documentado. `GET /api/sessoes/atual` devolve quem está logado (401 se não houver) e `DELETE /api/sessoes` apaga o token do mapa e zera o cookie.
- **O que cada papel pode fazer:** `Usuario` lê dashboard, catálogo e empréstimos, e registra empréstimo/devolução. `Dev` faz tudo isso mais o CRUD de livros, a lista de usuários, o cadastro de usuário e a troca de permissão. As rotas de dev chamam `exigirDev`, que responde **401** sem login e **403** com conta comum — então não adianta chamar a API na mão. Também exigimos login nas leituras, para o acervo não ficar aberto na rede.
- **Troca de permissão:** `PUT /api/usuarios/:id` com `{ papel }`. Duas travas: o dev não consegue tirar a própria permissão (400) e o sistema nunca fica sem nenhum dev (409). Ao mudar o papel, as sessões já abertas daquela pessoa são atualizadas na hora, sem precisar relogar.
- **Front:** nova página `src/pages/login.html` com `src/login.js` (script separado para não criar laço de redirecionamento). O `src/script.js` passou a abrir carregando `GET /api/sessoes/atual`: sem sessão vai para o login, com sessão mostra um chip com nome e papel no rodapé da sidebar e liga o botão "Sair". Para conta comum, os itens de menu de gestão somem e a coluna "Ações" do catálogo fica oculta; quem abrir a URL na mão (`data-papel-minimo="dev"` no `<body>`) vê um cartão de "Acesso restrito" em vez do conteúdo.
- **Telas alteradas:** `usuarios-cadastrados.html` ganhou a coluna "Permissão" com um `<select>` que salva na hora; `cadastro-usuarios.html` ganhou os campos **Senha** (mínimo 4 caracteres) e **Permissão**.
- **Testes feitos:** 21 checagens de API contra o MySQL real, todas passando — 401 sem login, 401 com senha errada, login do dev, `GET /api/usuarios` liberado para dev e **403** para conta comum (inclusive em `POST /api/livros` e `DELETE /api/livros/:id`), criação de conta pelo dev, promoção a dev refletindo na sessão já aberta, dev não conseguindo se rebaixar (400) e cookie invalidado depois do logout. A conta criada no teste foi apagada do banco ao final.

### Feat Henrique : Cadastro aberto (mesmo dia)

- **Decisão:** o login não mostra mais a conta base embaixo do botão (era só apoio de teste). No lugar entrou o link *Criar conta de usuário*.
- **Auto-cadastro:** nova página `src/pages/criar-conta.html` + `src/cadastro.js`, que chamam `POST /api/contas`. A rota é pública, mas **força `papel = 'Usuario'`** no servidor (`cadastrarUsuario(pool, dados, "Usuario")`) — mandar `papel: "Dev"` no JSON não promove ninguém. A conta já é criada logada (o cookie de sessão vem na resposta).
- **Por que assim:** liberar o cadastro tira do dev o trabalho de criar conta para cada leitor, sem abrir a parte perigosa (livros e permissões continuam só para dev). O caminho de *Cadastrar Usuário* (dev) continua existindo para quando for preciso escolher o papel na criação.
- **Mensagem de e-mail repetido:** `cadastrarUsuario` confere o e-mail antes do `INSERT` e responde 409 "Já existe uma conta com esse e-mail. Tente entrar." (o `ER_DUP_ENTRY` continua como rede de segurança para corrida entre duas requisições).
- **Testes:** `POST /api/contas` cria com papel `Usuario` mesmo enviando `papel: "Dev"`, o cookie devolvido abre `GET /api/sessoes/atual`, e-mail repetido dá 409 e senha com menos de 4 caracteres dá 400. Conta de teste removida do banco.

### Feat Henrique : Excluir usuário (mesmo dia)

- **Backend:** `DELETE /api/usuarios/:id`, só para dev. Antes de apagar, a transação trava a linha (`FOR UPDATE`) e checa três coisas: a conta não pode ser a do próprio dev logado (400), o sistema não pode ficar sem nenhum dev (409) e o usuário não pode ter empréstimo em aberto nem histórico (409, com mensagens diferentes). A regra é a mesma do `DELETE` de livro e existe porque `emprestimos` usa `ON DELETE RESTRICT` — apagar a conta deixaria o histórico órfão. Sem empréstimo, apaga a linha de `usuarios` e as sessões abertas daquela pessoa são removidas do `Map` na hora (o token deixa de valer, sem esperar o cookie expirar).
- **Front:** a tabela de *Usuários* ganhou a coluna "Ações" com o botão de lixeira e um modal de confirmação (`modal-excluir-usuario`) igual ao do catálogo, com Cancelar/Excluir. Ao confirmar, a mensagem vem da API e a lista é recarregada; se o servidor bloquear com 409, o modal fecha e o motivo aparece em `#mensagem-feedback`.
- **Testes:** dev apaga conta sem histórico (200) e a sessão antiga dessa conta passa a dar 401; usuário comum recebe 403; dev não consegue se apagar (400); conta com empréstimo em aberto e conta só com histórico recebem 409. Os dados do teste (livro, empréstimo e contas) foram removidos do banco ao final.

### Feat Henrique : Circulação por seletores (mesmo dia)

- **Problema:** emprestar e devolver exigiam digitar título, e-mail e nome do usuário. Qualquer diferença de acento/maiúscula no título ou no nome gerava "não encontrado", e o usuário comum tinha que digitar o próprio e-mail.
- **Empréstimo:** o campo de texto virou `<select id="select-livro">`, preenchido com `GET /api/livros` e mostrando apenas livros com exemplar disponível ("Título — Autor (n)"). A API mudou de `titulo + email` para `idLivro` e o usuário vem da **sessão**: usuário comum empresta sempre para si. O seletor de usuário (`select-usuario`, `GET /api/usuarios`) só aparece quando `sessao.papel === "Dev"`; se um usuário comum mandar `idUsuario` na mão, o servidor ignora e usa o id da sessão.
- **Devolução:** virou um seletor de **empréstimos em aberto** (`select-emprestimo`), montado a partir de `GET /api/emprestimos` — o dev vê os de todos, o usuário comum só os que têm o e-mail dele. A API passou a receber `idEmprestimo + dataDevolucao`, o que dispensa título, e-mail e nome: livro + pessoa + data do empréstimo já vêm na linha do empréstimo. Se o empréstimo não for do usuário logado, responde **403**; se já foi devolvido, **409**; se a data for anterior ao empréstimo, **400** com a data correta na mensagem.
- **Por que melhor:** id não erra por causa de acento, não depende de o dev ter digitado o título igual e elimina a possibilidade de devolver o livro da pessoa errada (o `SELECT` anterior casava por título + e-mail + nome).
- **Testes:** empréstimo por usuário comum grava na conta dele mesmo (mesmo mandando `idUsuario` de outro), dev empresta para um usuário escolhido, devolução por outra conta dá 403, devolução repetida dá 409, data anterior ao empréstimo dá 400 e a devolução válida libera o exemplar. Os registros do teste foram apagados do banco.

---
## Feat Henrique : Exclusão de livro sem perder histórico: 25/11/2026

- **Problema:** o `DELETE /api/livros/:id` respondia **409** para qualquer livro que já tivesse empréstimo **no histórico**, mesmo com tudo devolvido. Era a "regra A" documentada antes, mas impedia limpar o catálogo de livros que já circularam.
- **Solução escolhida:** exclusão lógica (soft delete), a melhoria que já estava anotada aqui. A tabela `livros` ganhou `ativo TINYINT NOT NULL DEFAULT 1`; excluir agora faz `UPDATE livros SET ativo = 0`. O livro some do catálogo, do dashboard, do seletor de empréstimo e da edição, mas as linhas de `acervo` e `emprestimos` continuam — o histórico e os relatórios seguem íntegros.
- **O que ainda bloqueia:** apenas empréstimo **em aberto** (409, com a contagem), porque o exemplar está com alguém. Com tudo devolvido, a exclusão passa.
- **Banco:** `schema.sql` já nasce com a coluna; para bancos existentes, `npm run db:livros` (`src/back-end/migrarAtivoLivros.js`) adiciona a coluna de forma idempotente.
- **Consultas ajustadas:** `listarLivros` (`WHERE l.ativo = 1`), contagem do dashboard, `editarLivro` e a checagem de livro no empréstimo passaram a filtrar `ativo = 1`. `listarEmprestimos` e a devolução continuam sem filtro, de propósito, para o histórico aparecer.
- **Front:** o modal de exclusão agora explica que o livro sai do catálogo e o histórico é preservado; a mensagem de sucesso não fala mais em exemplares removidos.
- **Efeito colateral conhecido:** como a linha do livro permanece, o ISBN de um livro excluído continua ocupado e não pode ser cadastrado de novo (retorna 409).
- **Outros ajustes do mesmo dia:** `.gitignore` corrigido (`node_modules/` sem ponto e `.env` sem espaço — antes o `node_modules` ia para o commit) e criado `.env.example` com as variáveis do README.









