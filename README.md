# Fun on Rio - Filtro de Nicho

Automacao para validar itens da fila do Shozap (e futuramente Mercado Livre,
Shopee e Amazon) contra o nicho: marcas conhecidas, eletronicos para
computador, tenis de marca, academia/suplementos, limpeza em promocao e
beleza.

## Estrutura

- `config/niche-keywords.json` - fonte unica de palavras-chave do nicho.
- `shared/niche-filter.js` - classificador (Node e navegador).
- `test/niche-filter.test.js` - testes do classificador.
- `userscripts/shozap-filter.template.user.js` - template do userscript.
- `userscripts/dist/shozap-filter.user.js` - userscript pronto para instalar
  (gerado, nao editar direto).
- `scripts/build-userscript.js` - injeta o classificador e as palavras-chave
  no template para gerar o arquivo `dist`.

## Uso

```
npm test                 # roda os testes do classificador
npm run build:userscript # regenera userscripts/dist/shozap-filter.user.js
```

Depois de gerar o `dist`, instale no Tampermonkey (ou Greasemonkey) e abra
`https://app.shozap.com.br/envios`. Um botao "Filtrar fila (nicho)" aparece
no canto inferior direito; ele tambem roda sozinho 1x por dia a partir das
21h se a aba estiver aberta.

A cada execucao, um arquivo `shozap-filtro-log-AAAA-MM-DD.csv` e baixado
automaticamente com todos os itens removidos (titulo, categoria, motivo).

## Calibrando o filtro (lista de excecao)

Se um item foi removido por engano, tem duas formas de liberar sem mudar as
regras gerais, editando `config/niche-keywords.json`:

- `allowlistProductIds`: cole o `itemId` do produto (esta no CSV do log) pra
  liberar so aquele item especifico.
- `allowlistKeywords`: adicione uma palavra/frase (ex: "pre treino") pra
  liberar qualquer produto que contenha esse termo, mesmo fora das
  categorias definidas.

Depois de editar, rode `npm run build:userscript` de novo e reinstale o
arquivo `dist` no Tampermonkey.

## Status

Seletores confirmados com HTML real da fila (`.produto-card`,
`.pcard-name`, `#btn-filter-manha/tarde/noite`, etc.). O endpoint interno
`POST core.shozap.com.br/envios/produtos/remover` foi identificado mas nao
usado ainda (falta capturar payload/headers) - possivel otimizacao futura
pra trocar clique+scroll por chamada direta.
