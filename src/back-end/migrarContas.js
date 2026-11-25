import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { criarHashSenha } from "./senhas.js";

/* =========================================================
   MIGRAÇÃO — transforma a tabela usuarios em contas com login.

   O que ele faz (e pode rodar mais de uma vez sem estragar):
     1. adiciona a coluna senha_hash, se não existir;
     2. adiciona a coluna papel ('Usuario' ou 'Dev'), se não existir;
     3. cria (ou redefine a senha d)a conta base de dev;
     4. dá a senha padrão para contas antigas que ficaram sem senha.

   Rodar:  npm run db:contas
   ========================================================= */

dotenv.config();

const EMAIL_DEV = process.env.DEV_EMAIL || "dev@gmail.com";
const SENHA_DEV = process.env.DEV_SENHA || "1234devs";
const SENHA_PADRAO = "1234";

async function colunaExiste(conexao, tabela, coluna) {
  const [linhas] = await conexao.query("SHOW COLUMNS FROM `" + tabela + "` LIKE ?", [coluna]);
  return linhas.length > 0;
}

async function principal() {
  let conexao;
  try {
    conexao = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      // MySQL hospedado costuma usar outra porta (o TiDB Cloud usa 4000).
      port: Number(process.env.DB_PORT) || 3306,
      // Alguns bancos hospedados só aceitam conexão criptografada: DB_SSL=true.
      ...(String(process.env.DB_SSL || "").toLowerCase() === "true" ? { ssl: {} } : {}),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "BIBLIOTECA_BD",
    });
  } catch (erro) {
    console.error("Não consegui conectar ao MySQL: " + (erro.code || erro.message));
    console.error("Confira se o MySQL está rodando e se o .env tem DB_USER e DB_PASSWORD.");
    process.exitCode = 1;
    return;
  }

  try {
    if (!(await colunaExiste(conexao, "usuarios", "senha_hash"))) {
      await conexao.query(
        "ALTER TABLE usuarios ADD COLUMN senha_hash VARCHAR(255) NULL AFTER email"
      );
      console.log("Coluna senha_hash criada em usuarios.");
    }

    if (!(await colunaExiste(conexao, "usuarios", "papel"))) {
      await conexao.query(
        "ALTER TABLE usuarios ADD COLUMN papel ENUM('Usuario','Dev') NOT NULL DEFAULT 'Usuario' AFTER senha_hash"
      );
      console.log("Coluna papel criada em usuarios.");
    }

    /* Conta base: cria ou acerta a senha conhecida do dev. */
    const hashDev = await criarHashSenha(SENHA_DEV);
    const [devExistente] = await conexao.query(
      "SELECT id_usuario FROM usuarios WHERE email = ? LIMIT 1",
      [EMAIL_DEV]
    );

    if (devExistente.length) {
      await conexao.query(
        "UPDATE usuarios SET senha_hash = ?, papel = 'Dev' WHERE id_usuario = ?",
        [hashDev, devExistente[0].id_usuario]
      );
      console.log("Conta base atualizada: " + EMAIL_DEV + " (papel Dev).");
    } else {
      await conexao.query(
        "INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (?, ?, ?, 'Dev')",
        ["Dev", EMAIL_DEV, hashDev]
      );
      console.log("Conta base criada: " + EMAIL_DEV + " (papel Dev).");
    }

    /* Contas que existiam antes do login ganham a senha padrão. */
    const [semSenha] = await conexao.query(
      "SELECT id_usuario FROM usuarios WHERE senha_hash IS NULL OR senha_hash = ''"
    );

    if (semSenha.length) {
      const hashPadrao = await criarHashSenha(SENHA_PADRAO);
      for (const linha of semSenha) {
        await conexao.query("UPDATE usuarios SET senha_hash = ? WHERE id_usuario = ?", [
          hashPadrao,
          linha.id_usuario,
        ]);
      }
      console.log(
        semSenha.length + " conta(s) antiga(s) receberam a senha padrão " + SENHA_PADRAO + "."
      );
    }

    const [contas] = await conexao.query(
      "SELECT nome, email, papel FROM usuarios ORDER BY papel DESC, nome"
    );
    console.log("\nContas no banco:");
    contas.forEach((conta) => {
      console.log("  [" + conta.papel + "] " + conta.nome + " <" + conta.email + ">");
    });

    console.log("\nConta base para entrar no site: " + EMAIL_DEV + " / " + SENHA_DEV);
  } catch (erro) {
    console.error("Falhou: " + (erro.code || "") + " " + erro.message);
    process.exitCode = 1;
  } finally {
    await conexao.end();
  }
}

principal();
