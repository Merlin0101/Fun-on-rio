// ==UserScript==
// @name         Shozap - Filtro de Nicho
// @namespace    fun-on-rio
// @version      0.2.0
// @description  Remove da fila do Shozap produtos fora do nicho (marcas conhecidas, eletronicos de PC, tenis de marca, academia, limpeza em promocao, beleza)
// @match        https://shozap.com.br/*
// @match        https://app.shozap.com.br/*
// @grant        none
// ==/UserScript==

/* __NICHE_FILTER_MODULE__ */

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

  const KEYWORD_CONFIG = /* __NICHE_KEYWORDS__ */ null;

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
