import dotenv from "dotenv";
import mysql from "mysql2/promise";

/* =========================================================
   MIGRAÇÃO — exclusão de livro preservando o histórico.

   Adiciona a coluna ativo em livros: quando o dev exclui um livro,
   ele vira ativo = 0 e some do catálogo, mas as linhas de acervo e
   emprestimos continuam no banco (o schema usa ON DELETE RESTRICT).

   Pode rodar mais de uma vez sem estragar nada.
   Rodar:  npm run db:livros
   ========================================================= */

dotenv.config();

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
    if (await colunaExiste(conexao, "livros", "ativo")) {
      console.log("A coluna ativo já existe em livros — nada foi alterado.");
    } else {
      await conexao.query(
        "ALTER TABLE livros ADD COLUMN ativo TINYINT NOT NULL DEFAULT 1 AFTER id_categoria_fk"
      );
      console.log("Coluna ativo criada em livros.");
    }

    const [linhas] = await conexao.query(
      "SELECT COUNT(*) AS total, SUM(ativo = 0) AS excluidos FROM livros"
    );
    console.log(
      "Livros no catálogo: " +
        (Number(linhas[0].total) - Number(linhas[0].excluidos || 0)) +
        " | fora do catálogo: " +
        Number(linhas[0].excluidos || 0)
    );
  } catch (erro) {
    console.error("Falhou: " + (erro.code || "") + " " + erro.message);
    process.exitCode = 1;
  } finally {
    await conexao.end();
  }
}

principal();
