-- ═══════════════════════════════════════════════════════════════════════════
-- 5K9 DIONÍSIO — schema do banco.
--
-- Rode UMA VEZ no SQL Editor do projeto Supabase que JÁ HOSPEDA O 5K9 FORMS
-- (o mesmo que hospeda o 5K9 Chronos). Depois crie os acessos em
-- Authentication → Users → Add user, se a pessoa ainda não tiver um lá.
--
-- ── Por que dentro do projeto do Forms, e não um projeto novo ─────────────
-- O plano gratuito do Supabase limita quantos projetos a organização pode
-- ter, e o estúdio já divide a cota entre Forms/Chronos e Gestor. O Chronos
-- já fez essa escolha antes (ver o schema.sql dele) pelo mesmo motivo, e
-- pelo mesmo motivo elegeu o Forms e não o Gestor: o Forms já tem superfície
-- pública (o formulário que o cliente preenche), então dividir com ele não
-- muda a natureza do risco. O Gestor é dinheiro, sem nenhuma porta pública —
-- e não ganha uma só para economizar um projeto.
--
-- Dividir não tem contrapartida técnica: o Postgres não fica mais lento por
-- ter mais tabelas, e o RLS isola cada uma independentemente. Tem uma
-- contrapartida operacional, e é honesto dizer qual: um `pg_dump` de backup e
-- uma eventual restauração passam a levar Forms, Chronos e Dionísio juntos, e
-- os três dividem a mesma cota de linhas e armazenamento do plano.
--
-- ── O prefixo dn_ ──────────────────────────────────────────────────────────
-- Toda tabela, índice, função, gatilho e política daqui começa com `dn_`.
-- Não é enfeite: o Forms e o Gestor já têm tabela `clientes` — sem o
-- prefixo, `create table if not exists clientes` encontraria uma tabela de
-- OUTRO sistema com esse nome e simplesmente NÃO criaria a nossa, em
-- silêncio, sem erro nenhum. O app passaria a gravar roteiro na tabela de
-- cliente errada do sistema errado. `create or replace function` é pior
-- ainda: se colidisse com uma função existente, SOBRESCREVERIA ela. O
-- prefixo torna a colisão impossível em vez de improvável.
--
-- ── Duas decisões que valem explicação ────────────────────────────────────
--
-- 1. CENAS E TOMADAS EM JSONB, não em tabelas próprias.
--    A modelagem "certa" seria roteiros → cenas → tomadas, com chave
--    estrangeira e ordem numa coluna. Ela é melhor para CONSULTAR pedaços
--    ("todas as tomadas com plano zenital") — e é exatamente essa consulta
--    que este sistema nunca faz.
--
--    O que ele faz é abrir um roteiro INTEIRO, editar, e gravar o inteiro de
--    volta. Com três tabelas, cada arrasto de tomada viraria uma transação
--    reordenando dezenas de linhas, e a gravação com atraso do editor teria
--    que virar um diff. Com jsonb, é um UPDATE de uma linha só.
--
--    O preço, assumido: não há integridade referencial dentro do roteiro. Uma
--    tomada órfã não é impossível — é impedida pelo código (lib/roteiro.js),
--    não pelo banco. Aceitável porque nada fora do roteiro aponta para uma
--    tomada.
--
-- 2. DURAÇÃO NÃO É GRAVADA. `duracao_alvo` é uma decisão e fica no banco; a
--    duração ESTIMADA é consequência do texto e é calculada na hora (ver
--    lib/duracao.js). Guardar consequência é criar um segundo lugar onde a
--    verdade pode divergir.
--
-- 3. TUDO EXIGE SESSÃO. Não existe leitura pública: nenhuma tela deste
--    sistema é vista por gente de fora. Roteiro não aprovado é rascunho, e
--    rascunho não se publica por acidente.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- Ids como TEXT, não uuid: o app sempre manda um id (gera uuid no cliente).
-- O default aqui é cinto de segurança.

-- ── Clientes ──────────────────────────────────────────────────────────────
-- Quem esta peça é para. Cadastro deliberadamente magro: nome, empresa e cor
-- bastam para identificar e agrupar — não há aqui documento, contato ou
-- financeiro nenhum, porque isso já mora no 5K9 Gestor e este sistema só
-- COPIA o essencial de lá (ver lib/gestor.js e a função `cartela()` do
-- repositório do Gestor). Um cliente pode não ter roteiro nenhum ainda; um
-- roteiro pode não ter cliente — peça institucional, teste, exercício.
create table if not exists dn_clientes (
    id         text primary key default gen_random_uuid()::text,
    nome       text not null,
    empresa    text,
    cor        text,
    nota       text,
    criado_em  timestamptz not null default now()
);

create index if not exists dn_clientes_nome_idx on dn_clientes(nome);

create table if not exists dn_roteiros (
    id            text primary key default gen_random_uuid()::text,
    titulo        text not null default 'Roteiro sem título',

    -- on delete set null: excluir um cliente NÃO pode apagar o roteiro dele.
    -- O texto foi escrito de verdade; o roteiro passa a aparecer como "sem
    -- cliente", que é feio e recuperável — o certo nessa ordem (mesma regra
    -- do 5K9 Gestor para `entradas.cliente_id`).
    cliente_id    text references dn_clientes(id) on delete set null,

    -- reel | youtube | comercial | documentario | livre  (ver lib/roteiro.js)
    formato       text not null default 'reel',

    -- Alvo de duração em SEGUNDOS inteiros. Segundo é a unidade que serve
    -- tanto ao Reel de 30 quanto ao documentário de 40 minutos, e comparar
    -- estimado com alvo vira uma subtração.
    duracao_alvo  int  not null default 30,

    conceito      text not null default '',
    tom           text not null default '',

    -- Lista de nomes em caixa alta. jsonb e não text[]: o registro inteiro
    -- vai e volta como JSON, e um array nativo obrigaria a converter os dois
    -- lados de um campo que nunca é consultado isoladamente.
    personagens   jsonb not null default '[]'::jsonb,

    -- { apresentacao, confronto, resolucao } — texto puro, vindo de textarea.
    atos          jsonb not null default
                  '{"apresentacao":"","confronto":"","resolucao":""}'::jsonb,

    -- [{ id, titulo, tomadas: [{ id, indice, video, audio }] }]
    -- video e audio são HTML simples (vêm de contenteditable).
    cenas         jsonb not null default '[]'::jsonb,

    -- Marca de origem: 'autoscript' (arquivo do sistema antigo) ou 'chronos'
    -- (trazido de lá pela ponte, ver lib/chronos.js e pages/importar-chronos.js).
    -- Nulo no caso normal; existe para a lista poder sinalizar "confira se
    -- chegou inteiro" uma vez, sem virar um campo que alguém precisa manter.
    importado_de  text,

    criado_em     timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);

-- A lista de roteiros ordena por última edição, sempre.
create index if not exists dn_roteiros_atualizado_idx on dn_roteiros(atualizado_em desc);
create index if not exists dn_roteiros_cliente_idx    on dn_roteiros(cliente_id);

-- ── atualizado_em carimbado pelo BANCO ───────────────────────────────────
-- O adaptador local carimba no cliente porque não tem alternativa. Aqui o
-- relógio do banco é o único confiável: dois navegadores com horários
-- diferentes fariam a ordenação por última edição mentir, e o mais atrasado
-- ganharia da edição mais nova.
--
-- Nome da função também prefixado: `create or replace function` SOBRESCREVE
-- sem perguntar se já existisse uma `roteiros_carimbar` de outro sistema
-- neste projeto — é o mesmo risco de colisão das tabelas, só que mais grave,
-- porque aqui não há "if not exists" nenhum para servir de rede de segurança.
create or replace function dn_roteiros_carimbar()
returns trigger language plpgsql as $$
begin
    new.atualizado_em = now();
    return new;
end;
$$;

drop trigger if exists dn_roteiros_carimbar_trg on dn_roteiros;
create trigger dn_roteiros_carimbar_trg
    before insert or update on dn_roteiros
    for each row execute function dn_roteiros_carimbar();

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS — nenhum roteiro, nenhum cliente, sai daqui sem sessão.
--
-- "Somente autenticado" aqui significa qualquer usuário do projeto — os
-- mesmos logins do Forms e do Chronos, já que agora é o mesmo projeto. É o
-- comportamento desejado: é a mesma equipe. Se um dia for preciso separar
-- quem vê o quê, o lugar é aqui, trocando `using (true)` por uma checagem de
-- papel (mesma nota que o schema do Chronos já registra).
-- ═══════════════════════════════════════════════════════════════════════════
alter table dn_roteiros enable row level security;
alter table dn_clientes enable row level security;

create policy "dn_roteiros: somente autenticado" on dn_roteiros
    for all to authenticated using (true) with check (true);
create policy "dn_clientes: somente autenticado" on dn_clientes
    for all to authenticated using (true) with check (true);
