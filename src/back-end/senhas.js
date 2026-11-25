import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/* =========================================================
   SENHAS — hash com scrypt, que já vem no Node.

   O que vai para o banco na coluna senha_hash é:
       "salt_em_hex:hash_em_hex"

   Assim a senha em texto puro nunca é gravada nem devolvida
   pela API. O mesmo arquivo é usado pelo server.js e pelo
   migrarContas.js, para os dois gerarem o mesmo formato.
   ========================================================= */

const scrypt = promisify(scryptCallback);
const TAMANHO_HASH = 64;

/* Token aleatório usado como identificador da sessão (cookie). */
export function criarToken() {
  return randomBytes(32).toString("hex");
}

export async function criarHashSenha(senha) {
  const salt = randomBytes(16).toString("hex");
  const derivada = await scrypt(String(senha), salt, TAMANHO_HASH);
  return salt + ":" + derivada.toString("hex");
}

export async function conferirSenha(senha, hash) {
  if (!hash) return false;

  const [salt, guardado] = String(hash).split(":");
  if (!salt || !guardado) return false;

  const derivada = await scrypt(String(senha), salt, TAMANHO_HASH);
  const alvo = Buffer.from(guardado, "hex");

  if (alvo.length !== derivada.length) return false;

  return timingSafeEqual(alvo, derivada);
}
