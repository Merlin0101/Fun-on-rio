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
