/* =========================================================
   BIBLIO-TECH — CRIAR CONTA

   Manda nome, e-mail e senha para POST /api/contas. O servidor
   cria a conta sempre como usuário comum, devolve o cookie de
   sessão e a pessoa já cai no início do site.
   ========================================================= */

(function () {
    "use strict";

    var formulario = document.getElementById("formulario-criar-conta");
    var caixa = document.getElementById("mensagem-feedback");
    var botao = document.getElementById("btn-criar-conta");

    function mostrar(mensagem, sucesso) {
        if (!caixa) return;
        caixa.textContent = mensagem;
        caixa.style.display = "block";
        caixa.style.color = sucesso ? "#3f6b32" : "#cf5a41";
    }

    function irParaSistema() {
        window.location.href = "../index.html";
    }

    if (formulario) {
        formulario.addEventListener("submit", async function (evento) {
            evento.preventDefault();

            var nome = document.getElementById("conta-nome").value.trim();
            var email = document.getElementById("conta-email").value.trim();
            var senha = document.getElementById("conta-senha").value;

            if (!nome || !email || !senha) {
                mostrar("Preencha nome, e-mail e senha.", false);
                return;
            }

            if (senha.length < 4) {
                mostrar("A senha precisa ter pelo menos 4 caracteres.", false);
                return;
            }

            if (botao) botao.disabled = true;

            try {
                var resposta = await fetch("/api/contas", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nome: nome, email: email, senha: senha }),
                });

                var dados = null;
                try {
                    dados = await resposta.json();
                } catch (erro) {
                    dados = null;
                }

                if (!resposta.ok) {
                    throw new Error((dados && dados.erro) || "Não foi possível criar a conta.");
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
})();
