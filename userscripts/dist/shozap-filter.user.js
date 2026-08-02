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

      if (category.requirePromotion) {
        const threshold =
          typeof category.minDiscountPercent === "number"
            ? category.minDiscountPercent
            : keywordConfig.defaultMinDiscountPercent || 0;
        const discountOk =
          typeof product.discountPercent === "number"
            ? product.discountPercent >= threshold
            : hasPromotionSignal(haystack);
        if (!discountOk) {
          return { relevant: false, category: categoryId, reason: "desconto_abaixo_do_minimo" };
        }
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
    confirmWaitMs: 250,
    tabSwitchDelayMs: 300,
    scrollTickDelayMs: 150,
    maxScrollTicks: 400,
    periodLabels: ["Manhã", "Tarde", "Noite"],
    autoRun: {
      enabled: true,
      afterHour: 21, // roda sozinho 1x por dia a partir dessa hora (horario local do navegador)
      checkIntervalMs: 5 * 60 * 1000, // reverifica a cada 5 min enquanto a aba fica aberta
      storageKey: "shozap-niche-filter:lastAutoRun",
    },
  };

  const SELECTORS = {
    productCard: ".produto-card",
    title: ".pcard-name",
    store: ".pcard-shop",
    discountBadge: ".pcard-badge-discount",
    deleteButton: ".pcard-btn-danger",
    loadMoreSentinel: ".produtos-loading",
    periodTabIds: {
      "Manhã": "#btn-filter-manha",
      Tarde: "#btn-filter-tarde",
      Noite: "#btn-filter-noite",
    },
  };

  const CONFIRM_DELETE_TEXT = "Sim, Remover agora";

  const KEYWORD_CONFIG = {"$schema":"https://json-schema.org/draft-07/schema#","description":"Fonte unica de palavras-chave do nicho, usada para validar itens da fila do Shozap e das campanhas em Mercado Livre, Shopee e Amazon. Editar aqui reflete em todos os canais.","defaultMinDiscountPercent":30,"categories":{"eletronicos_pc":{"label":"Eletronicos para computador","keywords":["teclado","mouse","fone de ouvido","fone bluetooth","notebook"],"requireKnownBrand":false},"tenis_marcas":{"label":"Tenis de marca","keywords":["tenis","sneaker"],"requireKnownBrand":true,"brands":["adidas","nike","vans","puma","lacoste"]},"academia_suplementos":{"label":"Academia e suplementos","keywords":["short academia","whey protein","whey","creatina","melatonina"],"requireKnownBrand":false},"limpeza_promocao":{"label":"Limpeza (somente em promocao)","keywords":["sabao em po","omo","amaciante"],"requireKnownBrand":false,"requirePromotion":true},"beleza":{"label":"Beleza e cuidados pessoais","keywords":["creme facial","creme corporal","creme para o corpo"],"requireKnownBrand":false}},"knownBrands":["adidas","nike","vans","puma","lacoste","omo"],"genericExcludeTerms":["kit variado","sortido","generico","diversos modelos","sem marca"]};

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function extractProduct(cardEl) {
    const titleEl = cardEl.querySelector(SELECTORS.title);
    const storeEl = cardEl.querySelector(SELECTORS.store);
    const discountEl = cardEl.querySelector(SELECTORS.discountBadge);
    const discountMatch = discountEl ? discountEl.textContent.match(/(\d+)/) : null;
    return {
      title: titleEl ? titleEl.getAttribute("title") || titleEl.textContent : cardEl.textContent,
      description: storeEl ? storeEl.textContent : "",
      discountPercent: discountMatch ? Number(discountMatch[1]) : undefined,
    };
  }

  function findPeriodTabs() {
    return CONFIG.periodLabels
      .map((label) => document.querySelector(SELECTORS.periodTabIds[label]))
      .filter(Boolean);
  }

  async function ensureAllCardsRendered(log) {
    let previousCount = -1;
    let stableRounds = 0;
    for (let tick = 0; tick < CONFIG.maxScrollTicks && stableRounds < 3; tick++) {
      const sentinel = document.querySelector(SELECTORS.loadMoreSentinel);
      if (sentinel) {
        sentinel.scrollIntoView({ block: "end" });
      } else {
        window.scrollBy(0, 1500);
      }
      await sleep(CONFIG.scrollTickDelayMs);
      const currentCount = document.querySelectorAll(SELECTORS.productCard).length;
      stableRounds = currentCount === previousCount ? stableRounds + 1 : 0;
      previousCount = currentCount;
    }
    log(`Cards carregados no DOM: ${previousCount}.`);
  }

  async function confirmDeleteIfPrompted() {
    await sleep(CONFIG.confirmWaitMs);
    const confirmBtn = Array.from(document.querySelectorAll("button")).find((btn) =>
      btn.textContent.includes(CONFIRM_DELETE_TEXT)
    );
    if (!confirmBtn) return false;
    confirmBtn.click();
    return true;
  }

  async function sweepCurrentTab(log) {
    await ensureAllCardsRendered(log);
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
        const confirmed = await confirmDeleteIfPrompted();
        if (!confirmed) {
          log(`Aviso: modal de confirmacao nao encontrado para "${product.title}", pode nao ter sido removido.`);
        } else {
          log(`Excluido "${product.title}" [${result.reason}]`);
        }
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

  async function runWithButtonState(button, runningLabel) {
    button.disabled = true;
    const original = button.textContent;
    button.textContent = runningLabel;
    const log = (msg) => console.log("[Shozap Filtro]", msg);
    try {
      await runFilter(log);
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  function injectRunButton() {
    const button = document.createElement("button");
    button.textContent = "Filtrar fila (nicho)";
    button.style.cssText =
      "position:fixed;bottom:20px;right:20px;z-index:99999;padding:10px 16px;" +
      "background:#e11d48;color:#fff;border:none;border-radius:8px;font-weight:600;" +
      "cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3);";
    button.addEventListener("click", () => runWithButtonState(button, "Filtrando..."));
    document.body.appendChild(button);
    return button;
  }

  function getLocalDateKey(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function shouldAutoRunNow() {
    const { enabled, afterHour, storageKey } = CONFIG.autoRun;
    if (!enabled) return false;
    const now = new Date();
    if (now.getHours() < afterHour) return false;
    return localStorage.getItem(storageKey) !== getLocalDateKey(now);
  }

  function markAutoRunDone() {
    localStorage.setItem(CONFIG.autoRun.storageKey, getLocalDateKey(new Date()));
  }

  function watchAutoRun(button) {
    const maybeRun = () => {
      if (!shouldAutoRunNow()) return;
      markAutoRunDone();
      console.log(`[Shozap Filtro] Revisao automatica das ${CONFIG.autoRun.afterHour}h iniciando.`);
      runWithButtonState(button, "Revisao automatica...");
    };
    maybeRun();
    setInterval(maybeRun, CONFIG.autoRun.checkIntervalMs);
  }

  const runButton = injectRunButton();
  watchAutoRun(runButton);
})();
