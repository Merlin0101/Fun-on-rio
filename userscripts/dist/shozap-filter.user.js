// ==UserScript==
// @name         Shozap - Filtro de Nicho
// @namespace    fun-on-rio
// @version      0.2.0
// @description  Remove da fila do Shozap produtos fora do nicho (marcas conhecidas, eletronicos de PC, tenis de marca, academia, limpeza em promocao, beleza)
// @match        https://shozap.com.br/*
// @match        https://app.shozap.com.br/*
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

  const CONFIG = {
    // true = so loga o que seria excluido, sem clicar de verdade.
    // Coloque true pra validar o filtro antes de confiar na exclusao automatica.
    dryRun: false,
    clickDelayMs: 400,
    tabSwitchDelayMs: 600,
    periodLabels: ["Manhã", "Tarde", "Noite"],
  };

  // TODO: ainda nao temos o HTML real da fila do Shozap.
  // Ajustar estes seletores assim que tivermos um card de produto de exemplo.
  const SELECTORS = {
    productCard: "[data-product-id], .product-card, .queue-item, li.product",
    title: ".product-title, .title, h3, h4",
    description: ".product-description, .description",
    store: ".store-name, .seller",
    deleteButton: "[aria-label='Excluir'], [title='Excluir'], button.delete, .delete-btn",
    periodTabCandidates: "button, [role='tab']",
  };

  const KEYWORD_CONFIG = {"$schema":"https://json-schema.org/draft-07/schema#","description":"Fonte unica de palavras-chave do nicho, usada para validar itens da fila do Shozap e das campanhas em Mercado Livre, Shopee e Amazon. Editar aqui reflete em todos os canais.","categories":{"eletronicos_pc":{"label":"Eletronicos para computador","keywords":["teclado","mouse","fone de ouvido","fone bluetooth","notebook"],"requireKnownBrand":false},"tenis_marcas":{"label":"Tenis de marca","keywords":["tenis","sneaker"],"requireKnownBrand":true,"brands":["adidas","nike","vans","puma","lacoste"]},"academia_suplementos":{"label":"Academia e suplementos","keywords":["short academia","whey protein","whey","creatina","melatonina"],"requireKnownBrand":false},"limpeza_promocao":{"label":"Limpeza (somente em promocao)","keywords":["sabao em po","omo","amaciante"],"requireKnownBrand":false,"requirePromotion":true},"beleza":{"label":"Beleza e cuidados pessoais","keywords":["creme facial","creme corporal","creme para o corpo"],"requireKnownBrand":false}},"knownBrands":["adidas","nike","vans","puma","lacoste","omo"],"genericExcludeTerms":["kit variado","sortido","generico","diversos modelos","sem marca"]};

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function extractProduct(cardEl) {
    const titleEl = cardEl.querySelector(SELECTORS.title);
    const descriptionEl = cardEl.querySelector(SELECTORS.description);
    const storeEl = cardEl.querySelector(SELECTORS.store);
    return {
      title: titleEl ? titleEl.textContent : cardEl.textContent,
      description: [descriptionEl ? descriptionEl.textContent : "", storeEl ? storeEl.textContent : ""].join(" "),
    };
  }

  function findPeriodTabs() {
    const candidates = Array.from(document.querySelectorAll(SELECTORS.periodTabCandidates));
    return CONFIG.periodLabels
      .map((label) => candidates.find((el) => el.textContent.trim().startsWith(label)))
      .filter(Boolean);
  }

  async function sweepCurrentTab(log) {
    const cards = Array.from(document.querySelectorAll(SELECTORS.productCard));
    let removed = 0;
    for (const card of cards) {
      const product = extractProduct(card);
      const result = window.NicheFilter.classify(product, KEYWORD_CONFIG);
      if (result.relevant) continue;

      const deleteBtn = card.querySelector(SELECTORS.deleteButton);
      if (!deleteBtn) {
        log(`Botao de excluir nao encontrado: "${product.title}"`);
        continue;
      }

      if (CONFIG.dryRun) {
        log(`(dry-run) removeria "${product.title}" [${result.reason}]`);
      } else {
        deleteBtn.click();
        log(`Excluido "${product.title}" [${result.reason}]`);
        await sleep(CONFIG.clickDelayMs);
      }
      removed++;
    }
    return removed;
  }

  async function runFilter(log) {
    if (!KEYWORD_CONFIG) {
      log("KEYWORD_CONFIG nao carregado, abortando.");
      return;
    }

    const tabs = findPeriodTabs();
    let totalRemoved = 0;

    if (tabs.length === 0) {
      totalRemoved += await sweepCurrentTab(log);
    } else {
      for (const tab of tabs) {
        tab.click();
        await sleep(CONFIG.tabSwitchDelayMs);
        const removedInTab = await sweepCurrentTab(log);
        log(`Aba "${tab.textContent.trim()}": ${removedInTab} item(ns) removido(s).`);
        totalRemoved += removedInTab;
      }
    }

    log(`Concluido. Total removido: ${totalRemoved}.`);
    return totalRemoved;
  }

  function injectRunButton() {
    const button = document.createElement("button");
    button.textContent = "Filtrar fila (nicho)";
    button.style.cssText =
      "position:fixed;bottom:20px;right:20px;z-index:99999;padding:10px 16px;" +
      "background:#e11d48;color:#fff;border:none;border-radius:8px;font-weight:600;" +
      "cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3);";
    button.addEventListener("click", async () => {
      button.disabled = true;
      const original = button.textContent;
      button.textContent = "Filtrando...";
      const log = (msg) => console.log("[Shozap Filtro]", msg);
      try {
        await runFilter(log);
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    });
    document.body.appendChild(button);
  }

  injectRunButton();
})();
