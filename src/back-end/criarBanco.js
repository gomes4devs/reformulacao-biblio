import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

/* =========================================================
   Cria o banco e as tabelas lendo o src/back-end/schema.sql.

   Serve para quem não tem o cliente `mysql` no PATH:
       npm run db:criar

   Usa as credenciais do .env (DB_HOST, DB_USER, DB_PASSWORD).
   ========================================================= */

dotenv.config();

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CAMINHO_SCHEMA = path.join(RAIZ, "src", "back-end", "schema.sql");

async function principal() {
  let sql;
  try {
    sql = await fs.readFile(CAMINHO_SCHEMA, "utf8");
  } catch (erro) {
    console.error("Não encontrei o arquivo src/back-end/schema.sql.");
    process.exitCode = 1;
    return;
  }

  let conexao;
  try {
    conexao = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      multipleStatements: true,
    });
  } catch (erro) {
    console.error("Não consegui conectar ao MySQL: " + (erro.code || erro.message));
    console.error(
      "Confira se o MySQL está instalado e rodando, e se o .env tem DB_USER e DB_PASSWORD corretos."
    );
    process.exitCode = 1;
    return;
  }

  try {
    await conexao.query(sql);
    console.log("Banco criado com sucesso a partir do schema.sql.");
  } catch (erro) {
    if (erro.code === "ER_TABLE_EXISTS_ERROR") {
      console.log("As tabelas já existem — nada foi alterado.");
    } else {
      console.error("Falhou ao criar as tabelas: " + (erro.code || "") + " " + erro.message);
      process.exitCode = 1;
      return;
    }
  }

  const nomeBanco = process.env.DB_NAME || "BIBLIOTECA_BD";
  try {
    const [tabelas] = await conexao.query("SHOW FULL TABLES FROM `" + nomeBanco + "`");
    console.log(
      "Banco " + nomeBanco + " — tabelas: " +
        tabelas.map((linha) => Object.values(linha)[0]).join(", ")
    );
  } catch (erro) {
    console.error(
      "As tabelas foram criadas, mas o banco " + nomeBanco + " não foi encontrado. " +
        "O schema.sql cria BIBLIOTECA_BD; se você usa outro nome, ajuste o DB_NAME do .env."
    );
  } finally {
    await conexao.end();
  }
}

principal();
