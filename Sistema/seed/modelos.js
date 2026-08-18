/* ═══════════════════════════════════════════════════════════════════════════
   MODELOS — os pontos de partida oferecidos ao criar um roteiro.

   Equivalente ao seed/exemplo.js do 5K9 Gestor, com uma diferença de
   propósito: lá os exemplos POVOAM o sistema para conhecê-lo e depois são
   removidos; aqui um modelo é COPIADO para dentro do roteiro novo e passa a
   ser dele. Não existe vínculo depois da cópia — editar um roteiro criado a
   partir de "Abdução" não muda o modelo, e mudar o modelo não alcança
   roteiro nenhum já criado.

   Por que copiar em vez de referenciar: um modelo é um andaime. Ele existe
   para a página não nascer em branco, e ninguém deveria descobrir seis meses
   depois que mexer no andaime reescreve o prédio.

   Os textos vieram do AutoScript original, e ficam aqui em português com os
   nomes de campo deste sistema (ver lib/roteiro.js).
   ═══════════════════════════════════════════════════════════════════════════ */

export const MODELOS = [
    {
        id: 'branco',
        nome: 'Em branco',
        descricao: 'Uma cena, uma tomada, nada escrito. Para quem já sabe o que vai fazer.',
        icone: 'file',
        roteiro: {
            formato: 'reel',
            duracao_alvo: 30,
            conceito: '',
            tom: '',
            personagens: ['NARRADOR'],
            atos: { apresentacao: '', confronto: '', resolucao: '' },
            cenas: [{
                titulo: 'INT. LOCAÇÃO - DIA',
                tomadas: [{ video: '', audio: '' }],
            }],
        },
    },

    {
        id: 'abducao',
        nome: 'Reel: suspense',
        descricao: 'Trinta segundos de tensão em duas cenas — o exemplo técnico completo, com marcação de trilha e efeito.',
        icone: 'moon-star',
        roteiro: {
            formato: 'reel',
            duracao_alvo: 30,
            conceito: 'Um jovem acorda no meio da noite com barulhos e luzes estranhas em seu quarto, culminando em um evento inexplicável.',
            tom: 'Tenso, cinematográfico, cortes rápidos, iluminação contrastante com tons de azul e sombra.',
            personagens: ['PAULO', 'JOÃO'],
            atos: {
                apresentacao: 'Paulo acorda assustado em seu quarto no meio da noite por conta de um despertador tocando. Ele percebe que recebeu uma mensagem de seu amigo João alertando sobre algo estranho.',
                confronto: 'Paulo atende a ligação de João, mas ouve apenas estática sônica e ruídos metálicos. De repente, os objetos no quarto perdem a gravidade e começam a flutuar.',
                resolucao: 'Uma luz azul neon intensa entra pela janela. Paulo é erguido no ar em direção ao feixe de luz. A tela apaga com o barulho do celular caindo no chão.',
            },
            cenas: [
                {
                    titulo: 'INT. QUARTO DE PAULO - NOITE',
                    tomadas: [
                        {
                            video: 'CLOSE-UP - PLONGÉE - ZOOM-IN.<br><br>Paulo acorda assustado e olha ao redor.',
                            audio: 'BG: trilha de música de rádio antiga tocando bem baixo ao longe.<br><br>Folley: barulho das roupas de cama se movendo, som de vento soprando lá fora.',
                        },
                        {
                            video: 'PLANO DETALHE - ZENITAL - DOLLY OUT.<br><br>O celular na cabeceira está piscando. A tela se ilumina mostrando "Chamada de JOÃO".',
                            audio: 'BG: música distante continua.<br><br>Folley: toque insistente e agudo do despertador.',
                        },
                        {
                            video: 'PLANO MÉDIO - FRONTAL - DOLLY IN.<br><br>Paulo pega o celular e atende, com expressão confusa.',
                            audio: 'PAULO<br>(voz sonolenta)<br>Alô? João? Cara, são três da manhã. O que houve?',
                        },
                        {
                            video: 'PLANO CONJUNTO - CÂMERA HOLANDESA.<br><br>A ligação começa a chiar. A luz do abajur pisca. O copo de água na mesa flutua dez centímetros.',
                            audio: 'BG: ruído de estática e interferência eletromagnética crescendo.<br><br>JOÃO<br>(através do celular, com muita estática)<br>Paulo! Não olhe para a... [chiado]... eles estão... [estática].',
                        },
                    ],
                },
                {
                    titulo: 'INT. QUARTO DE PAULO - CONTINUAÇÃO',
                    tomadas: [
                        {
                            video: 'PLANO GERAL.<br><br>Uma luz azul neon extremamente forte invade o quarto pela janela. Sombras longas na parede contrária.',
                            audio: 'BG: um som grave e contínuo de sintetizador (drone de suspense) vibra o ambiente.',
                        },
                        {
                            video: 'PLANO MÉDIO ABERTO.<br><br>Paulo começa a levitar lentamente acima da cama, olhando a janela aterrorizado.',
                            audio: 'PAULO<br>(gritando)<br>Socorro! O que é isso?!',
                        },
                        {
                            video: 'FADE OUT RÁPIDO.<br><br>A tela fica preta.',
                            audio: 'Folley: som do celular batendo no chão seco, seguido por um silêncio absoluto repentino.',
                        },
                    ],
                },
            ],
        },
    },

    {
        id: 'vendas',
        nome: 'Reel: gancho de vendas',
        descricao: 'Sessenta segundos verticais com foco em retenção: problema, frustração e chamada para ação.',
        icone: 'megaphone',
        roteiro: {
            formato: 'reel',
            duracao_alvo: 60,
            conceito: 'Vídeo dinâmico em formato vertical para reter nos primeiros três segundos e oferecer uma ferramenta gratuita.',
            tom: 'Rápido, enérgico, direto ao ponto, legendas grandes na tela, música empolgante.',
            personagens: ['APRESENTADOR'],
            atos: {
                apresentacao: 'Gancho ultra rápido: mostrar um monte de contas acumuladas e fazer a pergunta direta — "você sabe para onde vai seu dinheiro todo mês?".',
                confronto: 'Desenvolver a frustração de montar planilhas complexas que demoram horas para configurar e que todo mundo abandona no terceiro dia.',
                resolucao: 'Apresentar a solução e terminar com a chamada para ação: comentar para receber o link direto.',
            },
            cenas: [{
                titulo: 'INT. ESCRITÓRIO - DIA',
                tomadas: [
                    {
                        video: 'PLANO MÉDIO FECHADO (vertical).<br><br>O apresentador bate a mão na mesa cheia de boletos, olhando sério para a câmera. Punch-in rápido.',
                        audio: 'BG: batida instrumental energética inicia.<br><br>APRESENTADOR<br>Pare de perder dinheiro por não saber onde gasta!',
                    },
                    {
                        video: 'PLANO DETALHE.<br><br>O apresentador desliza o dedo no celular mostrando uma tabela colorida cheia de gráficos.',
                        audio: 'APRESENTADOR<br>Se você odeia planilha cheia de fórmula que ninguém entende, olha isso aqui.',
                    },
                    {
                        video: 'GRAVAÇÃO DE TELA (B-ROLL).<br><br>O usuário manda uma mensagem simples e o sistema responde com um gráfico atualizado.',
                        audio: 'APRESENTADOR<br>Você só manda uma mensagem falando quanto gastou, e o controle se monta sozinho.',
                    },
                    {
                        video: 'PLANO MÉDIO FECHADO.<br><br>O apresentador aponta para baixo, sorrindo.',
                        audio: 'APRESENTADOR<br>Quer testar de graça? Comenta aqui embaixo que eu te mando o link agora mesmo!',
                    },
                ],
            }],
        },
    },

    {
        id: 'youtube',
        nome: 'YouTube: abertura de review',
        descricao: 'Três minutos horizontais, intercalando câmera e B-roll. Começa provando o problema antes de vender a solução.',
        // A cópia local do Lucide não traz os ícones de marca (o "youtube"
        // não existe nela). monitor-play é o equivalente genérico e não
        // depende de um pacote de logos que o DS não entrega.
        icone: 'monitor-play',
        roteiro: {
            formato: 'youtube',
            duracao_alvo: 180,
            conceito: 'Abertura de um vídeo de análise de um microfone de lapela barato que promete qualidade de estúdio.',
            tom: 'Profissional, acolhedor, educativo, com cortes sincronizados com a música.',
            personagens: ['APRESENTADOR'],
            atos: {
                apresentacao: 'Comparar a diferença drástica entre o áudio da câmera do celular e o áudio limpo do microfone novo.',
                confronto: 'Mostrar por que microfones profissionais caros afastam quem está começando.',
                resolucao: 'Revelar o preço e responder se vale a pena para produzir vídeos profissionais.',
            },
            cenas: [{
                titulo: 'INT. ESTÚDIO - DIA',
                tomadas: [
                    {
                        video: 'PLANO MÉDIO (horizontal).<br><br>Apresentador fala em cenário com luz de fundo azul e laranja, mas o áudio soa distante e com eco.',
                        audio: 'APRESENTADOR<br>Gravar com o áudio direto do celular pode destruir o engajamento do seu canal.',
                    },
                    {
                        video: 'PLANO DETALHE.<br><br>O apresentador prende o microfone de lapela na camiseta. O áudio muda instantaneamente.',
                        audio: 'Folley: som estalado do clipe prendendo no tecido.<br><br>APRESENTADOR<br>(áudio agora limpo)<br>E se eu te disser que não precisa gastar milhares de reais para ter áudio de estúdio?',
                    },
                    {
                        video: 'B-ROLL.<br><br>Câmera desliza sobre a caixa de carregamento do microfone, LEDs acesos.',
                        audio: 'BG: música lo-fi relaxante começa ao fundo.<br><br>APRESENTADOR<br>Hoje a gente testa se ele presta mesmo.',
                    },
                ],
            }],
        },
    },
];

export const modeloPorId = (id) => MODELOS.find(m => m.id === id) || MODELOS[0];
