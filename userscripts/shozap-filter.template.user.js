// ==UserScript==
// @name         Shozap - Filtro de Nicho
// @namespace    fun-on-rio
// @version      0.1.0
// @description  Remove da fila do Shozap produtos fora do nicho (marcas conhecidas, eletronicos de PC, tenis de marca, academia, limpeza em promocao, beleza)
// @match        https://shozap.com.br/*
// @grant        none
// ==/UserScript==

/* __NICHE_FILTER_MODULE__ */

(function () {
  "use strict";

  // TODO: ainda nao temos o HTML real da fila do Shozap.
  // Ajustar estes seletores assim que tivermos um card de produto de exemplo.
  const SELECTORS = {
    productCard: "[data-product-id], .product-card, .queue-item, li.product",
    title: ".product-title, .title, h3, h4",
    description: ".product-description, .description",
  };

  const KEYWORD_CONFIG = /* __NICHE_KEYWORDS__ */ null;

  function extractProduct(cardEl) {
    const titleEl = cardEl.querySelector(SELECTORS.title);
    const descriptionEl = cardEl.querySelector(SELECTORS.description);
    return {
      title: titleEl ? titleEl.textContent : cardEl.textContent,
      description: descriptionEl ? descriptionEl.textContent : "",
    };
  }

  function sweep() {
    if (!KEYWORD_CONFIG) {
      console.warn("[Shozap Filtro] KEYWORD_CONFIG nao carregado ainda.");
      return;
    }
    const cards = document.querySelectorAll(SELECTORS.productCard);
    let removed = 0;
    cards.forEach((card) => {
      const product = extractProduct(card);
      const result = window.NicheFilter.classify(product, KEYWORD_CONFIG);
      if (!result.relevant) {
        card.remove();
        removed++;
      }
    });
    if (removed > 0) {
      console.log(`[Shozap Filtro] Removidos ${removed} item(ns) fora do nicho.`);
    }
  }

  const observer = new MutationObserver(() => sweep());
  observer.observe(document.body, { childList: true, subtree: true });
  sweep();
})();
