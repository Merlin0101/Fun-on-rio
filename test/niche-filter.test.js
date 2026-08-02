const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { classify } = require("../shared/niche-filter.js");

const keywordConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../config/niche-keywords.json"), "utf8")
);

const cases = [
  { title: "Tenis Nike Revolution 6 Masculino", expectRelevant: true, expectCategory: "tenis_marcas" },
  { title: "Tenis generico corrida sem marca", expectRelevant: false },
  { title: "Teclado mecanico RGB para PC gamer", expectRelevant: true, expectCategory: "eletronicos_pc" },
  { title: "Whey Protein Concentrado 900g", expectRelevant: true, expectCategory: "academia_suplementos" },
  { title: "Sabao em po Omo 1kg", expectRelevant: false },
  { title: "Sabao em po Omo 1kg - 30% OFF hoje", expectRelevant: true, expectCategory: "limpeza_promocao" },
  { title: "Creme facial hidratante noturno", expectRelevant: true, expectCategory: "beleza" },
  { title: "Panela de pressao 5 litros", expectRelevant: false },
];

let failures = 0;
for (const testCase of cases) {
  const result = classify({ title: testCase.title }, keywordConfig);
  const ok =
    result.relevant === testCase.expectRelevant &&
    (testCase.expectCategory === undefined || result.category === testCase.expectCategory);
  if (!ok) {
    failures++;
    console.error(`FALHOU: "${testCase.title}" ->`, result, "esperado:", testCase);
  } else {
    console.log(`OK: "${testCase.title}" -> relevant=${result.relevant} category=${result.category}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} teste(s) falharam.`);
  process.exit(1);
}
console.log("\nTodos os testes passaram.");
