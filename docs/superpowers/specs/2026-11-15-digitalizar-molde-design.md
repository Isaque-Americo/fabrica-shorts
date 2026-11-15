# Digitalizar molde de papel por fotos — desenho

Status: revisado, aguardando aprovação do dono.

## Por quê

O dono tem moldes só em papel, um tamanho por folha, e quer passá-los para o app para **gradear**. A folha costuma ser maior do que uma foto consegue pegar e maior que uma A4, por isso a foto é feita **por partes**. É a primeira vez que ele digitaliza: o desenho começa simples e é ajustado nos testes ("vamos ajustando conforme testamos").

## Como o dono usa

1. **Uma vez só:** cola cruzes de fita crepe no chão ou na mesa formando uma **grade regular** (padrão de 50 cm entre cruzes), medida com trena, e escreve um rótulo em cada cruz (A1, A2, B1…: letra = linha, número = coluna).
2. **No celular:** abre o app, cria uma digitalização ("Bermuda 0022 – M"), coloca a folha sobre a grade e tira as fotos de cima, por partes, pela câmera ou escolhendo da galeria. Cada foto precisa pegar **pelo menos 4 cruzes**. Cada foto sobe para a nuvem logo que é tirada.
3. **No computador:** abre a mesma digitalização. Pode acrescentar fotos carregando arquivos. Em cada foto, clica nas cruzes e diz qual é cada uma (o rótulo). O app emenda as fotos numa imagem da folha inteira, **em escala real (mm)**, e mostra o erro estimado.
4. Escolhe o contorno:
   - **à mão:** desenha por cima da imagem com as ferramentas que o editor de molde já tem; ou
   - **automático:** o app acha a borda do papel e a transforma em linhas e curvas lisas, tirando irregularidades (tremido da tesoura, papel levemente amassado). Um controle "suavizar" escolhe o quanto simplificar. Depois o dono ajusta os pontos.
5. Leva o resultado para um molde de uma destas formas (o dono quer **as duas**):
   - **Base + gradação pelas folhas:** a folha do tamanho base vira as peças do molde. As folhas dos outros tamanhos aparecem **por baixo** do molde, alinhadas, e o dono arrasta cada ponto do base até a linha daquele tamanho. O app grava isso como gradação (`grad[ponto][tam]`, o mesmo que o editor já usa).
   - **Cada tamanho completo:** o contorno de cada folha vira uma peça que só existe naquele tamanho (peça com `tam`, que o modelo já aceita).
6. Piques, fio, posição de bolso e textos o dono põe **depois**, à mão, por cima da imagem, com as ferramentas do editor.

## Metas

- Erro de até **2 mm** entre o molde digital e o papel (o limite que o dono aceita), com as cruzes bem medidas e a foto de cima.
- Fluxo celular → computador sem passar arquivo por fora (sem WhatsApp, sem cabo).
- O resultado é um molde normal: gradua, encaixa, vai para a ordem de corte e para o plotter como os outros.

## Fora desta versão

- Achar piques, fio, linhas internas ou textos sozinho.
- Achar as cruzes na foto sozinho: o dono clica nelas. Pode vir depois.
- Contornar ou ajustar no celular: no celular só se tiram as fotos.
- Calibrar a lente da câmera.

## Seria um fracasso se

- O molde sai com mais de 2 mm de erro e o app não avisa.
- Uma foto se perde porque o sinal caiu no meio.
- As fotos dos moldes ficam públicas. Molde é segredo da fábrica.

## Restrições

- App sem build: HTML + JS puros, publicado no GitHub Pages pela lista fixa de arquivos em `.github/workflows/pages.yml`. Página nova precisa entrar nessa lista.
- Dados em `public.docs` (coluna `col` + `data` jsonb), com RLS por área (`private.area_da_col`, `private.pode`). Digitalização é da área **moldes**: ver precisa de `moldes:ver`, mexer precisa de `moldes:mexer`.
- Fotos num **bucket privado novo** do Supabase Storage (não no bucket público `produtos`), com políticas usando `private.pode('moldes', …)`. Mudança de banco vai em migration nova em `supabase/migrations/`.
- Documentos antigos de molde não podem quebrar: todo campo novo é lido com valor padrão.
- Modo `?local=1` (sem Supabase) tem que continuar funcionando para teste; as fotos podem ficar só na memória ou no IndexedDB do navegador.
- Visual Outline (tokens de cor, claro e escuro), igual às outras páginas.
- Lógica nova não trivial (emendar fotos, contorno, simplificação) leva self-check em `.claude/scripts/`, como os que já existem.
- Sem dependência nova grande. Nada de OpenCV.js (uns 8 MB).

## Decisões (escolhas minhas, o dono pode mudar)

- **Página nova `digitalizar.html`**: lista de digitalizações, captura no celular e montagem no computador. O editor `molde.html` ganha só o que é de molde: a folha de fundo para gradear.
- Entrada pelo menu do admin, no grupo de moldes, e um botão "Digitalizar" no editor de molde.
- Cada digitalização é **uma folha** (um tamanho): nome, tamanho (opcional), espaçamento da grade (padrão 50 cm, editável), lista de fotos com as cruzes marcadas. Guardada em `docs` com `col = 'digitalizacoes'`.
- A foto sobe reduzida a no máximo ~3000 px no lado maior, JPEG de boa qualidade (≈0,3–0,5 mm por pixel numa foto de 1 m).
- **Emenda:** cada célula da grade (4 cruzes vizinhas) usa sua própria transformação de perspectiva, para diminuir a distorção da lente nas bordas. Onde duas fotos cobrem o mesmo lugar, vale a foto em que aquele ponto fica mais perto do centro.
- **Erro estimado:** cruzes a mais que as 4 mínimas servem de conferência. O app mostra o erro em mm por foto e avisa acima de 2 mm.
- **Contorno automático** sem biblioteca: separar papel do fundo (limiar automático, ou o dono clica no papel), pegar a mancha do papel, traçar a borda, simplificar (Douglas-Peucker) e ajustar linhas retas e curvas. "Suavizar" é a tolerância dessa simplificação.
- **Cada folha tem uma peça só** (confirmado pelo dono). Digitalização = uma peça num tamanho. A folha de fundo de um tamanho fica ligada à peça correspondente do base.
- **Alinhar a folha de outro tamanho** com a peça do base: o dono clica 2 pontos correspondentes (um no molde, um na folha). O app gira e move a folha, sem mudar a escala, que já é real.
- O molde guarda qual digitalização é a folha de fundo de cada tamanho e o alinhamento dela, para reabrir pronto. Campo novo, com valor padrão vazio.
- As fotos **não** se apagam sozinhas. A digitalização tem um botão para apagar as fotos quando o molde estiver pronto. Apagar leva junto a imagem emendada: a folha de fundo some do molde, mas as peças e a gradação ficam. O app avisa antes.
- **Cobertura:** os 2 mm valem dentro das células cobertas (4 cruzes em volta). Se o contorno passar por fora das células cobertas, o app marca o trecho e avisa ("faltou foto/cruz aqui"). Não extrapola calado.
- **Conferência do erro:** uma foto com 5 ou mais cruzes é conferida deixando uma cruz de fora por vez e medindo onde ela cai. Uma foto com só 4 cruzes aparece como **"erro não conferido"** (aviso, não aprovação). A grade de 50 cm faz a maioria das fotos pegar 6 ou mais cruzes.
- **Sinal caiu:** a foto fica guardada no próprio celular (IndexedDB) até a nuvem confirmar o recebimento. Se a página fechar, ela volta a subir quando o dono abrir a digitalização de novo. O app mostra "enviando / enviada / falhou, tentar de novo".
- **Quem vê as fotos:** ler precisa de `moldes:ver`, enviar ou apagar precisa de `moldes:mexer`. O caminho é `<id da digitalização>/<foto>.jpg`. A política só confere `private.pode('moldes', …)`, sem dono por digitalização. As fotos abrem por link assinado de curta duração. Migration nova mapeia `digitalizacoes` → `moldes` em `private.area_da_col`. Conferir se outros lugares listam as coleções (backup, listas de permissão) e incluir lá.
- **Separar papel do fundo:** o dono clica no papel e o app pinta a partir dali, com tolerância de cor ajustável (funciona com chão liso ou estampado). Se a fita de uma cruz encostar no papel, o dono apaga o trecho com o ajuste de pontos.

## Fica para quem constrói

- O formato exato dos campos novos, respeitando o padrão de documentos antigos.
- A resolução da imagem emendada (limite de memória do navegador) e se ela é guardada ou recalculada ao abrir.
- O jeito de clicar e rotular as cruzes na tela.
- Como as curvas do contorno automático viram `tracos` do tipo `curva` do modelo (`molde/modelo.js`).
