import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import ts from "typescript";

// Ignore only the two readout text styles and their typography imports.
// All controls, copy, event handlers,
// state guards and positioning expressions must still match the checkpoint.
export function controlStructureDigest(source) {
  const file = ts.createSourceFile(
    "SlotControls.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let readoutStyles = 0;
  const result = ts.transform(file, [
    (context) => {
      function visit(node) {
        if (
          ts.isImportDeclaration(node) &&
          node.moduleSpecifier.text === "./typography"
        )
          return undefined;
        if (
          ts.isImportDeclaration(node) &&
          node.moduleSpecifier.text === "./layout"
        ) {
          const bindings = node.importClause.namedBindings;
          const names = bindings.elements.filter(
            (s) => s.name.text !== "controlAmountSize",
          );
          return ts.factory.updateImportDeclaration(
            node,
            node.modifiers,
            ts.factory.updateImportClause(
              node.importClause,
              node.importClause.isTypeOnly,
              node.importClause.name,
              ts.factory.updateNamedImports(bindings, names),
            ),
            node.moduleSpecifier,
            node.attributes,
          );
        }
        if (
          ts.isJsxOpeningElement(node) &&
          node.tagName.getText(file) === "strong" &&
          node.attributes.properties.some(
            (a) =>
              ts.isJsxAttribute(a) && a.name.getText(file) === "data-testid",
          )
        ) {
          const attributes = node.attributes.properties.filter((a) => {
            if (ts.isJsxAttribute(a) && a.name.getText(file) === "style") {
              readoutStyles++;
              return false;
            }
            return true;
          });
          return ts.factory.updateJsxOpeningElement(
            node,
            node.tagName,
            node.typeArguments,
            ts.factory.updateJsxAttributes(node.attributes, attributes),
          );
        }
        return ts.visitEachChild(node, visit, context);
      }
      return (root) => ts.visitNode(root, visit);
    },
  ]);
  assert.equal(
    readoutStyles,
    2,
    "Only Balance/Win and Bet text styles may differ",
  );
  const normalized = ts
    .createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed })
    .printFile(result.transformed[0]);
  result.dispose();
  return createHash("sha256").update(normalized).digest("hex");
}
