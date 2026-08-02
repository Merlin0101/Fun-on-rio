const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const template = fs.readFileSync(
  path.join(root, "userscripts/shozap-filter.template.user.js"),
  "utf8"
);
const nicheFilterSource = fs.readFileSync(path.join(root, "shared/niche-filter.js"), "utf8");
const keywordConfig = fs.readFileSync(path.join(root, "config/niche-keywords.json"), "utf8");

const output = template
  .replace("/* __NICHE_FILTER_MODULE__ */", nicheFilterSource.trim())
  .replace("/* __NICHE_KEYWORDS__ */ null", JSON.stringify(JSON.parse(keywordConfig)));

const outPath = path.join(root, "userscripts/dist/shozap-filter.user.js");
fs.writeFileSync(outPath, output);
console.log("Gerado:", path.relative(root, outPath));
