import { esc, textoPuro, duracao, apelidoArquivo, dataBR, hoje } from './formato.js';
import { duracaoEstimada, contarTomadas } from './duracao.js';
import { rotuloFormato } from './roteiro.js';

/* ═══════════════════════════════════════════════════════════════════════════
   SAÍDAS — o roteiro fora do sistema.

   Três destinos, três formatos, e a razão de cada um:

     · PDF (impressão) — o que vai para o set e para o cliente. É a saída que
       importa; as outras duas existem para casos específicos.
     · CSV — para quem vai continuar o trabalho numa planilha (mapa de
       decupagem, cronograma de diária, orçamento por tomada).
     · JSON — cópia de segurança e transporte entre navegadores. É o único
       formato que volta para dentro do sistema sem perda.

   ── Por que impressão do navegador, e não uma biblioteca de PDF ──────────
   Uma biblioteca de PDF significa carregar centenas de kB, reimplementar
   quebra de página e descobrir, em cada roteiro novo, mais um lugar onde a
   linha corta no meio da palavra. O navegador já sabe paginar HTML, já
   respeita `break-inside: avoid` e já oferece a caixa de diálogo que a pessoa
   conhece — com escolha de papel, margens e "salvar como PDF". A folha em
   pages/impressao.css é onde essa saída é desenhada.
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Download ─────────────────────────────────────────────────────────────
const baixar = (conteudo, nome, tipo) => {
    const blob = new Blob([conteudo], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.click();
    // Sem o revoke o blob fica preso na memória da aba até recarregar.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ── JSON ─────────────────────────────────────────────────────────────────
export const exportarJSON = (roteiro) => {
    baixar(JSON.stringify(roteiro, null, 2),
        `dionisio-${apelidoArquivo(roteiro.titulo)}.json`,
        'application/json');
};

// ── CSV ──────────────────────────────────────────────────────────────────
/* Separador PONTO E VÍRGULA e BOM no início.
   O Excel em português lê vírgula como separador decimal e, num arquivo
   separado por vírgula, junta tudo numa coluna só. O BOM é o que faz ele
   reconhecer UTF-8 — sem ele, "Abdução" abre como "AbduÃ§Ã£o". Os dois
   detalhes juntos são a diferença entre um arquivo que abre e um arquivo que
   a pessoa manda de volta dizendo que veio quebrado. */
const celula = (texto) => `"${String(texto ?? '').replace(/"/g, '""')}"`;

export const exportarCSV = (roteiro) => {
    const linhas = [
        ['Roteiro', roteiro.titulo],
        ['Formato', rotuloFormato(roteiro.formato)],
        ['Duração alvo', duracao(roteiro.duracao_alvo)],
        ['Duração estimada', duracao(duracaoEstimada(roteiro))],
        ['Exportado em', dataBR(hoje())],
        [],
        ['Cena / Tomada', 'Vídeo (imagem, enquadramento, ação)', 'Áudio (voz, trilha, efeitos)'],
    ];

    (roteiro.cenas || []).forEach((cena, i) => {
        // A cena vira uma linha própria, com as colunas de conteúdo vazias:
        // na planilha ela funciona como cabeçalho de bloco.
        linhas.push([`CENA ${String(i + 1).padStart(2, '0')} — ${cena.titulo}`, '', '']);
        (cena.tomadas || []).forEach(t => {
            linhas.push([t.indice, textoPuro(t.video), textoPuro(t.audio)]);
        });
    });

    // O BOM escrito como escape, e não como o caractere literal: o BOM é
    // invisível no editor e some no primeiro copiar-e-colar do arquivo — a
    // planilha volta a abrir "AbduÃ§Ã£o" e ninguém enxerga a causa no código.
    const csv = '\uFEFF' + linhas.map(l => l.map(celula).join(';')).join('\r\n');
    baixar(csv, `dionisio-${apelidoArquivo(roteiro.titulo)}.csv`, 'text/csv;charset=utf-8;');
};

// ── Impressão ────────────────────────────────────────────────────────────

/* Texto de campo livre indo para o HTML da impressão: escapa e devolve as
   quebras de linha como <br>. Sem isso, três parágrafos de um ato saem como
   um bloco só de texto corrido. */
const paragrafos = (texto) =>
    esc(texto || '').split(/\n{2,}/).filter(Boolean)
        .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('') || '<p class="im-vazio">—</p>';

/* Vídeo e áudio já são HTML de contenteditable. Passam por textoPuro() e
   voltam escapados: o que o navegador gravou lá dentro pode conter marcação
   que não deveria atravessar para a folha impressa. */
const celulaImpressa = (html) =>
    esc(textoPuro(html)).replace(/\n/g, '<br>') || '<span class="im-vazio">—</span>';

const cabecalho = (roteiro, subtitulo) => `
    <header class="im-cabeca">
        <h1>${esc(roteiro.titulo)}</h1>
        <p class="im-subtitulo">${esc(subtitulo)}</p>
        <dl class="im-meta">
            <div><dt>Formato</dt><dd>${esc(rotuloFormato(roteiro.formato))}</dd></div>
            <div><dt>Duração alvo</dt><dd>${duracao(roteiro.duracao_alvo)}</dd></div>
            <div><dt>Duração estimada</dt><dd>${duracao(duracaoEstimada(roteiro))}</dd></div>
            <div><dt>Tomadas</dt><dd>${contarTomadas(roteiro)}</dd></div>
            <div><dt>Data</dt><dd>${dataBR(hoje())}</dd></div>
        </dl>
    </header>`;

/** A metade narrativa: conceito, tom, personagens e os três atos. */
const folhaNarrativa = (roteiro) => `
    ${cabecalho(roteiro, 'Roteiro narrativo — estrutura em três atos')}

    <section class="im-bloco">
        <h2>Sinopse / conceito</h2>
        ${paragrafos(roteiro.conceito)}
    </section>

    <section class="im-bloco">
        <h2>Tom e estilo visual</h2>
        ${paragrafos(roteiro.tom)}
    </section>

    <section class="im-bloco">
        <h2>Personagens</h2>
        <p>${(roteiro.personagens || []).length
              ? esc((roteiro.personagens || []).join(' · '))
              : '<span class="im-vazio">Nenhum personagem cadastrado.</span>'}</p>
    </section>

    <section class="im-bloco">
        <h2>Ato I — Apresentação</h2>
        ${paragrafos(roteiro.atos?.apresentacao)}
    </section>

    <section class="im-bloco">
        <h2>Ato II — Confronto</h2>
        ${paragrafos(roteiro.atos?.confronto)}
    </section>

    <section class="im-bloco">
        <h2>Ato III — Resolução</h2>
        ${paragrafos(roteiro.atos?.resolucao)}
    </section>`;

/** A metade técnica: a tabela de duas colunas, cena por cena. */
const folhaTecnica = (roteiro) => `
    ${cabecalho(roteiro, 'Script técnico — vídeo e áudio')}

    <table class="im-tabela">
        <thead>
            <tr>
                <th class="im-col-indice">Tom.</th>
                <th class="im-col-video">Vídeo</th>
                <th class="im-col-audio">Áudio</th>
            </tr>
        </thead>
        <tbody>
            ${(roteiro.cenas || []).map((cena, i) => `
                <tr class="im-cena">
                    <th colspan="3">Cena ${String(i + 1).padStart(2, '0')} — ${esc(cena.titulo)}</th>
                </tr>
                ${(cena.tomadas || []).map(t => `
                    <tr>
                        <td class="im-col-indice">${esc(t.indice)}</td>
                        <td class="im-col-video">${celulaImpressa(t.video)}</td>
                        <td class="im-col-audio">${celulaImpressa(t.audio)}</td>
                    </tr>`).join('')}
            `).join('')}
        </tbody>
    </table>`;

/**
 * Monta a folha e abre a caixa de impressão do navegador.
 *
 * @param {object} roteiro
 * @param {'narrativa'|'tecnica'|'completo'} parte  o que imprimir
 *
 * O conteúdo é montado num contêiner separado (#impressao) em vez de a folha
 * de estilo esconder pedaços da interface. A tentativa anterior — imprimir a
 * própria tela com `display:none` no que não vai — obriga a folha a conhecer
 * cada detalhe da interface e a ser corrigida toda vez que a interface muda.
 * Aqui a folha impressa tem o HTML que ela precisa e nada mais.
 */
export const imprimir = (roteiro, parte = 'completo') => {
    const area = document.getElementById('impressao');
    if (!area) return;

    area.innerHTML = `
        <div class="im-folha">
            ${parte !== 'tecnica'   ? folhaNarrativa(roteiro) : ''}
            ${parte === 'completo'  ? '<div class="im-quebra"></div>' : ''}
            ${parte !== 'narrativa' ? folhaTecnica(roteiro) : ''}
        </div>`;

    /* O título do documento vira o nome sugerido do arquivo em "salvar como
       PDF" na maioria dos navegadores. Sem isto, todo roteiro sai chamado
       "5K9 Dionísio". Restaurado depois. */
    const tituloOriginal = document.title;
    document.title = roteiro.titulo || tituloOriginal;

    const limpar = () => {
        document.title = tituloOriginal;
        area.innerHTML = '';
    };

    /* afterprint cobre o caso normal (imprimiu ou cancelou). O timeout é a
       rede de segurança para navegadores que não disparam o evento — sem
       ele, o título ficaria trocado e o HTML pesado ficaria pendurado na
       árvore para sempre. */
    window.addEventListener('afterprint', limpar, { once: true });
    setTimeout(limpar, 60_000);

    window.print();
};
