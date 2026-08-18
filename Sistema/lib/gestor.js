/* ═══════════════════════════════════════════════════════════════════════════
   PONTE COM O 5K9 GESTOR — a cartela do estúdio.

   Idêntica à ponte que o 5K9 Chronos já usa para a mesma coisa
   (Sistema/lib/gestor.js daquele repositório) — mesmas credenciais, mesma
   função, mesmo raciocínio. Copiada em vez de importada porque os três
   sistemas são deploys independentes: não existe import entre repositórios.

   O Gestor é onde um cliente novo é cadastrado primeiro: ele entra no dia em
   que assina, porque é aí que começa a haver dinheiro. Sem esta ponte, o
   mesmo cliente seria digitado de novo aqui — e nome digitado duas vezes vira
   "Instituto Dr Tigre" num sistema e "Instituto Dr. Tigre" no outro.

   ── O QUE VEM ──────────────────────────────────────────────────────────
   Nome, empresa e cor dos clientes. Nada de documento, contato, nota ou
   qualquer valor — a função do lado de lá (db/migracao-cartela.sql, no
   repositório do Gestor) devolve só isso, e é ela que decide, não este
   arquivo. Os integrantes do Gestor não vêm: o Dionísio não tem campo de
   "responsável" nem repasse — não há uso para eles aqui.

   ── O QUE ESTA PONTE NÃO FAZ ───────────────────────────────────────────
   Não sincroniza: copia, quando alguém manda copiar (ver pages/cadastros.js).
   Um cliente renomeado no Gestor continua com o nome antigo aqui até alguém
   trazer de novo — deliberado, e consistente com o mesmo comportamento no
   Chronos.
   ═══════════════════════════════════════════════════════════════════════════ */

/* As credenciais do projeto do GESTOR, não as deste sistema — as mesmas que
   estão em Sistema/lib/supabase-config.js do repositório do 5K9 Gestor. A
   chave `anon` é pública por natureza e não protege nada sozinha; quem
   protege é o RLS de lá, mais o recorte da função `cartela()`. */
export const GESTOR_URL  = 'https://vwgxrufjlalqshixalmo.supabase.co';
export const GESTOR_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3Z3hydWZqbGFscXNoaXhhbG1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NTE5NjIsImV4cCI6MjEwMjIyNzk2Mn0.6QfO8DLYsF6hiKpqSfeZclz2oi4WoT8cTWPKHWkhXAM';

export const PONTE_LIGADA = !!(GESTOR_URL && GESTOR_ANON);

let sb = null;

const cliente = async () => {
    if (sb) return sb;
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    /* persistSession: false — esta ponte só lê uma função pública e nunca faz
       login. Sem isso a biblioteca instala um segundo GoTrueClient no mesmo
       navegador, e dois deles disputando o localStorage derrubam a sessão do
       sistema principal em silêncio. */
    sb = createClient(GESTOR_URL, GESTOR_ANON, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    return sb;
};

/**
 * A cartela do Gestor.
 * @returns {Promise<{clientes: object[]}>}
 * @throws  quando a ponte está desligada, a rede falha ou a função ainda não
 *          foi criada no banco do Gestor — as três com mensagem própria.
 */
export const lerCartela = async () => {
    if (!PONTE_LIGADA) {
        throw new Error('A ponte com o Gestor está desligada. Preencha GESTOR_URL e '
                      + 'GESTOR_ANON em Sistema/lib/gestor.js.');
    }

    const s = await cliente();
    const { data, error } = await s.rpc('cartela');

    if (error) {
        console.error('[gestor] falha ao ler a cartela:', error);
        /* "função não existe" chega com dois códigos: 42883 é o do Postgres,
           PGRST202 é o do PostgREST quando a função não está no cache de
           schema dele. É o erro esperado se a migração de lá ainda não tiver
           rodado — o que não deveria acontecer aqui, já que o Chronos já
           depende da mesma função, mas a mensagem vale a pena de qualquer
           forma. */
        if (error.code === '42883' || error.code === 'PGRST202'
            || /function .*cartela/i.test(error.message || '')) {
            throw new Error('O Gestor ainda não tem a função de cartela. Rode '
                          + 'Sistema/db/migracao-cartela.sql no SQL Editor do projeto dele.');
        }
        throw new Error('Não consegui falar com o Gestor agora. Verifique a conexão.');
    }

    return { clientes: data?.clientes || [] };
};

/* Nome como chave de comparação entre bancos diferentes. Sem acento, sem
   pontuação, sem espaço: "Instituto Dr. Tigre" e "Instituto Dr Tigre" são o
   mesmo cliente, e é justamente essa divergência que a ponte existe para
   evitar. Mesma função em pages/cadastros.js e no lado do Chronos — trocar
   aqui sem trocar lá reabriria o problema que ela resolve. */
export const chaveNome = (nome) =>
    String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]/g, '');
