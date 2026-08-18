/* ═══════════════════════════════════════════════════════════════════════════
   FORMATO — tempo, datas e texto.

   Irmão do lib/formato.js do 5K9 Gestor, sem a parte de dinheiro: aqui a
   grandeza que importa é SEGUNDO, não centavo. A regra de fundo é a mesma —
   o dado circula cru (segundos inteiros, data ISO) e a formatação acontece
   só na hora de escrever na tela.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Tempo ───────────────────────────────────────────────────────────────
   Duração circula sempre como INTEIRO DE SEGUNDOS. Um Reel de 30s e um
   documentário de 40min cabem no mesmo número, e comparar "estimado x alvo"
   é uma subtração — não uma conversão de formato. */

/** 95 → "1m 35s" · 45 → "45s". O formato que aparece nos indicadores. */
export const duracao = (segundos) => {
    const s = Math.max(0, Math.round(Number(segundos) || 0));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const resto = s % 60;
    return resto ? `${m}m ${resto}s` : `${m}m`;
};

/** 95 → "01:35". Usado onde a leitura é de timecode, não de rótulo. */
export const relogio = (segundos) => {
    const s = Math.max(0, Math.round(Number(segundos) || 0));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Lê o campo de duração alvo e devolve segundos.
 *
 * Aceita "30", "30s", "1m30", "1:30" e "2 min". Um campo que só aceitasse
 * segundos obrigaria quem trabalha com YouTube a calcular 180 de cabeça
 * toda vez — e quem escreve "3min" num campo numérico não recebe erro
 * nenhum, recebe zero.
 */
export const paraSegundos = (texto) => {
    if (typeof texto === 'number') return Math.max(0, Math.round(texto));
    const t = String(texto || '').trim().toLowerCase();
    if (!t) return 0;

    const relogio = t.match(/^(\d+)\s*[:m]\s*(\d{1,2})\s*s?$/);
    if (relogio) return Number(relogio[1]) * 60 + Number(relogio[2]);

    const minutos = t.match(/^([\d.,]+)\s*m(in)?/);
    if (minutos) return Math.round(parseFloat(minutos[1].replace(',', '.')) * 60);

    const numero = parseFloat(t.replace(',', '.').replace(/[^\d.]/g, ''));
    return Number.isFinite(numero) ? Math.round(numero) : 0;
};

/** Percentual inteiro, protegido contra divisão por zero. */
export const pct = (parte, todo) => (todo ? Math.round((parte / todo) * 100) : 0);

// ── Datas ───────────────────────────────────────────────────────────────
/* Todas as datas do sistema são strings ISO, nunca Date solto.
   `new Date('2026-08-13')` é interpretado como UTC e, em fuso negativo,
   volta como 12/08 às 21h — um roteiro criado no dia 1º apareceria como do
   mês anterior. Comparar e fatiar texto não tem esse problema. */

/** Hoje em 'AAAA-MM-DD', no fuso local. */
export const hoje = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** '2026-08-13' → '13/08/2026' */
export const dataBR = (dataIso) => {
    const p = String(dataIso || '').slice(0, 10).split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : '—';
};

/**
 * "há 5 minutos", "ontem", "12/08/2026".
 *
 * A lista de roteiros ordena por última edição, e nela "há 5 minutos"
 * responde a pergunta real ("qual eu estava mexendo?") melhor que uma data
 * exata. Passada uma semana, a contagem relativa perde utilidade e a data
 * volta a ser mais informativa que "há 9 dias".
 */
export const quando = (isoCompleto) => {
    if (!isoCompleto) return '—';
    const t = new Date(isoCompleto).getTime();
    if (!Number.isFinite(t)) return '—';

    const minutos = Math.floor((Date.now() - t) / 60_000);
    if (minutos < 1)    return 'agora há pouco';
    if (minutos < 60)   return `há ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24)     return `há ${horas}h`;
    const dias = Math.floor(horas / 24);
    if (dias === 1)     return 'ontem';
    if (dias < 7)       return `há ${dias} dias`;
    return dataBR(isoCompleto);
};

// ── Texto ───────────────────────────────────────────────────────────────

/** Escapa texto vindo do usuário antes de entrar em template de HTML. */
export const esc = (texto) => String(texto ?? '').replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Tira a marcação de um trecho vindo de campo editável.
 *
 * As células de vídeo e áudio são contenteditable, então o que fica gravado
 * pode conter <br> e <div> criados pelo navegador. Toda leitura que precisa
 * do TEXTO (contagem de palavras, CSV, impressão) passa por aqui — e a
 * conversão de <br>/<div> em quebra de linha é essencial: sem ela, "PAULO"
 * e a fala dele viram uma linha só e a contagem de duração se perde.
 */
export const textoPuro = (html) => {
    const div = document.createElement('div');
    div.innerHTML = String(html ?? '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(div|p)>/gi, '\n');
    return (div.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
};

/** 'Abdução (Suspense)' → 'abducao-suspense'. Só para nome de arquivo. */
export const apelidoArquivo = (texto) =>
    String(texto || 'roteiro')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'roteiro';

/** Primeiras letras de até duas palavras: 'Abdução Suspense' → 'AS'. */
export const iniciais = (texto) =>
    String(texto || '?').trim().split(/\s+/).slice(0, 2)
        .map(p => p.charAt(0)).join('').toUpperCase() || '?';
