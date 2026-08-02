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
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

    for (const term of keywordConfig.genericExcludeTerms || []) {
      if (containsKeyword(haystack, term)) {
        return { relevant: false, category: null, reason: "termo_generico:" + term };
      }
    }

    for (const [categoryId, category] of Object.entries(keywordConfig.categories)) {
      const matchedKeyword = (category.keywords || []).find((kw) => containsKeyword(haystack, kw));
      if (!matchedKeyword) continue;

      if (category.requireKnownBrand) {
        const brands = category.brands || keywordConfig.knownBrands || [];
        const matchedBrand = brands.find((brand) => containsKeyword(haystack, brand));
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

  return { classify, normalize, hasPromotionSignal, containsKeyword };
});
