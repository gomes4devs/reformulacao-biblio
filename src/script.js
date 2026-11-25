/* =========================================================
   BIBLIO-TECH — FRONT-END
   Os dados vêm todos da API /api (src/back-end/server.js),
   que grava no MySQL. Não usamos mais localStorage.
   ========================================================= */

(function () {
    "use strict";

    var POR_PAGINA = 5;

    var livros = [];
    var usuarios = [];
    var paginaLivros = 1;
    var paginaUsuarios = 1;
    var categoriaSelecionada = "todas";
    var disponibilidadeSelecionada = "todas";

    /* Quem está logado (vem de GET /api/sessoes/atual) e quais
       páginas do menu só aparecem para contas dev. */
    var sessaoAtual = null;

    var PAGINAS_SO_DEV = [
        "usuarios-cadastrados.html",
        "cadastro-usuarios.html",
        "cadastro-livros.html",
    ];

    /* -----------------------------------------------------
       Utilidades
       ----------------------------------------------------- */

    function elemento(id) {
        return document.getElementById(id);
    }

    function valor(id) {
        var campo = elemento(id);
        return campo ? campo.value.trim() : "";
    }

    function mostrarMensagem(mensagem, sucesso) {
        document.querySelectorAll("#mensagem-feedback").forEach(function (caixa) {
            caixa.textContent = mensagem;
            caixa.style.display = "block";
            caixa.style.color = sucesso ? "#3f6b32" : "#cf5a41";
        });
    }

    function mensagemDeErro(erro) {
        return erro && erro.message ? erro.message : "Erro inesperado.";
    }

    /* -----------------------------------------------------
       Sessão e permissões
       ----------------------------------------------------- */

    function raizDoSite() {
        return window.location.pathname.indexOf("/pages/") !== -1 ? "../" : "./";
    }

    function irParaLogin() {
        window.location.href = raizDoSite() + "pages/login.html";
    }

    function ehDev() {
        return !!sessaoAtual && sessaoAtual.papel === "Dev";
    }

    function colunasCatalogo() {
        return ehDev() ? 6 : 5;
    }

    async function carregarSessao() {
        try {
            var resposta = await fetch("/api/sessoes/atual");
            if (!resposta.ok) {
                irParaLogin();
                return null;
            }
            return await resposta.json();
        } catch (erro) {
            irParaLogin();
            return null;
        }
    }

    function aplicarSessaoNaInterface() {
        var rodape = document.querySelector(".sidebar-footer");
        if (!rodape || !sessaoAtual) return;

        var caixa = document.createElement("div");
        caixa.className = "sessao-info";

        var avatar = document.createElement("span");
        avatar.className = "sessao-avatar";
        avatar.textContent = String(sessaoAtual.nome || "?").trim().charAt(0).toUpperCase();

        var dados = document.createElement("span");
        dados.className = "sessao-dados";

        var nome = document.createElement("span");
        nome.className = "sessao-nome";
        nome.textContent = sessaoAtual.nome;

        var papel = document.createElement("span");
        papel.className = "sessao-papel" + (ehDev() ? " dev" : "");
        papel.textContent = ehDev() ? "Dev" : "Usuário";

        dados.appendChild(nome);
        dados.appendChild(papel);
        caixa.appendChild(avatar);
        caixa.appendChild(dados);
        rodape.insertBefore(caixa, rodape.firstChild);
    }

    /* Usuário comum não vê os menus de gestão nem a coluna de ações
       do catálogo. O servidor também barra essas rotas. */
    function aplicarPermissoes() {
        if (!ehDev()) {
            document.querySelectorAll(".nav-menu a").forEach(function (link) {
                var href = link.getAttribute("href") || "";
                var restrita = PAGINAS_SO_DEV.some(function (pagina) {
                    return href.indexOf(pagina) !== -1;
                });
                if (restrita && link.parentElement) link.parentElement.remove();
            });

            document.querySelectorAll(".th-acoes").forEach(function (celula) {
                celula.hidden = true;
            });
        }

        var sair = document.querySelector(".btn-sair");
        if (sair) sair.addEventListener("click", aoSair);
    }

    async function aoSair() {
        try {
            await api("/sessoes", { method: "DELETE" });
        } catch (erro) {
            /* mesmo se a chamada falhar, manda de volta para o login */
        }
        irParaLogin();
    }

    function paginaBloqueada() {
        var minimo = document.body.getAttribute("data-papel-minimo");
        if (minimo !== "dev" || ehDev()) return false;

        var principal = document.querySelector(".conteudo-principal");
        if (!principal) return true;

        principal.innerHTML = "";

        var aviso = document.createElement("section");
        aviso.className = "acesso-negado";
        aviso.innerHTML =
            "<h2>Acesso restrito</h2>" +
            "<p>Esta página é exclusiva de contas <strong>dev</strong>. " +
            "Se você precisa cadastrar livros ou mexer em permissões, peça para um dev liberar.</p>" +
            '<a href="' +
            raizDoSite() +
            'index.html">Voltar para o início</a>';

        principal.appendChild(aviso);
        return true;
    }

    function semAcentos(texto) {
        return String(texto || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
    }

    async function api(caminho, opcoes) {
        var configuracao = Object.assign({ headers: { "Content-Type": "application/json" } }, opcoes || {});
        var resposta;

        try {
            resposta = await fetch("/api" + caminho, configuracao);
        } catch (erro) {
            throw new Error("Não consegui falar com o servidor. Ele está rodando? (npm start)");
        }

        var dados = null;
        try {
            dados = await resposta.json();
        } catch (erro) {
            dados = null;
        }

        if (resposta.status === 401) {
            irParaLogin();
        }

        if (!resposta.ok) {
            var falha = new Error((dados && dados.erro) || "O servidor respondeu com erro " + resposta.status + ".");
            falha.status = resposta.status;
            throw falha;
        }

        return dados;
    }

    function avisoNaTabela(idCorpo, colunas, texto) {
        var corpo = elemento(idCorpo);
        if (!corpo) return;
        corpo.innerHTML = "";

        var linha = document.createElement("tr");
        var celula = document.createElement("td");
        celula.colSpan = colunas;
        celula.textContent = texto;
        linha.appendChild(celula);
        corpo.appendChild(linha);
    }

    function criarLinha(valores) {
        var linha = document.createElement("tr");
        valores.forEach(function (texto) {
            var celula = document.createElement("td");
            celula.textContent = texto === null || texto === undefined || texto === "" ? "—" : texto;
            linha.appendChild(celula);
        });
        return linha;
    }

    function renderizarPaginacao(id, total, pagina, aoMudar) {
        var container = elemento(id);
        if (!container) return;
        container.innerHTML = "";

        var totalPaginas = Math.ceil(total / POR_PAGINA);
        for (var i = 1; i <= totalPaginas; i += 1) {
            var botao = document.createElement("button");
            botao.type = "button";
            botao.textContent = i;
            botao.className = i === pagina ? "pagina-ativa" : "";
            botao.addEventListener(
                "click",
                (function (numero) {
                    return function () {
                        aoMudar(numero);
                    };
                })(i)
            );
            container.appendChild(botao);
        }
    }

    /* -----------------------------------------------------
       Início — métricas e empréstimos recentes
       ----------------------------------------------------- */

    async function carregarDashboard() {
        var corpo = elemento("corpo-tabela-emprestimos");

        try {
            var dados = await api("/dashboard");

            if (elemento("total-livros")) elemento("total-livros").textContent = dados.livros;
            if (elemento("emprestimos-ativos")) elemento("emprestimos-ativos").textContent = dados.emprestimosAtivos;
            if (elemento("total-usuarios")) elemento("total-usuarios").textContent = dados.usuarios;

            if (!corpo) return;
            corpo.innerHTML = "";

            if (!dados.recentes.length) {
                avisoNaTabela("corpo-tabela-emprestimos", 5, "Nenhum empréstimo registrado ainda.");
                return;
            }

            dados.recentes.forEach(function (item) {
                var linha = criarLinha([
                    item.livro,
                    item.usuario,
                    item.dataEmprestimo,
                    item.dataDevolucao || item.dataDevolucaoEsperada,
                    item.status,
                ]);
                linha.lastChild.className = "chip " + (item.status === "Ativo" ? "chip-ativo" : "chip-devolvido");
                corpo.appendChild(linha);
            });
        } catch (erro) {
            ["total-livros", "emprestimos-ativos", "total-usuarios"].forEach(function (id) {
                var cartao = elemento(id);
                if (cartao) cartao.textContent = "—";
            });
            avisoNaTabela("corpo-tabela-emprestimos", 5, mensagemDeErro(erro));
        }
    }

    /* -----------------------------------------------------
       Relatórios (consulta.html)
       ----------------------------------------------------- */

    async function carregarRelatorio() {
        var cartoes = document.querySelectorAll(".relatorio-secao .card-numero");
        if (cartoes.length < 3) return;

        try {
            var dados = await api("/dashboard");
            cartoes[0].textContent = dados.totalEmprestimos;
            cartoes[1].textContent = dados.usuariosAtivos;
            cartoes[2].textContent = dados.atrasos;
        } catch (erro) {
            cartoes.forEach(function (cartao) {
                cartao.textContent = "—";
            });
            mostrarMensagem(mensagemDeErro(erro), false);
        }
    }

    /* -----------------------------------------------------
       Catálogo
       ----------------------------------------------------- */

    async function carregarLivros() {
        try {
            livros = await api("/livros");
            paginaLivros = 1;
            buscarLivros();
        } catch (erro) {
            avisoNaTabela("corpo-tabela-livros", colunasCatalogo(), mensagemDeErro(erro));
        }
    }

    function livroDisponivel(livro) {
        return Number(livro.disponiveis) > 0;
    }

    var ICONE_EDITAR =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';

    var ICONE_EXCLUIR =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>';

    function criarCelulaAcoes(livro) {
        var celula = document.createElement("td");
        celula.className = "td-acoes";

        var editar = document.createElement("button");
        editar.type = "button";
        editar.className = "btn-acao";
        editar.title = "Editar " + livro.titulo;
        editar.setAttribute("aria-label", "Editar " + livro.titulo);
        editar.innerHTML = ICONE_EDITAR;
        editar.addEventListener("click", function () {
            abrirModalEdicao(livro);
        });

        var excluir = document.createElement("button");
        excluir.type = "button";
        excluir.className = "btn-acao btn-acao-excluir";
        excluir.title = "Excluir " + livro.titulo;
        excluir.setAttribute("aria-label", "Excluir " + livro.titulo);
        excluir.innerHTML = ICONE_EXCLUIR;
        excluir.addEventListener("click", function () {
            abrirModalExclusao(livro);
        });

        celula.appendChild(editar);
        celula.appendChild(excluir);
        return celula;
    }

    function renderizarLivros(lista) {
        var corpo = elemento("corpo-tabela-livros");
        if (!corpo) return;
        corpo.innerHTML = "";

        lista.forEach(function (livro) {
            var linha = criarLinha([livro.titulo, livro.autor, livro.categoria, livro.ano]);

            var celula = document.createElement("td");
            var etiqueta = document.createElement("span");
            etiqueta.textContent = livroDisponivel(livro)
                ? "Disponível (" + livro.disponiveis + ")"
                : "Indisponível";
            etiqueta.className = livroDisponivel(livro) ? "disponivel" : "indisponivel";
            celula.appendChild(etiqueta);
            linha.appendChild(celula);

            if (ehDev()) {
                linha.appendChild(criarCelulaAcoes(livro));
            }

            corpo.appendChild(linha);
        });
    }

    function buscarLivros() {
        var corpo = elemento("corpo-tabela-livros");
        var texto = semAcentos(elemento("input-busca") ? elemento("input-busca").value : "");

        var encontrados = livros.filter(function (livro) {
            var alvo = semAcentos(livro.titulo + " " + livro.autor + " " + livro.isbn);
            var combinaTexto = !texto || alvo.indexOf(texto) !== -1;
            var combinaCategoria =
                categoriaSelecionada === "todas" || semAcentos(livro.categoria) === categoriaSelecionada;
            var disponivel = livroDisponivel(livro);
            var combinaDisponibilidade =
                disponibilidadeSelecionada === "todas" ||
                (disponibilidadeSelecionada === "disponivel" && disponivel) ||
                (disponibilidadeSelecionada === "indisponivel" && !disponivel);

            return combinaTexto && combinaCategoria && combinaDisponibilidade;
        });

        if (!corpo) return;

        if (!encontrados.length) {
            avisoNaTabela(
                "corpo-tabela-livros",
                colunasCatalogo(),
                livros.length ? "Nenhum livro encontrado." : "Nenhum livro cadastrado ainda."
            );
            renderizarPaginacao("numeros-pagina", 0, paginaLivros, function () {});
            return;
        }

        var inicio = (paginaLivros - 1) * POR_PAGINA;
        renderizarLivros(encontrados.slice(inicio, inicio + POR_PAGINA));
        renderizarPaginacao("numeros-pagina", encontrados.length, paginaLivros, function (pagina) {
            paginaLivros = pagina;
            buscarLivros();
        });
    }

    /* -----------------------------------------------------
       Editar e excluir livro (o U e o D do CRUD)
       ----------------------------------------------------- */

    var livroParaExcluir = null;

    function abrirModal(id) {
        var modal = elemento(id);
        if (!modal) return;
        modal.hidden = false;
    }

    function fecharModal(id) {
        var modal = elemento(id);
        if (!modal) return;
        modal.hidden = true;
    }

    function abrirModalEdicao(livro) {
        elemento("editar-id").value = livro.idLivro;
        elemento("editar-titulo").value = livro.titulo || "";
        elemento("editar-autor").value = livro.autor || "";
        elemento("editar-isbn").value = livro.isbn || "";
        elemento("editar-editora").value = livro.editora || "";
        elemento("editar-ano").value = livro.ano || "";
        elemento("editar-categoria").value = livro.categoria || "";
        elemento("editar-sinopse").value = livro.sinopse || "";

        var resumo = elemento("editar-exemplares");
        if (resumo) {
            resumo.textContent =
                livro.total +
                " exemplar(es) no acervo, " +
                livro.disponiveis +
                " disponível(is). A quantidade é alterada pelo cadastro de novos exemplares.";
        }

        abrirModal("modal-editar-livro");
    }

    function abrirModalExclusao(livro) {
        livroParaExcluir = livro;

        var titulo = elemento("excluir-titulo");
        if (titulo) titulo.textContent = livro.titulo;

        var detalhe = elemento("excluir-detalhe");
        if (detalhe) {
            detalhe.textContent =
                "O livro sai do catálogo e não pode mais ser emprestado. O histórico de empréstimos é preservado. Só não dá para excluir enquanto houver exemplar emprestado.";
        }

        abrirModal("modal-excluir-livro");
    }

    function aoSalvarEdicao(evento) {
        evento.preventDefault();

        var id = valor("editar-id");
        var formulario = elemento("formulario-editar-livro");
        var botao = formulario ? formulario.querySelector("button[type='submit']") : null;

        var corpo = {
            titulo: valor("editar-titulo"),
            autor: valor("editar-autor"),
            isbn: valor("editar-isbn"),
            editora: valor("editar-editora"),
            ano: valor("editar-ano"),
            categoria: valor("editar-categoria"),
            sinopse: valor("editar-sinopse"),
        };

        var faltando = Object.keys(corpo).some(function (chave) {
            return chave !== "sinopse" && !String(corpo[chave]).trim();
        });
        if (faltando) {
            mostrarMensagem("Preencha todos os campos obrigatórios.", false);
            return;
        }

        enviar(botao, async function () {
            try {
                var dados = await api("/livros/" + id, { method: "PUT", body: JSON.stringify(corpo) });
                fecharModal("modal-editar-livro");
                mostrarMensagem(dados.mensagem, true);
                await carregarLivros();
            } catch (erro) {
                mostrarMensagem(mensagemDeErro(erro), false);
            }
        });
    }

    function aoConfirmarExclusao() {
        if (!livroParaExcluir) return;

        var botao = elemento("btn-confirmar-exclusao");
        var livro = livroParaExcluir;

        enviar(botao, async function () {
            try {
                var dados = await api("/livros/" + livro.idLivro, { method: "DELETE" });

                livroParaExcluir = null;
                fecharModal("modal-excluir-livro");

                mostrarMensagem(dados.mensagem, true);
                await carregarLivros();
            } catch (erro) {
                fecharModal("modal-excluir-livro");
                mostrarMensagem(mensagemDeErro(erro), false);
            }
        });
    }

    function configurarModaisLivro() {
        var formulario = elemento("formulario-editar-livro");
        if (formulario) formulario.addEventListener("submit", aoSalvarEdicao);

        var confirmar = elemento("btn-confirmar-exclusao");
        if (confirmar) confirmar.addEventListener("click", aoConfirmarExclusao);

        [
            ["btn-fechar-modal-editar", "modal-editar-livro"],
            ["btn-cancelar-editar", "modal-editar-livro"],
            ["btn-fechar-modal-excluir", "modal-excluir-livro"],
            ["btn-cancelar-exclusao", "modal-excluir-livro"],
        ].forEach(function (par) {
            var botao = elemento(par[0]);
            if (botao) {
                botao.addEventListener("click", function () {
                    fecharModal(par[1]);
                });
            }
        });

        document.querySelectorAll(".modal-overlay").forEach(function (overlay) {
            overlay.addEventListener("click", function (evento) {
                if (evento.target === overlay) fecharModal(overlay.id);
            });
        });

        document.addEventListener("keydown", function (evento) {
            if (evento.key !== "Escape") return;
            document.querySelectorAll(".modal-overlay").forEach(function (overlay) {
                if (!overlay.hidden) fecharModal(overlay.id);
            });
        });
    }

    /* -----------------------------------------------------
       Usuários
       ----------------------------------------------------- */

    async function carregarUsuarios() {
        try {
            usuarios = await api("/usuarios");
            paginaUsuarios = 1;
            buscarUsuarios();
        } catch (erro) {
            avisoNaTabela("corpo-tabela-usuarios", 4, mensagemDeErro(erro));
        }
    }

    /* O dev troca a permissão direto no seletor da tabela. */
    async function salvarPapel(usuario, campo) {
        var papelAnterior = usuario.papel;

        try {
            var dados = await api("/usuarios/" + usuario.idUsuario, {
                method: "PUT",
                body: JSON.stringify({ papel: campo.value }),
            });

            usuario.papel = dados.papel;
            campo.dataset.papel = usuario.papel;

            mostrarMensagem(
                usuario.nome + " agora é " + (usuario.papel === "Dev" ? "dev." : "usuário comum."),
                true
            );
        } catch (erro) {
            campo.value = papelAnterior;
            mostrarMensagem(mensagemDeErro(erro), false);
        }
    }

    /* Exclusão de conta: o dev confirma num modal, como no catálogo. */
    var usuarioParaExcluir = null;

    function abrirModalExclusaoUsuario(usuario) {
        usuarioParaExcluir = usuario;

        var nome = elemento("excluir-usuario-nome");
        if (nome) nome.textContent = usuario.nome;

        var detalhe = elemento("excluir-usuario-detalhe");
        if (detalhe) {
            detalhe.textContent =
                "A conta " +
                usuario.email +
                " perde o acesso ao site. A exclusão é bloqueada quando o usuário tem empréstimos, para preservar o histórico.";
        }

        abrirModal("modal-excluir-usuario");
    }

    function aoConfirmarExclusaoUsuario() {
        if (!usuarioParaExcluir) return;

        var botao = elemento("btn-confirmar-exclusao-usuario");
        var usuario = usuarioParaExcluir;

        enviar(botao, async function () {
            try {
                var dados = await api("/usuarios/" + usuario.idUsuario, { method: "DELETE" });

                usuarioParaExcluir = null;
                fecharModal("modal-excluir-usuario");

                mostrarMensagem(dados.mensagem, true);
                await carregarUsuarios();
            } catch (erro) {
                fecharModal("modal-excluir-usuario");
                mostrarMensagem(mensagemDeErro(erro), false);
            }
        });
    }

    function configurarModalUsuario() {
        var confirmar = elemento("btn-confirmar-exclusao-usuario");
        if (confirmar) confirmar.addEventListener("click", aoConfirmarExclusaoUsuario);

        [
            ["btn-fechar-modal-excluir-usuario", "modal-excluir-usuario"],
            ["btn-cancelar-exclusao-usuario", "modal-excluir-usuario"],
        ].forEach(function (par) {
            var botao = elemento(par[0]);
            if (botao) {
                botao.addEventListener("click", function () {
                    fecharModal(par[1]);
                });
            }
        });
    }

    function renderizarUsuarios(lista) {
        var corpo = elemento("corpo-tabela-usuarios");
        if (!corpo) return;
        corpo.innerHTML = "";

        lista.forEach(function (usuario) {
            var linha = criarLinha([usuario.nome, usuario.email]);

            var celula = document.createElement("td");
            var campo = document.createElement("select");
            campo.className = "select-papel";
            campo.dataset.papel = usuario.papel;
            campo.setAttribute("aria-label", "Permissão de " + usuario.nome);

            ["Usuario", "Dev"].forEach(function (papel) {
                var opcao = document.createElement("option");
                opcao.value = papel;
                opcao.textContent = papel === "Dev" ? "Dev" : "Usuário";
                campo.appendChild(opcao);
            });

            campo.value = usuario.papel === "Dev" ? "Dev" : "Usuario";
            campo.addEventListener("change", function () {
                salvarPapel(usuario, campo);
            });

            celula.appendChild(campo);
            linha.appendChild(celula);

            var acoes = document.createElement("td");
            acoes.className = "td-acoes";

            var excluir = document.createElement("button");
            excluir.type = "button";
            excluir.className = "btn-acao btn-acao-excluir";
            excluir.title = "Excluir " + usuario.nome;
            excluir.setAttribute("aria-label", "Excluir " + usuario.nome);
            excluir.innerHTML = ICONE_EXCLUIR;
            excluir.addEventListener("click", function () {
                abrirModalExclusaoUsuario(usuario);
            });

            acoes.appendChild(excluir);
            linha.appendChild(acoes);

            corpo.appendChild(linha);
        });
    }

    function buscarUsuarios() {
        var corpo = elemento("corpo-tabela-usuarios");
        var texto = semAcentos(elemento("input-pesquisa-usuarios") ? elemento("input-pesquisa-usuarios").value : "");

        var encontrados = usuarios.filter(function (usuario) {
            return !texto || semAcentos(usuario.nome + " " + usuario.email).indexOf(texto) !== -1;
        });

        if (!corpo) return;

        if (!encontrados.length) {
            avisoNaTabela(
                "corpo-tabela-usuarios",
                4,
                usuarios.length ? "Nenhum usuário encontrado." : "Nenhum usuário cadastrado ainda."
            );
            renderizarPaginacao("numeros-pagina-usuarios", 0, paginaUsuarios, function () {});
            return;
        }

        var inicio = (paginaUsuarios - 1) * POR_PAGINA;
        renderizarUsuarios(encontrados.slice(inicio, inicio + POR_PAGINA));
        renderizarPaginacao("numeros-pagina-usuarios", encontrados.length, paginaUsuarios, function (pagina) {
            paginaUsuarios = pagina;
            buscarUsuarios();
        });
    }

    /* -----------------------------------------------------
       Formulários
       ----------------------------------------------------- */

    async function enviar(botao, acao) {
        if (botao) botao.disabled = true;
        try {
            await acao();
        } finally {
            if (botao) botao.disabled = false;
        }
    }

    function aoCadastrarUsuario(evento) {
        evento.preventDefault();

        var formulario = elemento("formulario-cadastro-usuarios");
        var botao = formulario ? formulario.querySelector("button[type='submit']") : null;
        var nome = valor("input-nome");
        var email = valor("input-email");
        var senha = valor("input-senha");
        var campoPapel = elemento("input-papel");
        var papel = campoPapel ? campoPapel.value : "Usuario";

        if (!nome || !email || !senha) {
            mostrarMensagem("Preencha nome, e-mail e senha.", false);
            return;
        }

        enviar(botao, async function () {
            try {
                var dados = await api("/usuarios", {
                    method: "POST",
                    body: JSON.stringify({ nome: nome, email: email, senha: senha, papel: papel }),
                });
                formulario.reset();
                mostrarMensagem(dados.mensagem, true);
            } catch (erro) {
                mostrarMensagem(mensagemDeErro(erro), false);
            }
        });
    }

    function aoCadastrarLivro(evento) {
        evento.preventDefault();

        var formulario = elemento("formulario-cadastro-livro");
        var botao = formulario ? formulario.querySelector("button[type='submit']") : null;

        var corpo = {
            titulo: valor("input-titulo"),
            autor: valor("input-autor"),
            isbn: valor("input-isbn"),
            editora: valor("input-editora"),
            ano: valor("input-ano"),
            categoria: valor("input-categoria"),
            sinopse: valor("input-sinopse"),
            quantidade: valor("input-quantidade"),
            localizacao: valor("input-localizacao"),
        };

        var faltando = Object.keys(corpo).some(function (chave) {
            return chave !== "sinopse" && !String(corpo[chave]).trim();
        });
        if (faltando) {
            mostrarMensagem("Preencha todos os campos obrigatórios.", false);
            return;
        }

        enviar(botao, async function () {
            try {
                var dados = await api("/livros", { method: "POST", body: JSON.stringify(corpo) });
                formulario.reset();
                mostrarMensagem(dados.mensagem + " (" + dados.exemplares + " exemplar(es))", true);
            } catch (erro) {
                mostrarMensagem(mensagemDeErro(erro), false);
            }
        });
    }

    /* -----------------------------------------------------
       Seletores de empréstimo e devolução
       ----------------------------------------------------- */

    function preencherSelect(select, itens, textoVazio) {
        select.innerHTML = "";

        if (!itens.length) {
            var vazio = document.createElement("option");
            vazio.value = "";
            vazio.textContent = textoVazio;
            select.appendChild(vazio);
            return;
        }

        var inicial = document.createElement("option");
        inicial.value = "";
        inicial.textContent = "Selecione…";
        select.appendChild(inicial);

        itens.forEach(function (item) {
            var opcao = document.createElement("option");
            opcao.value = item.valor;
            opcao.textContent = item.texto;
            select.appendChild(opcao);
        });
    }

    async function carregarOpcoesEmprestimo() {
        var select = elemento("select-livro");
        if (!select) return;

        try {
            var lista = await api("/livros");
            var disponiveis = lista.filter(function (livro) {
                return Number(livro.disponiveis) > 0;
            });

            preencherSelect(
                select,
                disponiveis.map(function (livro) {
                    return {
                        valor: livro.idLivro,
                        texto: livro.titulo + " — " + livro.autor + " (" + livro.disponiveis + ")",
                    };
                }),
                "Nenhum exemplar disponível no momento"
            );
        } catch (erro) {
            preencherSelect(select, [], mensagemDeErro(erro));
        }
    }

    /* O seletor de usuário só aparece para dev: usuário comum empresta
       para a própria conta. */
    async function carregarOpcoesUsuarioEmprestimo() {
        var select = elemento("select-usuario");
        var grupo = elemento("grupo-select-usuario");

        if (!select || !ehDev()) return;

        if (grupo) grupo.hidden = false;

        try {
            var lista = await api("/usuarios");
            preencherSelect(
                select,
                lista.map(function (usuario) {
                    return {
                        valor: usuario.idUsuario,
                        texto: usuario.nome + " — " + usuario.email,
                    };
                }),
                "Nenhum usuário cadastrado"
            );
        } catch (erro) {
            preencherSelect(select, [], mensagemDeErro(erro));
        }
    }

    function mostrarAvisoEmprestimo() {
        var aviso = elemento("aviso-emprestimo");
        if (!aviso || !sessaoAtual) return;

        aviso.textContent = ehDev()
            ? "Como dev, você escolhe para qual usuário é o empréstimo."
            : "O empréstimo fica na sua conta: " + sessaoAtual.nome + " (" + sessaoAtual.email + ").";
    }

    async function carregarOpcoesDevolucao() {
        var select = elemento("select-emprestimo");
        if (!select) return;

        try {
            var lista = await api("/emprestimos");
            var abertos = lista.filter(function (item) {
                return item.status === "Ativo" && (ehDev() || item.email === sessaoAtual.email);
            });

            preencherSelect(
                select,
                abertos.map(function (item) {
                    return {
                        valor: item.idEmprestimo,
                        texto:
                            item.livro +
                            " — " +
                            item.usuario +
                            " (desde " +
                            item.dataEmprestimo +
                            ")",
                    };
                }),
                "Nenhum empréstimo em aberto"
            );
        } catch (erro) {
            preencherSelect(select, [], mensagemDeErro(erro));
        }
    }

    function mostrarAvisoDevolucao() {
        var aviso = elemento("aviso-devolucao");
        if (!aviso || !sessaoAtual) return;

        aviso.textContent = ehDev()
            ? "Como dev, você vê os empréstimos em aberto de todo mundo."
            : "A lista mostra só os empréstimos em aberto da sua conta.";
    }

    function aoEmprestar(evento) {
        evento.preventDefault();

        var formulario = elemento("formulario-emprestar-livro");
        var botao = formulario ? formulario.querySelector("button[type='submit']") : null;

        var corpo = {
            idLivro: valor("select-livro"),
            dataEmprestimo: valor("input-data-emprestimo"),
        };

        var precisaUsuario = ehDev() && elemento("select-usuario");
        if (precisaUsuario) {
            corpo.idUsuario = valor("select-usuario");
        }

        if (!corpo.idLivro || !corpo.dataEmprestimo) {
            mostrarMensagem("Escolha o livro e a data do empréstimo.", false);
            return;
        }

        if (precisaUsuario && !corpo.idUsuario) {
            mostrarMensagem("Escolha para qual usuário é o empréstimo.", false);
            return;
        }

        enviar(botao, async function () {
            try {
                var dados = await api("/emprestimos", { method: "POST", body: JSON.stringify(corpo) });
                formulario.reset();
                mostrarMensagem(
                    dados.mensagem +
                        " " +
                        dados.livro +
                        " para " +
                        dados.usuario +
                        ". Devolução prevista para " +
                        dados.dataDevolucaoEsperada +
                        ".",
                    true
                );
                await carregarOpcoesEmprestimo();
            } catch (erro) {
                mostrarMensagem(mensagemDeErro(erro), false);
            }
        });
    }

    function aoDevolver(evento) {
        evento.preventDefault();

        var formulario = elemento("formulario-devolucao");
        var botao = formulario ? formulario.querySelector("button[type='submit']") : null;

        var corpo = {
            idEmprestimo: valor("select-emprestimo"),
            dataDevolucao: valor("input-data-devolucao"),
        };

        if (!corpo.idEmprestimo || !corpo.dataDevolucao) {
            mostrarMensagem("Escolha o empréstimo e a data da devolução.", false);
            return;
        }

        enviar(botao, async function () {
            try {
                var dados = await api("/devolucoes", { method: "POST", body: JSON.stringify(corpo) });
                formulario.reset();
                mostrarMensagem(
                    dados.mensagem + " " + dados.livro + " — " + dados.usuario + ".",
                    true
                );
                await carregarOpcoesDevolucao();
            } catch (erro) {
                mostrarMensagem(mensagemDeErro(erro), false);
            }
        });
    }

    /* -----------------------------------------------------
       Menus de filtro
       ----------------------------------------------------- */

    function fecharDropdowns() {
        document.querySelectorAll(".dropdown-menu.ativo").forEach(function (menu) {
            menu.classList.remove("ativo");
        });
        document.querySelectorAll(".btn-dropdown.ativo").forEach(function (botao) {
            botao.classList.remove("ativo");
        });
    }

    function configurarDropdowns() {
        [
            ["btn-categoria", "menu-categoria"],
            ["btn-disponibilidade", "menu-disponibilidade"],
        ].forEach(function (par) {
            var botao = elemento(par[0]);
            var menu = elemento(par[1]);
            if (!botao || !menu) return;

            botao.addEventListener("click", function (evento) {
                evento.stopPropagation();
                menu.classList.toggle("ativo");
                botao.classList.toggle("ativo");
            });

            menu.querySelectorAll(".dropdown-item").forEach(function (item) {
                item.addEventListener("click", function () {
                    fecharDropdowns();
                });
            });
        });

        document.addEventListener("click", fecharDropdowns);
    }

    function configurarCatalogo() {
        document.querySelectorAll("[data-categoria]").forEach(function (item) {
            item.addEventListener("click", function (evento) {
                evento.preventDefault();
                categoriaSelecionada = item.dataset.categoria;
                var rotulo = elemento("btn-categoria-label");
                if (rotulo) rotulo.textContent = item.textContent;
                paginaLivros = 1;
                buscarLivros();
            });
        });

        document.querySelectorAll("[data-disponibilidade]").forEach(function (item) {
            item.addEventListener("click", function (evento) {
                evento.preventDefault();
                disponibilidadeSelecionada = item.dataset.disponibilidade;
                var rotulo = elemento("btn-disponibilidade-label");
                if (rotulo) rotulo.textContent = item.textContent;
                paginaLivros = 1;
                buscarLivros();
            });
        });

        var busca = document.querySelector(".btn-buscar");
        if (busca) {
            busca.addEventListener("click", function () {
                paginaLivros = 1;
                buscarLivros();
            });
        }

        var campoBusca = elemento("input-busca");
        if (campoBusca) {
            campoBusca.addEventListener("input", function () {
                paginaLivros = 1;
                buscarLivros();
            });
        }

        var anterior = elemento("btn-anterior");
        if (anterior) {
            anterior.addEventListener("click", function () {
                if (paginaLivros > 1) {
                    paginaLivros -= 1;
                    buscarLivros();
                }
            });
        }

        var proxima = elemento("btn-proxima");
        if (proxima) {
            proxima.addEventListener("click", function () {
                paginaLivros += 1;
                buscarLivros();
            });
        }
    }

    function configurarUsuarios() {
        var busca = document.querySelector(".btn-buscar-usuarios");
        if (busca) {
            busca.addEventListener("click", function () {
                paginaUsuarios = 1;
                buscarUsuarios();
            });
        }

        var campo = elemento("input-pesquisa-usuarios");
        if (campo) {
            campo.addEventListener("input", function () {
                paginaUsuarios = 1;
                buscarUsuarios();
            });
        }

        var anterior = elemento("btn-anterior-usuarios");
        if (anterior) {
            anterior.addEventListener("click", function () {
                if (paginaUsuarios > 1) {
                    paginaUsuarios -= 1;
                    buscarUsuarios();
                }
            });
        }

        var proxima = elemento("btn-proxima-usuarios");
        if (proxima) {
            proxima.addEventListener("click", function () {
                paginaUsuarios += 1;
                buscarUsuarios();
            });
        }
    }

    /* -----------------------------------------------------
       Início
       ----------------------------------------------------- */

    document.addEventListener("DOMContentLoaded", async function () {
        sessaoAtual = await carregarSessao();
        if (!sessaoAtual) return;

        aplicarSessaoNaInterface();
        aplicarPermissoes();

        if (paginaBloqueada()) return;

        var formularioUsuario = elemento("formulario-cadastro-usuarios");
        var formularioLivro = elemento("formulario-cadastro-livro");
        var formularioEmprestimo = elemento("formulario-emprestar-livro");
        var formularioDevolucao = elemento("formulario-devolucao");

        if (formularioUsuario) formularioUsuario.addEventListener("submit", aoCadastrarUsuario);
        if (formularioLivro) formularioLivro.addEventListener("submit", aoCadastrarLivro);
        if (formularioEmprestimo) formularioEmprestimo.addEventListener("submit", aoEmprestar);
        if (formularioDevolucao) formularioDevolucao.addEventListener("submit", aoDevolver);

        configurarCatalogo();
        configurarUsuarios();
        configurarDropdowns();
        configurarModaisLivro();
        configurarModalUsuario();

        if (elemento("select-livro")) {
            mostrarAvisoEmprestimo();
            carregarOpcoesEmprestimo();
            carregarOpcoesUsuarioEmprestimo();
        }

        if (elemento("select-emprestimo")) {
            mostrarAvisoDevolucao();
            carregarOpcoesDevolucao();
        }

        if (elemento("corpo-tabela-emprestimos")) carregarDashboard();
        if (elemento("corpo-tabela-livros")) carregarLivros();
        if (elemento("corpo-tabela-usuarios")) carregarUsuarios();
        if (document.querySelector(".relatorio-secao")) carregarRelatorio();
    });
})();
