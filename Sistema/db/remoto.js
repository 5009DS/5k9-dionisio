/* ═══════════════════════════════════════════════════════════════════════════
   ADAPTADOR REMOTO — Supabase.

   Espelha a interface do adaptador local. A biblioteca é importada de forma
   PREGUIÇOSA (import dinâmico dentro de cliente()): em modo local o arquivo
   até é carregado pelo store, mas nada deve ir buscar 100kB de CDN para um
   banco que não existe.

   ── POR QUE EXISTE UMA TRADUÇÃO DE NOME AQUI ──────────────────────────────
   O resto do sistema conhece as coleções como `roteiros` e `clientes` — é o
   nome que store.js expõe e que toda página usa. No banco, porém, elas se
   chamam `dn_roteiros` e `dn_clientes`: o projeto Supabase é COMPARTILHADO
   com o Forms e o Chronos (ver db/schema.sql), e sem o prefixo `dn_` a
   tabela colidiria com uma já existente de outro sistema.

   A tradução mora só AQUI, e não em store.js nem nas páginas, para o resto
   do código continuar sem saber — nem precisar saber — que existe um projeto
   compartilhado por trás. Se um dia o Dionísio ganhar projeto próprio, este
   é o único arquivo a mudar: apagar o mapa, chamar `.from(colecao)` direto.
   ═══════════════════════════════════════════════════════════════════════════ */

import { SUPABASE_URL, SUPABASE_ANON } from '../lib/supabase-config.js';

const TABELA = {
    roteiros: 'dn_roteiros',
    clientes: 'dn_clientes',
};
const nomeFisico = (colecao) => TABELA[colecao] || colecao;

let sb = null;

/* Uma instância só, para sempre. Dois createClient() no mesmo navegador
   geram dois GoTrueClient disputando a mesma sessão salva — o segundo
   derruba o primeiro em silêncio e a pessoa é deslogada do nada. */
const cliente = async () => {
    if (sb) return sb;
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    sb = createClient(SUPABASE_URL, SUPABASE_ANON);
    return sb;
};

const falhar = (contexto, error) => {
    console.error(`[db] ${contexto}:`, error);
    throw error;
};

export const remoto = {
    modo: 'remoto',

    sessao: async () => {
        const s = await cliente();
        const { data: { session } } = await s.auth.getSession();
        return session?.user
            ? { id: session.user.id, email: session.user.email,
                nome: session.user.user_metadata?.nome
                      || (session.user.email || '').split('@')[0] }
            : null;
    },

    entrar: async (email, senha) => {
        const s = await cliente();
        return s.auth.signInWithPassword({ email, password: senha });
    },

    sair: async () => {
        const s = await cliente();
        return s.auth.signOut();
    },

    aoMudarSessao: async (fn) => {
        const s = await cliente();
        s.auth.onAuthStateChange(() => fn());
    },

    listar: async (colecao) => {
        const s = await cliente();
        const { data, error } = await s.from(nomeFisico(colecao)).select('*')
            .order('criado_em', { ascending: false });
        if (error) falhar(`listar(${colecao})`, error);
        return data || [];
    },

    salvar: async (colecao, registro) => {
        const s = await cliente();
        const linha = { ...registro, id: registro.id || crypto.randomUUID() };
        // criado_em fora do upsert quando já existe: o banco tem default
        // now(), e reenviar a data em toda edição reescreveria o histórico.
        const { data, error } = await s.from(nomeFisico(colecao)).upsert(linha).select().maybeSingle();
        if (error) falhar(`salvar(${colecao})`, error);
        return data;
    },

    excluir: async (colecao, id) => {
        const s = await cliente();
        const { error } = await s.from(nomeFisico(colecao)).delete().eq('id', id);
        if (error) falhar(`excluir(${colecao})`, error);
    },

    substituir: async (colecao, linhas) => {
        const s = await cliente();
        const { error } = await s.from(nomeFisico(colecao)).upsert(linhas);
        if (error) falhar(`substituir(${colecao})`, error);
        return linhas;
    },
};
