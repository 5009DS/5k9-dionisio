-- ═══════════════════════════════════════════════════════════════════════════
-- 5K9 DIONÍSIO — schema do banco.
--
-- Rode UMA VEZ no SQL Editor de um projeto Supabase NOVO, separado dos que
-- hospedam o 5K9 Forms e o 5K9 Gestor. Depois crie os acessos em
-- Authentication → Users → Add user (um por pessoa do time).
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
create table if not exists clientes (
    id         text primary key default gen_random_uuid()::text,
    nome       text not null,
    empresa    text,
    cor        text,
    nota       text,
    criado_em  timestamptz not null default now()
);

create index if not exists clientes_nome_idx on clientes(nome);

create table if not exists roteiros (
    id            text primary key default gen_random_uuid()::text,
    titulo        text not null default 'Roteiro sem título',

    -- on delete set null: excluir um cliente NÃO pode apagar o roteiro dele.
    -- O texto foi escrito de verdade; o roteiro passa a aparecer como "sem
    -- cliente", que é feio e recuperável — o certo nessa ordem (mesma regra
    -- do 5K9 Gestor para `entradas.cliente_id`).
    cliente_id    text references clientes(id) on delete set null,

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
create index if not exists roteiros_atualizado_idx on roteiros(atualizado_em desc);
create index if not exists roteiros_cliente_idx    on roteiros(cliente_id);

-- ── atualizado_em carimbado pelo BANCO ───────────────────────────────────
-- O adaptador local carimba no cliente porque não tem alternativa. Aqui o
-- relógio do banco é o único confiável: dois navegadores com horários
-- diferentes fariam a ordenação por última edição mentir, e o mais atrasado
-- ganharia da edição mais nova.
create or replace function roteiros_carimbar()
returns trigger language plpgsql as $$
begin
    new.atualizado_em = now();
    return new;
end;
$$;

drop trigger if exists roteiros_carimbar_trg on roteiros;
create trigger roteiros_carimbar_trg
    before insert or update on roteiros
    for each row execute function roteiros_carimbar();

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS — nenhum roteiro, nenhum cliente, sai daqui sem sessão.
-- ═══════════════════════════════════════════════════════════════════════════
alter table roteiros  enable row level security;
alter table clientes  enable row level security;

create policy "roteiros: somente autenticado" on roteiros
    for all to authenticated using (true) with check (true);
create policy "clientes: somente autenticado" on clientes
    for all to authenticated using (true) with check (true);
