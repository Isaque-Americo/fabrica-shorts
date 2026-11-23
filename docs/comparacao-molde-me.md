# O que o Molde.me tem e o nosso app não — lista priorizada

Base: 466 frames dos quatro vídeos do Molde.me (digitalização 17m34, exemplo encaixe 9m14, enfesto 6m57, tabela de medidas 5m56), comparados arquivo por arquivo com `digitalizar.html`, `molde.html`, `molde/encaixe.js`, `molde/ordem.js`, `enfesto.html` e `corte.html`. Levantado em 2026-11-23.

A ordem é por **resultado dividido por esforço**, não por quanto o recurso impressiona.

---

## Faça primeiro — pequeno e muda o dia a dia

**1. Peso, custo e consumo no painel do risco**
`MoldeOrdem.resultados()` **já calcula** `pesoTecido`, `pesoPecas`, `pesoDesperdicio`, `consumoLinear` e `custo`. O `enfesto.html` nunca chama. Os números existem e só aparecem na tela da ordem. É chamar `MO.resultados` com o enfesto aberto e acrescentar linhas ao `painel()`.
*É o melhor negócio da lista inteira: cálculo zero, resultado grande.*

**2. Aproveitamento líquido × bruto, com as áreas em m²**
Molde.me mostra os dois medidores (Líquido 86,53% · Bruto 83,29%) mais Área do Enfesto / Aproveitada / Desperdiçada em m². Nós mostramos um número só, que é o líquido (`areaPecas/(comp*largUtil)`). O bruto, sobre a largura total do rolo com ourela e cabeceira, é o que se compara com o custo real do rolo. Um `item()` a mais no `painel()`, com `larg()` no lugar de `C.largUtil`.

**3. Rótulo da peça no risco com a rotação e o número do par**
Lá sai escrito na peça: `TRASEIRO 0°` / `50` / `PAR 1`. Nós escrevemos só nome e tamanho. Quem corta precisa saber se a peça está a 0° ou 180° e qual par é qual — é o que vira papel no chão de fábrica.

**4. Imprimir a tabela de medidas**
A aba Medidas não imprime nem exporta de jeito nenhum hoje. Um `@media print` e um botão `window.print()` sobre o `#m-tab`. A tabela impressa é o que fica preso na mesa de corte.

**5. Perímetro de corte**
"Perímetro de Corte: 73,75 m" — a soma do contorno de todas as peças do risco, × camadas. Serve para estimar tempo de corte e desgaste de lâmina. Somar `hypot` dos lados dos polígonos de `E.poses`.

**6. Cores fixas por tamanho na tabela de medidas e nos `−/+` da grade**
Já pintamos por tamanho no risco e na legenda; os botões do `corte.html` e os cabeçalhos do `#m-tab` são todos cinzas. A cor liga visualmente a grade, a tabela e o risco.

**7. "Exibir apenas tamanho base" na aba Medidas**
Com 7 tamanhos (P–G4) a tabela não cabe no painel estreito. Um checkbox que filtra `tams` no `desenharMed()`.

**8. Cartão da peça selecionada no risco**
Lá: Comprimento 124,5 cm · Largura 49,7 cm · Perímetro 320,5 cm · Área 0,43 m² · Rotação 0°. O nosso `#sel` diz só "Selecionada: Peça X, tam".

**9. Zoom mostrando a porcentagem**
Lá é um campo "30% ▾"; nós temos só − e + multiplicando por 1,25, sem saber em que escala estamos. Vale no risco e no editor.

**10. Marca visual de qual medida está ligada ao desenho**
Linha ligada ao traço fica com fundo e um círculo cheio; medida digitada na mão fica branca. Nós escrevemos "sem traço" na célula.

**11. Botão "Recentralizar"**
Depois de passear com o zoom (vai até 8x no contorno), um clique traz o desenho de volta.

---

## Depois — médio, e cada um resolve um problema que você já teve

**12. Preencher o "esperado" de todos os tamanhos a partir do molde graduado**
Hoje o esperado é digitado célula por célula na mão; só o "medido" sai do desenho (`MM.medir`). No Molde.me você aponta a medida uma vez no tamanho base e o valor aparece preenchido para todos os tamanhos, porque ele recalcula no molde graduado. Já temos `MM.medir(M,ids,t)` e `MM.noTamanho` — falta um botão que rode em todos os tamanhos e grave em `m.valores`.
*É o item que transforma a gradação em tabela de medidas sem ninguém digitar. O de maior valor fora dos pequenos.*

**13. Contador "colocadas / precisa" por peça e por tamanho, com aviso de pendência**
Lá, cada peça é um cartão com miniatura e uma linha por tamanho: `40 → 2 / 2`, `50 → 0 / 4`, com triângulo laranja quando falta. Quando o nosso `encaixar` devolve `null`, só dizemos "não foi possível montar o risco" — sem dizer qual peça não coube. O dado já existe em `C.itens`/`P`.

**14. Prévia da máscara preto-e-branco no contorno automático**
Lá a foto vira silhueta branca sobre preto enquanto você move o controle de bordas. Nós só desenhamos a linha laranja por cima da foto — quando a fita crepe encosta no papel você não enxerga que a mancha vazou. É o que torna a "Tolerância de cor" previsível em vez de tentativa e erro.

**15. Encolhimento em % (horizontal e vertical) por peça**
Malha de short encolhe na lavagem. Hoje só dá para compensar redesenhando o molde na mão. O `escala` do `encaixe.js` já aplica escala depois da rotação — o que falta é o campo guardado na peça.

**16. Desfazer e refazer dentro do risco**
Hoje um arrasto errado só volta com "Refazer encaixe automático", que joga fora todo o ajuste manual.

**17. Ímã: encostar a peça na vizinha ao arrastar**
Nosso arrasto prende na grade de 2 cm (`grade=v=>Math.round(v/RES)*RES`), então encostar duas peças sem fresta depende de sorte. Lá a cava da manga é preenchida pela peça vizinha.

**18. "Aplicar em todos os painéis" nas propriedades da peça**
Já temos todas as propriedades (nome, quantidade, par, rotação, espelhar, tubular, tecido). Falta o botão que copia tudo de uma peça para as outras.

**19. Cadeado por valor na tabela de medidas**
Quando o cliente manda a medida fechada, ela não pode ser sobrescrita pelo recálculo do desenho.

**20. Cadastrar o tecido dentro da própria ordem**
Hoje exigimos que a matéria-prima já esteja cadastrada; tecido novo trava a ordem. Lá, nome, largura, gramatura, preço (com seletor metro/kg) e fornecedor são editáveis ali mesmo. Também falta **Fornecedor** no nosso cadastro.

**21. Relatório imprimível na tela do risco**
Temos "Imprimir relatório" da ordem inteira e "Imprimir minimapa", mas não um relatório do enfesto com os números dos itens 1–5 e a miniatura do risco. Reaproveita o `@media print` e o `#mini` que já existem.

**22. Camadas e grade no mesmo diálogo de criar o enfesto**
Hoje criamos o enfesto vazio e só depois você acha "Editar → Propriedades" para pôr as camadas.

---

## Decisão antes de código — grande

**23. Salvar o ajuste manual do risco**
Está escrito na nossa própria tela: "O ajuste manual não é salvo: recarregar a página volta ao encaixe calculado". No Molde.me o risco arrastado fica gravado e é dele que sai o PDF. **Quem conserta o risco à mão e fecha a aba perde o trabalho — é o pior buraco da lista.** Precisa gravar `posicoes` no doc da ordem no Supabase, com leitura tolerante para ordens antigas, e decidir o que acontece quando a grade muda.

**24. Busca de encaixe com tempo, progresso ao vivo e botão de parar**
Lá: "Tempo de Encaixe − 2 min +", o aproveitamento subindo ao vivo (0% → 82,68%), barra de progresso, "Tempo restante: 01:58" e "Interromper Encaixe". O nosso é passe único instantâneo. Dar 2 minutos de busca é o que mais tira metro do risco, e é tempo que a encaixista gasta de qualquer jeito.
*Atenção: o aproveitamento em %, o encaixe de vários tamanhos juntos, par/espelho, ourela e sentido duplo/único nós **já temos**. A diferença é só a busca longa com progresso.*

**25. Travar peça no lugar e refazer o automático só no resto**
Hoje "Refazer encaixe automático" joga fora todo o ajuste. Marcar posições fixas e semear `occ` em `encaixaBLF` antes do laço.

**26. Encaixe mais fino que 2 cm**
Com `ENC_RES=20` cada peça pode desperdiçar até 2 cm em cada borda. Num risco de 4 m isso é dinheiro. Mas `ENC_RES` é estrutural (`rasterPol`, `encaixaBLF`, `ocupacao`, o arrasto e o export dependem dele) e o custo cresce com o quadrado da resolução.

**27. Área de espera fora do tecido**
Arrastar a peça para fora do tecido, deixá-la parada ali, e o aproveitamento recalcular sem ela — é assim que se testa combinação. Nosso `E.moverPeca` recusa qualquer posição fora do tecido. Depende do item 23.

**28. Margem de costura no risco exportado**
Nosso diálogo de exportação já tem a opção, porém **desabilitada**, com o texto "O molde ainda não guarda a linha de costura". Sem ela o risco impresso não serve para cortar direto. O buraco está no editor de molde, não no encaixe.

**29. Tabela de medidas como documento próprio, reusável**
Lá a tabela vive fora do molde, com acervo, busca, pastas e vínculo molde↔tabela; o mesmo padrão serve para vários shorts. No nosso app ela só existe dentro do molde. Tabela nova no Supabase, tela de acervo, vínculo.

**30. Medida pelo contorno, somando vários trechos**
Com "Utilizar o contorno do Painel" ligado, a medida é montada de vários trechos (16,06 + 16,05 + 16,05) e você escolhe por qual caminho o contorno passa. É exatamente como se mede consumo de elástico, debrum e viés — dá o metro de aviamento por tamanho.

---

## Reabre decisão que você já tomou — não é só codar

**31. Gerar várias peças de uma foto só** ("GERAR MOLDE(S)" com 4 manchas na mesma máscara). O desenho aprovado em `docs/superpowers/specs/2026-11-15-digitalizar-molde-design.md` fixa "cada folha tem uma peça só". Para o short seriam frente + costas + bolso na mesma folha: hoje três digitalizações, lá uma foto.

**32. Achar os cantos do quadro sozinho pelos marcadores impressos.** O desenho diz "achar as cruzes sozinho fica para depois". Lá a foto é tirada sobre um gabarito impresso com marcadores nos cantos e o programa já chega com os quatro cantos posicionados. Economiza o passo mais chato, mas depende de imprimir o gabarito.

---

## Onde nós já estamos melhores

1. **Dinheiro e peso.** Temos peso do tecido, peso das peças, desperdício em kg e %, consumo linear em m/roupa e custo em R$. No Molde.me o custo mora em outro módulo ("Formação de Preços").
2. **Papel para quem não tem plotter.** PDF em folhas A4 com folha de calibração de 10 × 10 cm, marcas de emenda numeradas e "Folha k de n · linha L, coluna C". O deles só oferece "Dimensões Totais" e margens.
3. **Folha maior que uma foto.** Montamos várias fotos sobre a grade de cruzes de 50 cm. O Molde.me exige que a peça caiba no gabarito de uma foto só — short adulto esticado no chão não cabe.
4. **Erro medido em mm.** `MoldeDigit.conferir` deixa uma cruz de fora por vez, mostra "erro X mm", avisa acima de 2 mm e marca "faltou foto/cruz aqui". Nenhum frame do Molde.me mostra número de precisão.
5. **Conferência esperado × medido.** Marcamos ✓ até 0,3 cm e ✗ acima. Lá a tabela é registro, não teste — mostra o valor, não julga.
6. **Mensagem que diz o motivo.** Nosso `semRisco()` fala a causa exata; o risco avisa "mais comprido que a mesa (5,50 m)" e "camadas acima da altura máxima". Lá o botão só fica cinza.
7. **Teclado e acessibilidade no risco.** Tab seleciona, setas movem 2 cm, Shift+seta 10 cm, R gira, E espelha, com `aria-label` em cm e aviso falado quando não cabe. Nos frames deles só aparece arrasto com mouse.
8. **Captura que aguenta o sinal cair.** Fila no IndexedDB com reenvio automático. Lá a imagem entra por seletor de arquivos no computador.

---

## Três "faltas" que não são falta

- **"Acertar curvas" depois do contorno** — fechado ontem: `fa79ee5` (E, endireitar entre dois pontos) e `a82632e` (U, curvas lisas).
- **"Conferência de medidas"** — já temos a aba Medidas, e com tolerância de 0,3 cm que o deles não tem.
- **Rotação livre a 90°** — descartado por decisão sua: 90° atravessa o fio do tecido.

---

## Ressalvas

- O vídeo do encaixe é de **janeiro de 2023**; a tela do Molde.me de hoje pode estar diferente.
- Os vídeos têm 640 px de largura. Nomes de botão só foram citados quando legíveis; valores soltos podem errar uma casa decimal.
- Nenhum agente conseguiu ler o tooltip da barra lateral esquerda do risco, então o item 25 descreve o ícone (cadeado sobre uma peça), não o nome do botão.
- Os esforços são estimativa de leitura de código, não medição.
