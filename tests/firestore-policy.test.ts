import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(join(dir, entry.name)) : /\.tsx?$/.test(entry.name) ? [join(dir, entry.name)] : []);
}

describe("Firestore read budget regression policy", () => {
  it("has no global polling or browser Firestore listeners", () => {
    for (const path of [...files("app"), ...files("lib")]) {
      const source = readFileSync(path, "utf8");
      expect(source, path).not.toMatch(/\bsetInterval\s*\(/);
      expect(source, path).not.toMatch(/from ["']firebase\/firestore["']/);
      expect(source, path).not.toMatch(/\bonSnapshot\s*\(/);
    }
  });
  it("routes SDK reads and transactions through the centralized quota boundary", () => {
    const unguarded: string[] = [];
    for (const path of [...files("app"), ...files("lib")]) {
      if (path.endsWith(join("firebase", "reads.ts"))) continue;
      const tree = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
      function visit(node: ts.Node) {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
          if (node.expression.name.text === "get" && node.arguments.length === 0) unguarded.push(path);
          if (node.expression.name.text === "runTransaction") {
            let parent: ts.Node | undefined = node.parent;
            while (parent && !(ts.isCallExpression(parent) && parent.expression.getText(tree) === "withFirestoreQuota")) parent = parent.parent;
            if (!parent) unguarded.push(path);
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(tree);
    }
    expect(unguarded).toEqual([]);
  });
});
