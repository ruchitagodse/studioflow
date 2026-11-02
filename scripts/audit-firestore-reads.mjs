import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(join(dir, entry.name)) : /\.tsx?$/.test(entry.name) ? [join(dir, entry.name)] : []);
}
const report = { polling: [], browserFirestore: [], documentReads: [], boundedQueries: [], aggregateQueries: [], referenceReads: [], catalogScans: [], pagedQueries: [], transactions: [] };
for (const path of [...files("app"), ...files("lib")]) {
  const source = readFileSync(path, "utf8");
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const name = relative(process.cwd(), path).replaceAll("\\", "/");
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression.getText(tree);
      const location = `${name}:${tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1}`;
      if (/(^|\.)setInterval$/.test(expression)) report.polling.push(location);
      if (/(^|\.)onSnapshot$/.test(expression)) report.browserFirestore.push(location);
      if (expression === "readDocument") report.documentReads.push(location);
      if (expression === "readPage") report.pagedQueries.push(location);
      if (expression.endsWith(".runTransaction")) report.transactions.push(location);
      if (expression === "readQuery") {
        const query = node.arguments[0]?.getText(tree) ?? "";
        const group = /\.(count|aggregate)\(/.test(query) ? "aggregateQueries" : /\.limit\(/.test(query) ? "boundedQueries" : /\.collection\(/.test(query) ? "catalogScans" : "referenceReads";
        report[group].push({ location, query });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
}
console.log(JSON.stringify({ summary: Object.fromEntries(Object.entries(report).map(([key, values]) => [key, values.length])), ...report }, null, 2));
