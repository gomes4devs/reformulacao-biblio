/* =========================================================
   BIBLIO-TECH — TELA DE LOGIN

   Só cuida de entrar: manda e-mail e senha para
   POST /api/sessoes e, se der certo, vai para o início.
   O resto do site usa o src/script.js.
   ========================================================= */

(function () {
    "use strict";

    var formulario = document.getElementById("formulario-login");
    var caixa = document.getElementById("mensagem-feedback");
    var botao = document.getElementById("btn-entrar");

    function mostrar(mensagem, sucesso) {
        if (!caixa) return;
        caixa.textContent = mensagem;
        caixa.style.display = "block";
        caixa.style.color = sucesso ? "#3f6b32" : "#cf5a41";
    }

    function irParaSistema() {
        window.location.href = "../index.html";
    }

    /* Se a sessão ainda está válida, não faz sentido mostrar o login. */
    async function pularSeJaLogado() {
        try {
            var resposta = await fetch("/api/sessoes/atual");
            if (resposta.ok) irParaSistema();
        } catch (erro) {
            /* servidor fora do ar: deixa a pessoa tentar entrar mesmo assim */
        }
    }

    if (formulario) {
        formulario.addEventListener("submit", async function (evento) {
            evento.preventDefault();

            var email = document.getElementById("login-email").value.trim();
            var senha = document.getElementById("login-senha").value;

            if (!email || !senha) {
                mostrar("Preencha e-mail e senha.", false);
                return;
            }

            if (botao) botao.disabled = true;

            try {
                var resposta = await fetch("/api/sessoes", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: email, senha: senha }),
                });

                var dados = null;
                try {
                    dados = await resposta.json();
                } catch (erro) {
                    dados = null;
                }

                if (!resposta.ok) {
                    throw new Error((dados && dados.erro) || "Não foi possível entrar.");
                }

                irParaSistema();
            } catch (erro) {
                mostrar(
                    erro.message === "Failed to fetch"
                        ? "Não consegui falar com o servidor. Ele está rodando? (npm start)"
                        : erro.message,
                    false
                );
            } finally {
                if (botao) botao.disabled = false;
            }
        });
    }

    pularSeJaLogado();
})();
