/* ═══════════════════════════════════════════════════════════════════════════
   PONTE COM O 5K9 CHRONOS — trazer temas e roteiros.

   Diferente da ponte com o Gestor (lib/gestor.js), esta EXIGE LOGIN. A
   diferença não é técnica, é do que está em jogo: a cartela do Gestor expõe
   nome e cor de cliente — dado que já aparece em portfólio. Aqui mora texto
   estratégico do cliente, às vezes ainda rascunho, e abrir isso para
   qualquer um com a chave pública do Chronos seria expor o cronograma
   inteiro do estúdio a quem nunca devia ver.

   ── COMO O LOGIN FUNCIONA SEM TOCAR NO CHRONOS ────────────────────────────
   O Chronos roda no MESMO projeto Supabase do 5K9 Forms (ver o schema.sql
   dele: "Rode UMA VEZ no SQL Editor do projeto Supabase que JÁ HOSPEDA O 5K9
   FORMS"). A política de segurança de lá já libera leitura de
   `vz_clientes`/`vz_conteudos`/`vz_blocos` para QUALQUER usuário autenticado
   daquele projeto — é a mesma equipe, os mesmos logins do Forms e do
   Chronos. Não foi preciso criar função nova nem mexer no outro repositório:
   esta ponte pede e-mail e senha, autentica DIRETO contra o projeto deles, e
   a partir daí lê as tabelas como qualquer pessoa da equipe leria.

   ── SESSÃO PRÓPRIA, SEPARADA DA DO SISTEMA ────────────────────────────────
   Um segundo cliente Supabase, com `storageKey` próprio. Sem isso, se um dia
   o Dionísio for configurado no MESMO projeto do Chronos (não é o caso hoje,
   mas nada impede no futuro), dois `createClient()` do mesmo projeto
   disputariam a mesma entrada do localStorage e um dos dois seria derrubado
   em silêncio. `persistSession: true` aqui é proposital, ao contrário da
   ponte do Gestor: pedir login toda vez que alguém for importar um roteiro
   seria fricção sem propósito — a sessão fica salva até a pessoa sair.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Mesmo projeto do 5K9 Forms — não é erro de copiar e colar. Ver a nota
   acima. */
export const CHRONOS_URL  = 'https://dppgtlclpgdvxhnnulgf.supabase.co';
export const CHRONOS_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwcGd0bGNscGdkdnhobm51bGdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyMzcyNjUsImV4cCI6MjEwMTgxMzI2NX0.31Z-UOk4RUYBz4WtqNYmktiocgBIryTe6bChj9DHZiA';

export const PONTE_LIGADA = !!(CHRONOS_URL && CHRONOS_ANON);

let sb = null;

const cliente = async () => {
    if (sb) return sb;
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    sb = createClient(CHRONOS_URL, CHRONOS_ANON, {
        auth: { storageKey: 'sb-ponte-chronos-auth' },
    });
    return sb;
};

/** Sessão atual da ponte, ou null se ninguém entrou ainda. */
export const sessaoChronos = async () => {
    const s = await cliente();
    const { data: { session } } = await s.auth.getSession();
    return session?.user ? { email: session.user.email } : null;
};

export const entrarChronos = async (email, senha) => {
    const s = await cliente();
    const { error } = await s.auth.signInWithPassword({ email, password: senha });
    return { error };
};

export const sairChronos = async () => {
    const s = await cliente();
    await s.auth.signOut();
};

/**
 * Os clientes do Chronos, para escolher de quem trazer conteúdo.
 * Só o essencial para exibir e para copiar o cadastro (ver pages/cadastros.js
 * se a pessoa ainda não tiver esse cliente aqui): nome, empresa, cor.
 */
export const lerClientesChronos = async () => {
    const s = await cliente();
    const { data, error } = await s.from('vz_clientes')
        .select('id, nome, empresa, cor, ativo')
        .order('nome');
    if (error) throw erroLegivel(error);
    return data || [];
};

/**
 * Temas e roteiros de UM cliente do Chronos, cada um com os blocos do
 * roteiro já embutidos (ordenados). Traz TODOS os status, rascunho incluso —
 * ao contrário do link público do cliente, que esconde rascunho, aqui é a
 * própria equipe escolhendo o que puxar para produção, e um tema ainda em
 * rascunho pode ser exatamente o que alguém quer decupar cedo.
 */
export const lerConteudosChronos = async (clienteId) => {
    const s = await cliente();

    const { data: conteudos, error: e1 } = await s.from('vz_conteudos')
        .select('*').eq('cliente_id', clienteId).order('data', { ascending: false });
    if (e1) throw erroLegivel(e1);
    if (!conteudos?.length) return [];

    // Uma segunda ida, e não uma por conteúdo: um cliente com vinte temas não
    // deveria custar vinte requisições para trazer os blocos de cada um.
    const { data: blocos, error: e2 } = await s.from('vz_blocos')
        .select('*').in('conteudo_id', conteudos.map(c => c.id)).order('ordem');
    if (e2) throw erroLegivel(e2);

    return conteudos.map(c => ({
        ...c,
        blocos: (blocos || []).filter(b => b.conteudo_id === c.id),
    }));
};

const erroLegivel = (error) => {
    console.error('[chronos] falha na ponte:', error);
    if (error.code === '42501' || /permission denied|row-level security/i.test(error.message || '')) {
        return new Error('Sessão expirada ou sem permissão. Saia e entre de novo.');
    }
    return new Error('Não consegui falar com o Chronos agora. Verifique a conexão.');
};
