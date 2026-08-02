// ==UserScript==
// @name         Shozap - Filtro de Nicho
// @namespace    fun-on-rio
// @version      0.1.0
// @description  Remove da fila do Shozap produtos fora do nicho (marcas conhecidas, eletronicos de PC, tenis de marca, academia, limpeza em promocao, beleza)
// @match        https://shozap.com.br/*
// @grant        none
// ==/UserScript==

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.NicheFilter = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  function normalize(text) {
    return (text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function hasPromotionSignal(text) {
    return /\b(promo(cao)?|oferta|desconto|liquidacao|off\b|%\s?off)\b/.test(text);
  }

  function classify(product, keywordConfig) {
    const title = normalize(product.title);
    const description = normalize(product.description || "");
    const haystack = title + " " + description;

    for (const term of keywordConfig.genericExcludeTerms || []) {
      if (haystack.includes(normalize(term))) {
        return { relevant: false, category: null, reason: "termo_generico:" + term };
      }
    }

    for (const [categoryId, category] of Object.entries(keywordConfig.categories)) {
      const matchedKeyword = (category.keywords || []).find((kw) => haystack.includes(normalize(kw)));
      if (!matchedKeyword) continue;

      if (category.requireKnownBrand) {
        const brands = category.brands || keywordConfig.knownBrands || [];
        const matchedBrand = brands.find((brand) => haystack.includes(normalize(brand)));
        if (!matchedBrand) {
          return { relevant: false, category: categoryId, reason: "sem_marca_conhecida" };
        }
      }

      if (category.requirePromotion && !hasPromotionSignal(haystack)) {
        return { relevant: false, category: categoryId, reason: "sem_sinal_de_promocao" };
      }

      return { relevant: true, category: categoryId, reason: "match:" + matchedKeyword };
    }

    return { relevant: false, category: null, reason: "fora_do_nicho" };
  }

  return { classify, normalize, hasPromotionSignal };
});

(function () {
  "use strict";

  // TODO: ainda nao temos o HTML real da fila do Shozap.
  // Ajustar estes seletores assim que tivermos um card de produto de exemplo.
  const SELECTORS = {
    productCard: "[data-product-id], .product-card, .queue-item, li.product",
    title: ".product-title, .title, h3, h4",
    description: ".product-description, .description",
  };

  const KEYWORD_CONFIG = {"$schema":"https://json-schema.org/draft-07/schema#","description":"Fonte unica de palavras-chave do nicho, usada para validar itens da fila do Shozap e das campanhas em Mercado Livre, Shopee e Amazon. Editar aqui reflete em todos os canais.","categories":{"eletronicos_pc":{"label":"Eletronicos para computador","keywords":["teclado","mouse","fone de ouvido","fone bluetooth","notebook"],"requireKnownBrand":false},"tenis_marcas":{"label":"Tenis de marca","keywords":["tenis","sneaker"],"requireKnownBrand":true,"brands":["adidas","nike","vans","puma","lacoste"]},"academia_suplementos":{"label":"Academia e suplementos","keywords":["short academia","whey protein","whey","creatina","melatonina"],"requireKnownBrand":false},"limpeza_promocao":{"label":"Limpeza (somente em promocao)","keywords":["sabao em po","omo","amaciante"],"requireKnownBrand":false,"requirePromotion":true},"beleza":{"label":"Beleza e cuidados pessoais","keywords":["creme facial","creme corporal","creme para o corpo"],"requireKnownBrand":false}},"knownBrands":["adidas","nike","vans","puma","lacoste","omo"],"genericExcludeTerms":["kit variado","sortido","generico","diversos modelos","sem marca"]};

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
