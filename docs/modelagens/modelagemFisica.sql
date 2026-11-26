CREATE DATABASE BIBLIOTECA_BD;
USE BIBLIOTECA_BD;

CREATE TABLE categorias (
    id_categoria INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE livros (
    id_livro INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    autor VARCHAR(150) NOT NULL,
    isbn VARCHAR(20) UNIQUE,
    editora VARCHAR(150),
    ano_publicacao YEAR,
    sinopse TEXT,
    id_categoria_fk INT NOT NULL,
    ativo TINYINT(1) DEFAULT 1,

    FOREIGN KEY (id_categoria_fk)
        REFERENCES categorias(id_categoria)
        ON DELETE RESTRICT
);

CREATE TABLE acervo (
    id_acervo INT AUTO_INCREMENT PRIMARY KEY,
    id_livro INT NOT NULL,
    localizacao VARCHAR(100),
    status ENUM(
        'Disponivel',
        'Emprestado',
        'Indisponivel'
    ) DEFAULT 'Disponivel',

    FOREIGN KEY (id_livro)
        REFERENCES livros(id_livro)
        ON DELETE RESTRICT
);

CREATE TABLE usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    papel ENUM('Usuario', 'Dev')
        DEFAULT 'Usuario'
);

CREATE TABLE emprestimos (
    id_emprestimo INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_acervo INT NOT NULL,
    data_emprestimo DATE NOT NULL,
    data_devolucao_esperada DATE NOT NULL,
    data_devolucao_real DATE,
    status ENUM('Ativo', 'Devolvido')
        DEFAULT 'Ativo',

    FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
        ON DELETE RESTRICT,

    FOREIGN KEY (id_acervo)
        REFERENCES acervo(id_acervo)
        ON DELETE RESTRICT,

    CHECK (
        data_devolucao_esperada >= data_emprestimo
    )
);

CREATE INDEX idx_acervo_livro_status
ON acervo(id_livro, status);

CREATE INDEX idx_emprestimos_usuario
ON emprestimos(id_usuario);

CREATE INDEX idx_emprestimos_acervo_status
ON emprestimos(id_acervo, status);