const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { classify } = require("../shared/niche-filter.js");

const keywordConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../config/niche-keywords.json"), "utf8")
);

const cases = [
  { title: "Tenis Nike Revolution 6 Masculino", expectRelevant: true },
  { title: "Tenis generico corrida sem marca", expectRelevant: false },
  { title: "Teclado mecanico RGB para PC gamer", expectRelevant: true, expectCategory: "eletronicos_pc" },
  { title: "Whey Protein Concentrado 900g", expectRelevant: true, expectCategory: "academia_suplementos" },
  { title: "Sabao em po Omo 1kg", discountPercent: 10, expectRelevant: false },
  { title: "Sabao em po Omo 1kg", discountPercent: 30, expectRelevant: true, expectCategory: "limpeza_promocao" },
  { title: "Creme facial hidratante noturno", expectRelevant: true, expectCategory: "beleza" },
  { title: "Panela de pressao 5 litros", expectRelevant: false },
  {
    title: "Drone XT606: Cameras Duplas 4K 2 Baterias Gimbal De 3 Eixos Com Sistema Anti-Obstaculos Dobravel.",
    discountPercent: 51,
    expectRelevant: false,
  },
  {
    title: "Umidificador De Ar Condicionado Ventilador Portatil Led Sala De Estar Mesa De Escritorio",
    discountPercent: 67,
    expectRelevant: false,
  },
  {
    title: "Mini Ventilador Secado Portatil Para Extensao De Cilios Rosa/Branco Bivolt",
    discountPercent: 50,
    expectRelevant: false,
  },
  {
    title: "Par AutoFalante Automotivo Flex4 Triaxial- JBL 110W Rms",
    discountPercent: 60,
    expectRelevant: true,
  },
  { title: "Kit Super Energetico Pre Treino Natural em po", expectRelevant: true, expectCategory: "academia_suplementos" },
  {
    title: "Umidificador generico qualquer",
    itemId: "999",
    keywordConfigOverride: { allowlistProductIds: ["999"] },
    expectRelevant: true,
  },
  { title: "Geladeira Duplex Frost Free Brastemp 400L", expectRelevant: true },
  { title: "Mochila Nike Escolar Reforcada", expectRelevant: true },
  { title: "Jaqueta Corta Vento Impermeavel Adidas Masculina", expectRelevant: true },
  { title: "Ketchup Heinz 397g", expectRelevant: true },
  { title: "Console Xbox One 500GB", expectRelevant: true },
  { title: "Console PlayStation 5 Slim", expectRelevant: true },
  { title: "Air Fryer 5L Digital", expectRelevant: false },
  { title: "Kit Cuecas Boxer Adulto", expectRelevant: false },
  { title: "Protetor Solar Facial FPS 60", expectRelevant: true, expectCategory: "beleza" },
  { title: "Monitor Gamer 144hz Curvo", expectRelevant: true, expectCategory: "eletronicos_pc" },
  { title: "Placa de Video RTX 4060 8GB", expectRelevant: true, expectCategory: "eletronicos_pc" },
  { title: "SSD 1TB Nvme Leitura Rapida", expectRelevant: true, expectCategory: "eletronicos_pc" },
  { title: "Memoria RAM 16GB DDR4", expectRelevant: true, expectCategory: "eletronicos_pc" },
  { title: "Headset Gamer com Microfone", expectRelevant: true, expectCategory: "eletronicos_pc" },
  { title: "Perfumes Importados Diversos", expectRelevant: true, expectCategory: "beleza" },
];

let failures = 0;
for (const testCase of cases) {
  const config = testCase.keywordConfigOverride
    ? { ...keywordConfig, ...testCase.keywordConfigOverride }
    : keywordConfig;
  const result = classify(
    { title: testCase.title, discountPercent: testCase.discountPercent, itemId: testCase.itemId },
    config
  );
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
