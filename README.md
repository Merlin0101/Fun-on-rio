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
`https://shozap.com.br/`.

## Status

Os seletores de DOM em `userscripts/shozap-filter.template.user.js`
(`SELECTORS`) sao placeholders - ainda precisamos do HTML real de um card de
produto da fila do Shozap para ajustar.
