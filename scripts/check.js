const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { HtmlValidate } = require("html-validate");
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (
      ["node_modules", ".git", ".runtime", ".vscode", "test-results"].includes(
        entry.name,
      )
    )
      return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}
async function main() {
  let failures = 0;
  const all = files(".");
  for (const file of all.filter((file) => /\.(js|cjs)$/.test(file))) {
    const result = spawnSync(process.execPath, ["--check", file], {
      encoding: "utf8",
    });
    if (result.status) {
      console.error(result.stderr);
      failures++;
    }
  }
  const validator = new HtmlValidate({
    extends: ["html-validate:recommended"],
    rules: {
      "no-trailing-whitespace": "off",
      "svg-focusable": "off",
      "long-title": "off",
      "no-redundant-for": "off",
    },
  });
  for (const file of all.filter((file) => /\.html$/.test(file))) {
    const report = await validator.validateFile(file);
    if (!report.valid) {
      failures++;
      for (const result of report.results)
        for (const error of result.messages)
          console.error(
            `${file}:${error.line}: ${error.message} (${error.ruleId})`,
          );
    }
  }
  for (const file of all.filter(file => /\.json$/.test(file))) JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  console.log(
    `Syntax, HTML and JSON checks: ${failures ? `${failures} failed` : "passed"}.`,
  );
  process.exitCode = failures ? 1 : 0;
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
