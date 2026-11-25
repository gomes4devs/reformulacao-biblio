import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { criarHashSenha, conferirSenha, criarToken } from "./senhas.js";

/* =========================================================
   BIBLIO-TECH — SERVIDOR
   Serve o site (HTML/CSS/JS) e uma API JSON em /api que fala
   com o MySQL pelo pool de src/back-end/connectionDB.js.

   Rodar: npm start   (ou: node src/back-end/server.js)
   ========================================================= */

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORTA = Number(process.env.PORT) || 3000;

/* A tabela emprestimos exige data_devolucao_esperada.
   Como o formulário pede só a data do empréstimo, o servidor
   calcula a devolução prevista somando estes dias. */
const DIAS_PADRAO_EMPRESTIMO = Number(process.env.DIAS_EMPRESTIMO) || 14;

const LIMITE_CORPO = 100 * 1024;

/* ---------------------------------------------------------
   Contas e sessões

   O login guarda o usuário num Map em memória e devolve para o
   navegador apenas um token, dentro de um cookie HttpOnly (o
   JavaScript da página não consegue ler esse cookie). Reiniciar
   o servidor derruba as sessões e cada um entra de novo.
   --------------------------------------------------------- */

const COOKIE_SESSAO = "biblio_sessao";
const DURACAO_SESSAO_MS = 8 * 60 * 60 * 1000; // 8 horas
const sessoes = new Map();

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

class ErroHttp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

/* ---------------------------------------------------------
   Utilidades
   --------------------------------------------------------- */

function responder(res, status, dados, cabecalhos) {
  const corpo = JSON.stringify(dados);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(corpo),
    "Cache-Control": "no-store",
    ...(cabecalhos || {}),
  });
  res.end(corpo);
}

async function lerCorpo(req) {
  const partes = [];
  let tamanho = 0;

  for await (const parte of req) {
    tamanho += parte.length;
    if (tamanho > LIMITE_CORPO) {
      throw new ErroHttp(413, "Requisição grande demais.");
    }
    partes.push(parte);
  }

  if (!partes.length) return {};

  try {
    return JSON.parse(Buffer.concat(partes).toString("utf8"));
  } catch (erro) {
    throw new ErroHttp(400, "O corpo da requisição não é um JSON válido.");
  }
}

/* Aceita 25/11/2026, 25-11-2026 ou 2026-11-25 e devolve 2026-11-25 */
function normalizarData(texto) {
  const valor = String(texto || "").trim();
  let dia, mes, ano;

  let casamento = valor.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (casamento) {
    dia = Number(casamento[1]);
    mes = Number(casamento[2]);
    ano = Number(casamento[3]);
  } else {
    casamento = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!casamento) {
      throw new ErroHttp(400, "Informe a data no formato DD/MM/AAAA.");
    }
    ano = Number(casamento[1]);
    mes = Number(casamento[2]);
    dia = Number(casamento[3]);
  }

  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    throw new ErroHttp(400, "Essa data não existe no calendário.");
  }

  return data.toISOString().slice(0, 10);
}

function somarDias(dataIso, dias) {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1, dia) + dias * 86400000);
  return alvo.toISOString().slice(0, 10);
}

function formatarDataBr(dataIso) {
  const [ano, mes, dia] = dataIso.split("-");
  return dia + "/" + mes + "/" + ano;
}

function textoObrigatorio(valor, nomeCampo, minimo) {
  const texto = String(valor ?? "").trim();
  if (texto.length < (minimo || 1)) {
    throw new ErroHttp(400, "Preencha o campo " + nomeCampo + ".");
  }
  return texto;
}

function inteiroPositivo(valor, nomeCampo, maximo) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new ErroHttp(400, "O campo " + nomeCampo + " deve ser um número maior que zero.");
  }
  if (maximo && numero > maximo) {
    throw new ErroHttp(400, "O campo " + nomeCampo + " deve ser no máximo " + maximo + ".");
  }
  return numero;
}

function validarEmail(valor) {
  const email = textoObrigatorio(valor, "e-mail");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ErroHttp(400, "Digite um e-mail válido.");
  }
  return email;
}

/* A coluna ano_publicacao é YEAR no schema, e o MySQL só guarda de 1901 a 2155.
   Um livro de 1899 estouraria o tipo, então barramos antes de chegar no banco. */
function validarAno(valor) {
  const anoAtual = new Date().getFullYear();
  const ano = Number(valor);
  if (!Number.isInteger(ano) || ano < 1901 || ano > anoAtual + 1) {
    throw new ErroHttp(
      400,
      "O ano precisa estar entre 1901 e " + (anoAtual + 1) + " (no banco, YEAR aceita de 1901 a 2155)."
    );
  }
  return ano;
}

function validarId(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ErroHttp(400, "Identificador inválido.");
  }
  return id;
}

function validarSenha(valor) {
  const senha = String(valor ?? "");
  if (senha.length < 4) {
    throw new ErroHttp(400, "A senha precisa ter pelo menos 4 caracteres.");
  }
  if (senha.length > 72) {
    throw new ErroHttp(400, "A senha pode ter no máximo 72 caracteres.");
  }
  return senha;
}

/* ---------------------------------------------------------
   Sessões e cookies
   --------------------------------------------------------- */

function lerCookies(req) {
  const cabecalho = req.headers.cookie;
  const cookies = {};

  if (!cabecalho) return cookies;

  cabecalho.split(";").forEach((par) => {
    const separador = par.indexOf("=");
    if (separador === -1) return;

    const nome = par.slice(0, separador).trim();
    if (nome) cookies[nome] = decodeURIComponent(par.slice(separador + 1).trim());
  });

  return cookies;
}

function montarCookie(token, segundos) {
  return (
    COOKIE_SESSAO +
    "=" +
    encodeURIComponent(token) +
    "; HttpOnly; Path=/; SameSite=Lax; Max-Age=" +
    segundos
  );
}

function criarSessao(usuario) {
  const token = criarToken();
  sessoes.set(token, { ...usuario, expiraEm: Date.now() + DURACAO_SESSAO_MS });
  return token;
}

function sessaoDoToken(token) {
  if (!token) return null;

  const sessao = sessoes.get(token);
  if (!sessao) return null;

  if (sessao.expiraEm <= Date.now()) {
    sessoes.delete(token);
    return null;
  }

  return sessao;
}

function sessaoPublica(sessao) {
  return {
    idUsuario: sessao.idUsuario,
    nome: sessao.nome,
    email: sessao.email,
    papel: sessao.papel,
  };
}

function exigirSessao(sessao) {
  if (!sessao) {
    throw new ErroHttp(401, "Faça login para continuar.");
  }
  return sessao;
}

function exigirDev(sessao) {
  exigirSessao(sessao);
  if (sessao.papel !== "Dev") {
    throw new ErroHttp(403, "Apenas contas dev podem fazer essa operação.");
  }
  return sessao;
}

/* Se o dev muda o papel de alguém, as sessões já abertas dessa
   pessoa passam a valer com o papel novo na hora. */
function atualizarPapeisDaSessao(idUsuario, papel) {
  for (const sessao of sessoes.values()) {
    if (sessao.idUsuario === idUsuario) sessao.papel = papel;
  }
}

/* Conta excluída não pode continuar com sessão aberta. */
function removerSessoesDoUsuario(idUsuario) {
  for (const [token, sessao] of sessoes) {
    if (sessao.idUsuario === idUsuario) sessoes.delete(token);
  }
}

function traduzirErro(erro) {
  if (erro instanceof ErroHttp) {
    return { status: erro.status, mensagem: erro.message };
  }

  switch (erro && erro.code) {
    case "ER_DUP_ENTRY":
      return { status: 409, mensagem: "Já existe um registro com esse dado (e-mail ou ISBN repetido)." };
    case "ER_CHECK_CONSTRAINT_VIOLATED":
      return { status: 400, mensagem: "A data de devolução não pode ser anterior à data do empréstimo." };
    case "ER_NO_REFERENCED_ROW_2":
    case "ER_NO_REFERENCED_ROW":
      return { status: 400, mensagem: "Um dos registros relacionados não existe." };
    case "ER_ROW_IS_REFERENCED_2":
      return { status: 409, mensagem: "Esse registro está em uso e não pode ser removido." };
    case "ER_WARN_DATA_OUT_OF_RANGE":
    case "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD":
      return {
        status: 400,
        mensagem: "Algum valor está fora do intervalo que o banco aceita (o ano vai de 1901 a 2155).",
      };
    case "ECONNREFUSED":
    case "ENOTFOUND":
    case "ETIMEDOUT":
    case "PROTOCOL_CONNECTION_LOST":
    case "ER_ACCESS_DENIED_ERROR":
    case "ER_BAD_DB_ERROR":
      return {
        status: 503,
        mensagem:
          "Sem conexão com o MySQL. Confira o arquivo .env, rode o src/back-end/schema.sql e veja se o servidor do banco está ligado.",
      };
    default:
      console.error(erro);
      return { status: 500, mensagem: "Erro interno no servidor." };
  }
}

/* ---------------------------------------------------------
   Consultas
   --------------------------------------------------------- */

async function listarLivros(pool) {
  const [linhas] = await pool.execute(`
    SELECT l.id_livro AS idLivro,
           l.titulo, l.autor, l.isbn, l.editora,
           l.ano_publicacao AS ano,
           l.sinopse,
           c.nome AS categoria,
           SUM(CASE WHEN a.status = 'Disponivel' THEN 1 ELSE 0 END) AS disponiveis,
           COUNT(a.id_acervo) AS total
      FROM livros l
      JOIN categorias c ON c.id_categoria = l.id_categoria_fk
      LEFT JOIN acervo a ON a.id_livro = l.id_livro
     WHERE l.ativo = 1
     GROUP BY l.id_livro, l.titulo, l.autor, l.isbn, l.editora, l.ano_publicacao, l.sinopse, c.nome
     ORDER BY l.titulo
  `);

  return linhas.map((linha) => ({
    ...linha,
    ano: linha.ano === null ? null : Number(linha.ano),
    disponiveis: Number(linha.disponiveis),
    total: Number(linha.total),
  }));
}

async function listarUsuarios(pool) {
  const [linhas] = await pool.execute(`
    SELECT id_usuario AS idUsuario, nome, email, papel
      FROM usuarios
     ORDER BY papel DESC, nome
  `);
  return linhas;
}

async function listarEmprestimos(pool, limite) {
  const [linhas] = await pool.execute(
    `
    SELECT e.id_emprestimo AS idEmprestimo,
           l.titulo AS livro,
           u.nome AS usuario,
           u.email,
           DATE_FORMAT(e.data_emprestimo, '%d/%m/%Y') AS dataEmprestimo,
           DATE_FORMAT(e.data_devolucao_esperada, '%d/%m/%Y') AS dataDevolucaoEsperada,
           DATE_FORMAT(e.data_devolucao_real, '%d/%m/%Y') AS dataDevolucao,
           e.status
      FROM emprestimos e
      JOIN usuarios u ON u.id_usuario = e.id_usuario
      JOIN acervo a ON a.id_acervo = e.id_acervo
      JOIN livros l ON l.id_livro = a.id_livro
     ORDER BY e.id_emprestimo DESC
     LIMIT ?
  `,
    [Number(limite) || 100]
  );
  return linhas;
}

async function obterDashboard(pool) {
  const [linhas] = await pool.execute(`
    SELECT (SELECT COUNT(*) FROM livros WHERE ativo = 1) AS livros,
           (SELECT COUNT(*) FROM emprestimos WHERE status = 'Ativo') AS emprestimosAtivos,
           (SELECT COUNT(*) FROM usuarios) AS usuarios,
           (SELECT COUNT(DISTINCT id_usuario) FROM emprestimos WHERE status = 'Ativo') AS usuariosAtivos,
           (SELECT COUNT(*) FROM emprestimos) AS totalEmprestimos,
           (SELECT COUNT(*) FROM emprestimos
             WHERE status = 'Devolvido'
               AND data_devolucao_real > data_devolucao_esperada) AS atrasos
  `);

  const numeros = linhas[0] || {};
  const recentes = await listarEmprestimos(pool, 10);

  return {
    livros: Number(numeros.livros) || 0,
    emprestimosAtivos: Number(numeros.emprestimosAtivos) || 0,
    usuarios: Number(numeros.usuarios) || 0,
    usuariosAtivos: Number(numeros.usuariosAtivos) || 0,
    totalEmprestimos: Number(numeros.totalEmprestimos) || 0,
    atrasos: Number(numeros.atrasos) || 0,
    recentes: recentes.slice(0, 10),
  };
}

async function buscarOuCriarCategoria(conexao, nome) {
  const [existentes] = await conexao.execute(
    "SELECT id_categoria FROM categorias WHERE nome = ? LIMIT 1",
    [nome]
  );
  if (existentes.length) return existentes[0].id_categoria;

  const [nova] = await conexao.execute("INSERT INTO categorias (nome) VALUES (?)", [nome]);
  return nova.insertId;
}

/* ---------------------------------------------------------
   Ações
   --------------------------------------------------------- */

async function autenticar(pool, dados) {
  const email = validarEmail(dados.email);
  const senha = String(dados.senha ?? "");

  if (!senha) {
    throw new ErroHttp(400, "Informe a senha.");
  }

  const [linhas] = await pool.execute(
    "SELECT id_usuario, nome, email, senha_hash, papel FROM usuarios WHERE email = ? LIMIT 1",
    [email]
  );

  const usuario = linhas[0];

  /* Mesma mensagem para e-mail inexistente e senha errada: não
     entregamos quais e-mails estão cadastrados. */
  if (!usuario || !(await conferirSenha(senha, usuario.senha_hash))) {
    throw new ErroHttp(401, "E-mail ou senha inválidos.");
  }

  return {
    idUsuario: usuario.id_usuario,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel,
  };
}

/* papelForcado: o cadastro aberto (/api/contas) sempre cria conta de
   usuário comum. Ninguém se torna dev sozinho — só um dev promove. */
async function cadastrarUsuario(pool, dados, papelForcado) {
  const nome = textoObrigatorio(dados.nome, "nome", 2);
  const email = validarEmail(dados.email);
  const senha = validarSenha(dados.senha);
  const papel = papelForcado || (dados.papel === "Dev" ? "Dev" : "Usuario");

  const [existentes] = await pool.execute(
    "SELECT id_usuario FROM usuarios WHERE email = ? LIMIT 1",
    [email]
  );
  if (existentes.length) {
    throw new ErroHttp(409, "Já existe uma conta com esse e-mail. Tente entrar.");
  }

  const senhaHash = await criarHashSenha(senha);

  const [resultado] = await pool.execute(
    "INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (?, ?, ?, ?)",
    [nome, email, senhaHash, papel]
  );

  return { idUsuario: resultado.insertId, nome, email, papel };
}

/* PUT /api/usuarios/:id — o dev troca a permissão da conta.
   Duas travas: ninguém tira a própria permissão de dev e o
   sistema nunca fica sem pelo menos um dev. */
async function alterarPapel(pool, idRecebido, dados, idDaSessao) {
  const id = validarId(idRecebido);
  const papel = dados.papel === "Dev" ? "Dev" : "Usuario";

  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [linhas] = await conexao.execute(
      "SELECT nome, email, papel FROM usuarios WHERE id_usuario = ? FOR UPDATE",
      [id]
    );
    if (!linhas.length) {
      throw new ErroHttp(404, "Usuário não encontrado.");
    }

    const atual = linhas[0];

    if (id === Number(idDaSessao) && papel !== "Dev") {
      throw new ErroHttp(400, "Você não pode tirar a sua própria permissão de dev.");
    }

    if (atual.papel === "Dev" && papel !== "Dev") {
      const [devs] = await conexao.execute(
        "SELECT COUNT(*) AS total FROM usuarios WHERE papel = 'Dev'"
      );
      if (Number(devs[0].total) <= 1) {
        throw new ErroHttp(409, "O sistema precisa ter pelo menos uma conta dev.");
      }
    }

    await conexao.execute("UPDATE usuarios SET papel = ? WHERE id_usuario = ?", [papel, id]);

    await conexao.commit();

    atualizarPapeisDaSessao(id, papel);

    return { idUsuario: id, nome: atual.nome, email: atual.email, papel };
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
}

/* DELETE /api/usuarios/:id — o dev exclui uma conta.
   Mesma regra do livro: empréstimo em aberto ou histórico bloqueia (409),
   porque o schema usa ON DELETE RESTRICT em emprestimos. */
async function excluirUsuario(pool, idRecebido, idDaSessao) {
  const id = validarId(idRecebido);

  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [linhas] = await conexao.execute(
      "SELECT nome, email, papel FROM usuarios WHERE id_usuario = ? FOR UPDATE",
      [id]
    );
    if (!linhas.length) {
      throw new ErroHttp(404, "Usuário não encontrado.");
    }

    const usuario = linhas[0];

    if (id === Number(idDaSessao)) {
      throw new ErroHttp(400, "Você não pode excluir a sua própria conta.");
    }

    if (usuario.papel === "Dev") {
      const [devs] = await conexao.execute(
        "SELECT COUNT(*) AS total FROM usuarios WHERE papel = 'Dev'"
      );
      if (Number(devs[0].total) <= 1) {
        throw new ErroHttp(409, "O sistema precisa ter pelo menos uma conta dev.");
      }
    }

    const [historico] = await conexao.execute(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'Ativo' THEN 1 ELSE 0 END) AS ativos
         FROM emprestimos
        WHERE id_usuario = ?`,
      [id]
    );

    const totalEmprestimos = Number(historico[0].total) || 0;
    const emprestimosAtivos = Number(historico[0].ativos) || 0;

    if (emprestimosAtivos > 0) {
      throw new ErroHttp(
        409,
        "Não é possível excluir: essa pessoa tem " +
          emprestimosAtivos +
          " empréstimo(s) em aberto. Registre a devolução primeiro."
      );
    }

    if (totalEmprestimos > 0) {
      throw new ErroHttp(
        409,
        "Não é possível excluir: esse usuário tem " +
          totalEmprestimos +
          " empréstimo(s) no histórico e esse registro precisa ser preservado."
      );
    }

    await conexao.execute("DELETE FROM usuarios WHERE id_usuario = ?", [id]);

    await conexao.commit();

    removerSessoesDoUsuario(id);

    return { idUsuario: id, nome: usuario.nome, email: usuario.email };
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
}

async function cadastrarLivro(pool, dados) {
  const titulo = textoObrigatorio(dados.titulo, "título");
  const autor = textoObrigatorio(dados.autor, "autor");
  const isbn = textoObrigatorio(dados.isbn, "ISBN");
  const editora = textoObrigatorio(dados.editora, "editora");
  const categoria = textoObrigatorio(dados.categoria, "categoria");
  const sinopse = String(dados.sinopse ?? "").trim();
  const localizacao = textoObrigatorio(dados.localizacao, "localização");
  const quantidade = inteiroPositivo(dados.quantidade, "quantidade", 100);

  const ano = validarAno(dados.ano);

  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const idCategoria = await buscarOuCriarCategoria(conexao, categoria);

    const [livro] = await conexao.execute(
      `INSERT INTO livros (titulo, autor, isbn, editora, ano_publicacao, sinopse, id_categoria_fk)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [titulo, autor, isbn, editora, ano, sinopse || null, idCategoria]
    );

    for (let i = 0; i < quantidade; i += 1) {
      await conexao.execute(
        "INSERT INTO acervo (id_livro, localizacao, status) VALUES (?, ?, 'Disponivel')",
        [livro.insertId, localizacao]
      );
    }

    await conexao.commit();
    return { idLivro: livro.insertId, exemplares: quantidade };
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
}

/* UPDATE — edita os dados bibliográficos do livro (o PUT da rota /api/livros/:id).
   Não mexe em quantidade: exemplares são linhas de acervo, e remover um exemplar
   emprestado quebraria a FK de emprestimos. */
async function editarLivro(pool, idRecebido, dados) {
  const id = validarId(idRecebido);

  const titulo = textoObrigatorio(dados.titulo, "título");
  const autor = textoObrigatorio(dados.autor, "autor");
  const isbn = textoObrigatorio(dados.isbn, "ISBN");
  const editora = textoObrigatorio(dados.editora, "editora");
  const categoria = textoObrigatorio(dados.categoria, "categoria");
  const sinopse = String(dados.sinopse ?? "").trim();
  const ano = validarAno(dados.ano);

  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [existentes] = await conexao.execute(
      "SELECT id_livro FROM livros WHERE id_livro = ? AND ativo = 1 FOR UPDATE",
      [id]
    );
    if (!existentes.length) {
      throw new ErroHttp(404, "Livro não encontrado.");
    }

    const idCategoria = await buscarOuCriarCategoria(conexao, categoria);

    await conexao.execute(
      `UPDATE livros
          SET titulo = ?, autor = ?, isbn = ?, editora = ?,
              ano_publicacao = ?, sinopse = ?, id_categoria_fk = ?
        WHERE id_livro = ?`,
      [titulo, autor, isbn, editora, ano, sinopse || null, idCategoria, id]
    );

    await conexao.commit();
    return { idLivro: id, titulo, autor, isbn, editora, ano, categoria };
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
}

/* DELETE — tira o livro do catálogo sem perder o histórico.
   O dev exclui mesmo que o livro já tenha sido emprestado e devolvido: nesse
   caso ele vira ativo = 0 e some das telas, mas as linhas de acervo e
   emprestimos continuam no banco (ON DELETE RESTRICT preserva o histórico).
   Bloqueia (409) apenas quando existe exemplar emprestado no momento. */
async function excluirLivro(pool, idRecebido) {
  const id = validarId(idRecebido);

  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [livros] = await conexao.execute(
      "SELECT titulo FROM livros WHERE id_livro = ? AND ativo = 1 FOR UPDATE",
      [id]
    );
    if (!livros.length) {
      throw new ErroHttp(404, "Livro não encontrado.");
    }

    const [emprestimos] = await conexao.execute(
      `SELECT COUNT(*) AS total
         FROM emprestimos e
         JOIN acervo a ON a.id_acervo = e.id_acervo
        WHERE a.id_livro = ? AND e.status = 'Ativo'`,
      [id]
    );

    const emprestimosAtivos = Number(emprestimos[0].total) || 0;

    if (emprestimosAtivos > 0) {
      throw new ErroHttp(
        409,
        "Não é possível excluir: há " +
          emprestimosAtivos +
          " exemplar(es) emprestado(s) deste livro. Registre a devolução primeiro."
      );
    }

    const [exemplares] = await conexao.execute(
      "SELECT COUNT(*) AS total FROM acervo WHERE id_livro = ?",
      [id]
    );

    await conexao.execute("UPDATE livros SET ativo = 0 WHERE id_livro = ?", [id]);

    await conexao.commit();

    return {
      idLivro: id,
      titulo: livros[0].titulo,
      exemplares: Number(exemplares[0].total) || 0,
    };
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
}

/* POST /api/emprestimos — o formulário manda o id do livro escolhido no
   seletor. Usuário comum empresta sempre para a própria conta; o dev pode
   escolher o usuário (idUsuario). */
async function realizarEmprestimo(pool, dados, sessao) {
  const idLivro = validarId(dados.idLivro);
  const dataEmprestimo = normalizarData(dados.dataEmprestimo);
  const dataDevolucaoEsperada = somarDias(dataEmprestimo, DIAS_PADRAO_EMPRESTIMO);

  let idUsuario = sessao.idUsuario;
  if (sessao.papel === "Dev" && dados.idUsuario) {
    idUsuario = validarId(dados.idUsuario);
  }

  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [livros] = await conexao.execute(
      "SELECT titulo FROM livros WHERE id_livro = ? AND ativo = 1 LIMIT 1",
      [idLivro]
    );
    if (!livros.length) {
      throw new ErroHttp(404, "Livro não encontrado.");
    }

    const [usuarios] = await conexao.execute(
      "SELECT nome FROM usuarios WHERE id_usuario = ? LIMIT 1",
      [idUsuario]
    );
    if (!usuarios.length) {
      throw new ErroHttp(404, "Usuário não encontrado.");
    }

    const [exemplares] = await conexao.execute(
      `SELECT id_acervo
         FROM acervo
        WHERE id_livro = ? AND status = 'Disponivel'
        ORDER BY id_acervo
        LIMIT 1
        FOR UPDATE`,
      [idLivro]
    );
    if (!exemplares.length) {
      throw new ErroHttp(409, "Não há exemplar disponível desse livro no momento.");
    }

    const [emprestimo] = await conexao.execute(
      `INSERT INTO emprestimos (id_usuario, id_acervo, data_emprestimo, data_devolucao_esperada, status)
       VALUES (?, ?, ?, ?, 'Ativo')`,
      [idUsuario, exemplares[0].id_acervo, dataEmprestimo, dataDevolucaoEsperada]
    );

    await conexao.execute("UPDATE acervo SET status = 'Emprestado' WHERE id_acervo = ?", [
      exemplares[0].id_acervo,
    ]);

    await conexao.commit();

    return {
      idEmprestimo: emprestimo.insertId,
      livro: livros[0].titulo,
      usuario: usuarios[0].nome,
      dataEmprestimo: formatarDataBr(dataEmprestimo),
      dataDevolucaoEsperada: formatarDataBr(dataDevolucaoEsperada),
    };
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
}

/* POST /api/devolucoes — o formulário manda o id do empréstimo escolhido no
   seletor. Usuário comum só devolve o que é dele; dev devolve qualquer um. */
async function devolverLivro(pool, dados, sessao) {
  const idEmprestimo = validarId(dados.idEmprestimo);
  const dataDevolucao = normalizarData(dados.dataDevolucao);

  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [linhas] = await conexao.execute(
      `SELECT e.id_acervo AS idAcervo,
              e.id_usuario AS idUsuario,
              e.status,
              DATE_FORMAT(e.data_emprestimo, '%Y-%m-%d') AS dataEmprestimo,
              l.titulo,
              u.nome AS usuario
         FROM emprestimos e
         JOIN acervo a ON a.id_acervo = e.id_acervo
         JOIN livros l ON l.id_livro = a.id_livro
         JOIN usuarios u ON u.id_usuario = e.id_usuario
        WHERE e.id_emprestimo = ?
        FOR UPDATE`,
      [idEmprestimo]
    );

    if (!linhas.length) {
      throw new ErroHttp(404, "Empréstimo não encontrado.");
    }

    const emprestimo = linhas[0];

    if (emprestimo.status !== "Ativo") {
      throw new ErroHttp(409, "Esse empréstimo já foi devolvido.");
    }

    if (sessao.papel !== "Dev" && Number(emprestimo.idUsuario) !== Number(sessao.idUsuario)) {
      throw new ErroHttp(403, "Esse empréstimo não é da sua conta.");
    }

    if (dataDevolucao < emprestimo.dataEmprestimo) {
      throw new ErroHttp(
        400,
        "A devolução não pode ser anterior ao empréstimo (" +
          formatarDataBr(emprestimo.dataEmprestimo) +
          ")."
      );
    }

    await conexao.execute(
      "UPDATE emprestimos SET data_devolucao_real = ?, status = 'Devolvido' WHERE id_emprestimo = ?",
      [dataDevolucao, idEmprestimo]
    );
    await conexao.execute("UPDATE acervo SET status = 'Disponivel' WHERE id_acervo = ?", [
      emprestimo.idAcervo,
    ]);

    await conexao.commit();

    return {
      idEmprestimo,
      livro: emprestimo.titulo,
      usuario: emprestimo.usuario,
      dataDevolucao: formatarDataBr(dataDevolucao),
    };
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
}

/* ---------------------------------------------------------
   Rotas da API
   --------------------------------------------------------- */

async function tratarApi(pool, req, res, url) {
  const rota = url.pathname.replace(/\/+$/, "");
  const metodo = (req.method || "GET").toUpperCase();
  const token = lerCookies(req)[COOKIE_SESSAO] || "";
  const sessao = sessaoDoToken(token);

  try {
    /* ---------- Entrar, saber quem está logado, sair ---------- */

    if (metodo === "POST" && rota === "/api/sessoes") {
      const usuario = await autenticar(pool, await lerCorpo(req));
      const novoSegredo = criarSessao(usuario);

      return responder(
        res,
        200,
        { mensagem: "Login realizado com sucesso.", ...sessaoPublica(usuario) },
        { "Set-Cookie": montarCookie(novoSegredo, Math.floor(DURACAO_SESSAO_MS / 1000)) }
      );
    }

    if (metodo === "GET" && rota === "/api/sessoes/atual") {
      exigirSessao(sessao);
      return responder(res, 200, sessaoPublica(sessao));
    }

    if (metodo === "DELETE" && rota === "/api/sessoes") {
      if (token) sessoes.delete(token);
      return responder(res, 200, { mensagem: "Sessão encerrada." }, {
        "Set-Cookie": montarCookie("", 0),
      });
    }

    /* Cadastro aberto: qualquer pessoa cria a própria conta, sempre
       como usuário comum, e já sai logada. */
    if (metodo === "POST" && rota === "/api/contas") {
      const usuario = await cadastrarUsuario(pool, await lerCorpo(req), "Usuario");
      const novoSegredo = criarSessao(usuario);

      return responder(
        res,
        201,
        { mensagem: "Conta criada com sucesso.", ...sessaoPublica(usuario) },
        { "Set-Cookie": montarCookie(novoSegredo, Math.floor(DURACAO_SESSAO_MS / 1000)) }
      );
    }

    /* ---------- Leitura: qualquer conta logada ---------- */

    if (metodo === "GET" && rota === "/api/dashboard") {
      exigirSessao(sessao);
      return responder(res, 200, await obterDashboard(pool));
    }

    if (metodo === "GET" && rota === "/api/livros") {
      exigirSessao(sessao);
      return responder(res, 200, await listarLivros(pool));
    }

    if (metodo === "GET" && rota === "/api/emprestimos") {
      exigirSessao(sessao);
      return responder(res, 200, await listarEmprestimos(pool, url.searchParams.get("limite")));
    }

    /* ---------- Livros: cadastrar, editar e excluir são do dev ---------- */

    if (metodo === "POST" && rota === "/api/livros") {
      exigirDev(sessao);
      const livro = await cadastrarLivro(pool, await lerCorpo(req));
      return responder(res, 201, { mensagem: "Livro cadastrado com sucesso.", ...livro });
    }

    /* PUT /api/livros/12 (editar) e DELETE /api/livros/12 (excluir) */
    const rotaLivro = rota.match(/^\/api\/livros\/([^/]+)$/);
    if (rotaLivro && (metodo === "PUT" || metodo === "DELETE")) {
      exigirDev(sessao);
      const idLivro = validarId(decodeURIComponent(rotaLivro[1]));

      if (metodo === "PUT") {
        const livro = await editarLivro(pool, idLivro, await lerCorpo(req));
        return responder(res, 200, { mensagem: "Livro atualizado com sucesso.", ...livro });
      }

      const removido = await excluirLivro(pool, idLivro);
      return responder(res, 200, {
        mensagem: "Livro removido do catálogo. O histórico de empréstimos foi preservado.",
        ...removido,
      });
    }

    /* ---------- Usuários e permissões: só dev ---------- */

    if (metodo === "GET" && rota === "/api/usuarios") {
      exigirDev(sessao);
      return responder(res, 200, await listarUsuarios(pool));
    }

    if (metodo === "POST" && rota === "/api/usuarios") {
      exigirDev(sessao);
      const usuario = await cadastrarUsuario(pool, await lerCorpo(req));
      return responder(res, 201, { mensagem: "Usuário cadastrado com sucesso.", ...usuario });
    }

    /* PUT troca a permissão, DELETE apaga a conta */
    const rotaUsuario = rota.match(/^\/api\/usuarios\/([^/]+)$/);
    if (rotaUsuario && (metodo === "PUT" || metodo === "DELETE")) {
      exigirDev(sessao);
      const idUsuario = validarId(decodeURIComponent(rotaUsuario[1]));

      if (metodo === "PUT") {
        const atualizado = await alterarPapel(pool, idUsuario, await lerCorpo(req), sessao.idUsuario);
        return responder(res, 200, { mensagem: "Permissão atualizada com sucesso.", ...atualizado });
      }

      const removido = await excluirUsuario(pool, idUsuario, sessao.idUsuario);
      return responder(res, 200, { mensagem: "Usuário excluído com sucesso.", ...removido });
    }

    /* ---------- Circulação: empréstimo e devolução ---------- */

    if (metodo === "POST" && rota === "/api/emprestimos") {
      exigirSessao(sessao);
      const emprestimo = await realizarEmprestimo(pool, await lerCorpo(req), sessao);
      return responder(res, 201, { mensagem: "Livro emprestado com sucesso.", ...emprestimo });
    }

    if (metodo === "POST" && rota === "/api/devolucoes") {
      exigirSessao(sessao);
      const devolucao = await devolverLivro(pool, await lerCorpo(req), sessao);
      return responder(res, 200, { mensagem: "Livro devolvido com sucesso.", ...devolucao });
    }

    return responder(res, 404, { erro: "Rota não encontrada: " + metodo + " " + rota });
  } catch (erro) {
    const { status, mensagem } = traduzirErro(erro);
    return responder(res, status, { erro: mensagem });
  }
}

/* ---------------------------------------------------------
   Arquivos estáticos do site
   --------------------------------------------------------- */

async function servirArquivo(req, res, url) {
  let caminho;
  try {
    caminho = decodeURIComponent(url.pathname);
  } catch (erro) {
    return responder(res, 400, { erro: "Endereço inválido." });
  }

  if (caminho === "/") {
    res.writeHead(302, { Location: "/src/index.html" });
    return res.end();
  }

  const arquivo = path.resolve(RAIZ, "." + caminho);
  if (!arquivo.startsWith(RAIZ)) {
    return responder(res, 403, { erro: "Acesso negado." });
  }

  try {
    const conteudo = await fs.readFile(arquivo);
    res.writeHead(200, {
      "Content-Type": TIPOS[path.extname(arquivo).toLowerCase()] || "application/octet-stream",
      "Content-Length": conteudo.length,
      "Cache-Control": "no-cache",
    });
    res.end(conteudo);
  } catch (erro) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Arquivo não encontrado: " + caminho);
  }
}

/* ---------------------------------------------------------
   Servidor
   --------------------------------------------------------- */

export function criarServidor(pool) {
  return http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://localhost");

    if (url.pathname.startsWith("/api/")) {
      tratarApi(pool, req, res, url);
      return;
    }

    servirArquivo(req, res, url);
  });
}

const executadoDiretamente =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (executadoDiretamente) {
  const { default: pool } = await import("./connectionDB.js");
  const servidor = criarServidor(pool);

  /* HOST fica 127.0.0.1 na sua máquina (não abre porta no firewall) e vira
     0.0.0.0 quando você define HOST=0.0.0.0, que é o que os serviços de
     hospedagem (Railway, Render, VPS...) precisam para receber acesso externo. */
  const ENDERECO = process.env.HOST || "127.0.0.1";

  servidor.listen(PORTA, ENDERECO, async () => {
    const exibido = ENDERECO === "0.0.0.0" ? "127.0.0.1" : ENDERECO;
    console.log("Site: http://" + exibido + ":" + PORTA + "/src/index.html");
    try {
      await pool.query("SELECT 1");
      console.log("MySQL conectado em " + (process.env.DB_NAME || "BIBLIOTECA_BD") + ".");
    } catch (erro) {
      console.warn(
        "Atenção: sem conexão com o MySQL (" + (erro.code || erro.message) + ").\n" +
          "O site abre, mas as telas que leem dados vão mostrar erro até o banco subir."
      );
    }
  });
}
