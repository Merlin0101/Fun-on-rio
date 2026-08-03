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

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\/* __NICHE_FILTER_MODULE__ */");
  }

  function containsKeyword(haystack, keyword) {
    const normalizedKeyword = normalize(keyword);
    if (!normalizedKeyword) return false;
    return new RegExp("\\b" + escapeRegExp(normalizedKeyword) + "\\b").test(haystack);
  }

  function classify(product, keywordConfig) {
    const title = normalize(product.title);
    const description = normalize(product.description || "");
    const haystack = title + " " + description;

    const allowlistProductIds = (keywordConfig.allowlistProductIds || []).map(String);
    if (product.itemId !== undefined && allowlistProductIds.includes(String(product.itemId))) {
      return { relevant: true, category: null, reason: "excecao_manual:id" };
    }
    const matchedAllowlistKeyword = (keywordConfig.allowlistKeywords || []).find((kw) =>
      containsKeyword(haystack, kw)
    );
    if (matchedAllowlistKeyword) {
      return { relevant: true, category: null, reason: "excecao_manual:" + matchedAllowlistKeyword };
    }

    const matchedUniversalBrand = (keywordConfig.universalKnownBrands || []).find((brand) =>
      containsKeyword(haystack, brand)
    );
    if (matchedUniversalBrand) {
      return { relevant: true, category: null, reason: "marca_reconhecida:" + matchedUniversalBrand };
    }

    for (const term of keywordConfig.genericExcludeTerms || []) {
      if (containsKeyword(haystack, term)) {
        return { relevant: false, category: null, reason: "termo_generico:" + term };
      }
    }

    let lastCategoryFailure = null;
    for (const [categoryId, category] of Object.entries(keywordConfig.categories)) {
      const matchedKeyword = (category.keywords || []).find((kw) => containsKeyword(haystack, kw));
      if (!matchedKeyword) continue;

      if (category.requireKnownBrand) {
        const brands = category.brands || keywordConfig.knownBrands || [];
        const matchedBrand = brands.find((brand) => containsKeyword(haystack, brand));
        if (!matchedBrand) {
          lastCategoryFailure = { category: categoryId, reason: "sem_marca_conhecida" };
          continue;
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
          lastCategoryFailure = { category: categoryId, reason: "desconto_abaixo_do_minimo" };
          continue;
        }
      }

      return { relevant: true, category: categoryId, reason: "match:" + matchedKeyword };
    }

    if (lastCategoryFailure) {
      return { relevant: false, category: lastCategoryFailure.category, reason: lastCategoryFailure.reason };
    }
    return { relevant: false, category: null, reason: "fora_do_nicho" };
  }

  return { classify, normalize, hasPromotionSignal, containsKeyword };
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
    campaignSwitchDelayMs: 500,
    campaignOpenTimeoutMs: 6000,
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
    listContainer: ".produtos-lista-pro",
    periodTabIds: {
      "Manhã": "#btn-filter-manha",
      Tarde: "#btn-filter-tarde",
      Noite: "#btn-filter-noite",
    },
    campaignMenuButton: ".card-menu-btn",
    closeModalButton: ".modal-close.abs-close",
  };

  const CONFIRM_DELETE_TEXT = "Sim, Remover agora";

  const KEYWORD_CONFIG = {"$schema":"https://json-schema.org/draft-07/schema#","description":"Fonte unica de palavras-chave do nicho, usada para validar itens da fila do Shozap e das campanhas em Mercado Livre, Shopee e Amazon. Editar aqui reflete em todos os canais.","defaultMinDiscountPercent":30,"categories":{"eletronicos_pc":{"label":"Eletronicos para computador","keywords":["teclado","mouse","fone de ouvido","fone bluetooth","notebook","headset","monitor","placa de video","ssd","memoria ram"],"requireKnownBrand":false},"tenis_marcas":{"label":"Tenis de marca","keywords":["tenis","sneaker"],"requireKnownBrand":true,"brands":["adidas","nike","vans","puma","lacoste"]},"academia_suplementos":{"label":"Academia e suplementos","keywords":["short academia","whey protein","whey","creatina","melatonina","pre treino"],"requireKnownBrand":false},"limpeza_promocao":{"label":"Limpeza (somente em promocao, marca reconhecida nao dispensa esta regra)","keywords":["sabao em po","omo","amaciante"],"requireKnownBrand":false,"requirePromotion":true},"beleza":{"label":"Beleza e cuidados pessoais","keywords":["creme facial","creme corporal","creme para o corpo","protetor solar","perfume","perfumes","maquiagem"],"requireKnownBrand":false},"vestuario":{"label":"Roupas (sociais, casual, basicos)","keywords":["camisa social","camisa polo","camiseta polo","calca jeans","cueca boxer","cuecas boxer","meias"],"requireKnownBrand":false},"eletrodomesticos":{"label":"Eletrodomesticos","keywords":["geladeira","air fryer","micro-ondas","microondas","liquidificador"],"requireKnownBrand":false}},"knownBrands":["adidas","nike","vans","puma","lacoste","omo"],"universalKnownBrands":["adidas","nike","vans","puma","lacoste","samsung","lg","apple","iphone","xiaomi","motorola","sony","dell","lenovo","acer","asus","hp","positivo","multilaser","philips","britania","logitech","hyperx","razer","jbl","brastemp","consul","electrolux","mondial","cadence","arno","oster","xbox","playstation","nintendo","nivea","loreal","neutrogena","vichy","la roche-posay","eudora","natura","boticario","heinz"],"genericExcludeTerms":["kit variado","sortido","generico","diversos modelos","sem marca"],"allowlistProductIds":["43651013795","40050679056","20099237696","22399683615","23797465964","58207080817"],"allowlistKeywords":[]};

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function extractProduct(cardEl) {
    const titleEl = cardEl.querySelector(SELECTORS.title);
    const storeEl = cardEl.querySelector(SELECTORS.store);
    const discountEl = cardEl.querySelector(SELECTORS.discountBadge);
    const discountMatch = discountEl ? discountEl.textContent.match(/(\d+)/) : null;
    return {
      itemId: cardEl.getAttribute("data-item-id") || undefined,
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
      const container = document.querySelector(SELECTORS.listContainer);
      const sentinel = document.querySelector(SELECTORS.loadMoreSentinel);
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
      if (sentinel) {
        sentinel.scrollIntoView({ block: "end" });
      }
      if (!container && !sentinel) {
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

  async function sweepCurrentTab(log, removedLog, periodLabel, campaignName) {
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
      removedLog.push({
        campanha: campaignName || "",
        periodo: periodLabel || "",
        itemId: product.itemId || "",
        titulo: product.title,
        categoria: result.category || "",
        motivo: result.reason,
        modo: CONFIG.dryRun ? "dry-run" : "excluido",
      });
      removed++;
    }
    return removed;
  }

  function downloadRemovedLog(removedLog) {
    if (removedLog.length === 0) return;
    const header = ["campanha", "periodo", "itemId", "titulo", "categoria", "motivo", "modo"];
    const escapeCsv = (value) => `"${String(value).replace(/"/g, '""')}"`;
    const rows = removedLog.map((entry) => header.map((key) => escapeCsv(entry[key])).join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `shozap-filtro-log-${getLocalDateKey(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function findCampaigns() {
    const buttons = Array.from(document.querySelectorAll(SELECTORS.campaignMenuButton));
    const campaigns = [];
    for (const btn of buttons) {
      const onclick = btn.getAttribute("onclick") || "";
      const match = onclick.match(/toggleCardMenu\(event,\s*(\d+)\)/);
      if (!match) continue;
      const id = match[1];
      const titleEl = document.querySelector(`#title-${id}`);
      campaigns.push({ id, name: titleEl ? titleEl.textContent.trim() : `Campanha ${id}` });
    }
    return campaigns;
  }

  async function openCampaignQueue(id, log) {
    if (typeof window.verProdutos !== "function") {
      log(`Funcao verProdutos nao encontrada, nao consigo abrir a campanha ${id}.`);
      return false;
    }
    window.verProdutos(id);
    const maxTicks = Math.ceil(CONFIG.campaignOpenTimeoutMs / 150);
    for (let i = 0; i < maxTicks; i++) {
      await sleep(150);
      if (document.querySelector(SELECTORS.productCard) || findPeriodTabs().length > 0) {
        return true;
      }
    }
    log(`Painel da campanha ${id} nao carregou a tempo.`);
    return false;
  }

  function closeQueueModal() {
    if (typeof window.closeModal === "function") {
      window.closeModal("produtosModal");
      return true;
    }
    const closeBtn = document.querySelector(SELECTORS.closeModalButton);
    if (closeBtn) {
      closeBtn.click();
      return true;
    }
    return false;
  }

  async function sweepOpenQueue(log, removedLog, campaignName) {
    const tabs = findPeriodTabs();
    let totalRemoved = 0;
    if (tabs.length === 0) {
      totalRemoved += await sweepCurrentTab(log, removedLog, null, campaignName);
    } else {
      for (const tab of tabs) {
        const periodLabel = tab.textContent.trim();
        tab.click();
        await sleep(CONFIG.tabSwitchDelayMs);
        const removedInTab = await sweepCurrentTab(log, removedLog, periodLabel, campaignName);
        log(`Aba "${periodLabel}": ${removedInTab} item(ns) removido(s).`);
        totalRemoved += removedInTab;
      }
    }
    return totalRemoved;
  }

  async function runFilter(log) {
    if (!KEYWORD_CONFIG) {
      log("KEYWORD_CONFIG nao carregado, abortando.");
      return;
    }

    const removedLog = [];
    let totalRemoved = 0;
    const campaigns = findCampaigns();

    if (campaigns.length === 0) {
      log("Nenhuma campanha encontrada na tela, filtrando a fila ja aberta.");
      totalRemoved += await sweepOpenQueue(log, removedLog, null);
    } else {
      log(`${campaigns.length} campanha(s) encontrada(s): ${campaigns.map((c) => c.name).join(", ")}`);
      for (const campaign of campaigns) {
        log(`Abrindo campanha "${campaign.name}"...`);
        const opened = await openCampaignQueue(campaign.id, log);
        if (!opened) continue;
        const removedInCampaign = await sweepOpenQueue(log, removedLog, campaign.name);
        log(`Campanha "${campaign.name}": ${removedInCampaign} item(ns) removido(s).`);
        totalRemoved += removedInCampaign;
        closeQueueModal();
        await sleep(CONFIG.campaignSwitchDelayMs);
      }
    }

    log(`Concluido. Total removido: ${totalRemoved}.`);
    downloadRemovedLog(removedLog);
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
