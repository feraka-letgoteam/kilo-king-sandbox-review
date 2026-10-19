// Source-only author cascade for the production control audit. This does not
// implement a browser or render pixels. Selectors come from Lightning CSS's
// parser; specificity, layers, state, inheritance and inline styles are applied
// to the real server-rendered elements. Unsupported matching conditions fail.
import assert from "node:assert/strict";
import postcss from "postcss";
import { transform } from "lightningcss";

const cache = new Map();
function selectors(source) {
  if (!cache.has(source)) {
    let parsed;
    transform({
      code: Buffer.from(`${source}{color:red}`),
      visitor: {
        Rule(rule) {
          if (rule.type === "style") parsed = rule.value.selectors;
        },
      },
    });
    cache.set(source, parsed);
  }
  return cache.get(source);
}
const sum = (a, b) => a.map((v, i) => v + b[i]);
const compare = (a, b) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
};
function specificity(parts) {
  return parts.reduce(
    (s, p) =>
      sum(
        s,
        p.type === "id"
          ? [1, 0, 0]
          : p.type === "class" || p.type === "attribute"
            ? [0, 1, 0]
            : p.type === "type" || p.type === "pseudo-element"
              ? [0, 0, 1]
              : p.type === "pseudo-class"
                ? p.kind === "where"
                  ? [0, 0, 0]
                  : p.selectors
                    ? p.selectors.map(specificity).sort(compare).at(-1)
                    : [0, 1, 0]
                : [0, 0, 0],
      ),
    [0, 0, 0],
  );
}
function ancestors(n) {
  const a = [];
  while (n.parent) {
    n = n.parent;
    a.push(n);
  }
  return a;
}
const descendants = (n) => n.children.flatMap((c) => [c, ...descendants(c)]);
function compound(parts, node, state, pseudo) {
  // Cheap constraints first, so unrelated application selectors are excluded
  // before interpreting their state conditions.
  const ps = parts.filter((p) => p.type.startsWith("pseudo"));
  for (const p of parts.filter((p) => !p.type.startsWith("pseudo"))) {
    if (p.type === "universal") continue;
    if (p.type === "type" && node.tag !== p.name) return false;
    if (
      p.type === "class" &&
      !(node.attrs.class ?? "").split(/\s+/).includes(p.name)
    )
      return false;
    if (p.type === "id" && node.attrs.id !== p.name) return false;
    if (p.type === "attribute") {
      const v = node.attrs[p.name];
      if (v === undefined) return false;
      if (p.operation) {
        let a = v,
          b = p.operation.value;
        if (p.operation.caseSensitivity === "ascii-case-insensitive") {
          a = a.toLowerCase();
          b = b.toLowerCase();
        }
        const op = p.operation.operator;
        const ok =
          op === "equal"
            ? a === b
            : op === "includes"
              ? a.split(/\s+/).includes(b)
              : op === "prefix"
                ? a.startsWith(b)
                : op === "suffix"
                  ? a.endsWith(b)
                  : op === "substring"
                    ? a.includes(b)
                    : op === "dash-match"
                      ? a === b || a.startsWith(b + "-")
                      : null;
        assert.notEqual(ok, null, `Unsupported attribute operator ${op}`);
        if (!ok) return false;
      }
    }
    assert(
      ["universal", "type", "class", "id", "attribute"].includes(p.type),
      `Unsupported selector ${p.type}`,
    );
  }
  if (!ps.some((p) => p.type === "pseudo-element") && pseudo) return false;
  for (const p of ps) {
    if (p.type === "pseudo-element") {
      if (p.kind !== pseudo) return false;
      continue;
    }
    const k = p.kind;
    if (["is", "where", "not"].includes(k)) {
      const matched = p.selectors.some((s) => matches(s, node, state, null));
      if (k === "not" ? matched : !matched) return false;
    } else if (k === "has") {
      if (
        !descendants(node).some((n) =>
          p.selectors.some((s) => matches(s, n, state, null)),
        )
      )
        return false;
    } else if (k === "disabled" || k === "enabled") {
      const enabled = [
        "button",
        "input",
        "select",
        "textarea",
        "option",
      ].includes(node.tag);
      const disabled = enabled && "disabled" in node.attrs;
      if (k === "disabled" ? !disabled : !enabled || disabled) return false;
    } else if (
      ["hover", "focus", "focus-visible", "active", "focus-within"].includes(k)
    ) {
      if (!state.get(node)?.has(k)) return false;
    } else if (k === "root") {
      if (node.parent) return false;
    } else if (k === "custom" && p.name === "-moz-focusring") {
      if (!state.get(node)?.has("focus-visible")) return false;
    } else if (k === "custom" && p.name === "-moz-ui-invalid") return false;
    else if (k === "first-child") {
      if (node.parent?.children[0] !== node) return false;
    } else if (k === "last-child") {
      if (node.parent?.children.at(-1) !== node) return false;
    } else if (k.startsWith("nth-")) {
      let siblings = node.parent?.children ?? [];
      if (k.endsWith("of-type"))
        siblings = siblings.filter((n) => n.tag === node.tag);
      if (p.of)
        siblings = siblings.filter((n) =>
          p.of.some((s) => matches(s, n, state)),
        );
      let i = siblings.indexOf(node) + 1;
      if (k.includes("last")) i = siblings.length - i + 1;
      if (
        p.a === 0
          ? i !== p.b
          : (i - p.b) / p.a < 0 || !Number.isInteger((i - p.b) / p.a)
      )
        return false;
    } else if (k === "empty") {
      if (node.children.length || node.text) return false;
    } else if (
      [
        "host",
        "host-context",
        "checked",
        "link",
        "any-link",
        "visited",
        "autofill",
        "placeholder-shown",
        "indeterminate",
        "modal",
        "open",
        "popover-open",
      ].includes(k)
    )
      return false;
    else
      throw new Error(
        `Unsupported matching pseudo-class ${k} on ${node.tag}.${node.attrs.class}`,
      );
  }
  return true;
}
function matches(selector, node, state, pseudo = null) {
  let at = selector.length - 1;
  while (at >= 0 && selector[at].type !== "combinator") at--;
  if (!compound(selector.slice(at + 1), node, state, pseudo)) return false;
  if (at < 0) return true;
  const left = selector.slice(0, at),
    kind = selector[at].value;
  if (kind === "child")
    return !!node.parent && matches(left, node.parent, state);
  if (kind === "descendant")
    return ancestors(node).some((n) => matches(left, n, state));
  const siblings = node.parent?.children ?? [],
    i = siblings.indexOf(node);
  if (kind === "next-sibling")
    return i > 0 && matches(left, siblings[i - 1], state);
  if (kind === "later-sibling")
    return siblings.slice(0, i).some((n) => matches(left, n, state));
  throw new Error(`Unsupported combinator ${kind}`);
}
function media(query, viewport, hover) {
  return query.split(",").some((branch) => {
    let q = branch.replace(/\s+/g, "");
    if (q.includes("prefers-reduced-motion:reduce")) return false;
    if (q.includes("hover:hover") && !hover) return false;
    if (q.includes("hover:none") && hover) return false;
    if (q.includes("prefers-color-scheme:dark")) return false;
    if (q.includes("print")) return false;
    if (q.includes("orientation:portrait") && viewport[0] > viewport[1])
      return false;
    if (q.includes("orientation:landscape") && viewport[0] <= viewport[1])
      return false;
    for (const m of q.matchAll(
      /\((min|max)-(width|height):([\d.]+)(px|rem)\)/g,
    )) {
      const v = viewport[m[2] === "width" ? 0 : 1],
        n = Number(m[3]) * (m[4] === "rem" ? 16 : 1);
      if (m[1] === "min" ? v < n : v > n) return false;
    }
    for (const m of q.matchAll(
      /\((width|height)(>=|<=|>|<)([\d.]+)(px|rem)\)/g,
    )) {
      const v = viewport[m[1] === "width" ? 0 : 1],
        n = Number(m[3]) * (m[4] === "rem" ? 16 : 1);
      if (
        !(m[2] === ">="
          ? v >= n
          : m[2] === "<="
            ? v <= n
            : m[2] === ">"
              ? v > n
              : v < n)
      )
        return false;
    }
    return true;
  });
}
export function prepareTree(node, parent = null) {
  node.parent = parent;
  node.children ??= [];
  for (const c of node.children) prepareTree(c, node);
  return node;
}
export function variables(value, vars) {
  for (let i = 0; i < 30 && value.includes("var("); i++) {
    const next = value.replace(
      /var\((--[\w-]+)(?:,\s*([^()]+))?\)/g,
      (_, k, f) => vars[k] ?? f ?? `UNRESOLVED(${k})`,
    );
    assert.notEqual(next, value, `Unresolved or cyclic variable: ${value}`);
    value = next;
  }
  assert(!/var\(|UNRESOLVED/.test(value), `Unresolved variable ${value}`);
  return value;
}
function expand(prop, value) {
  const parts = value.trim().split(/\s+/),
    result = [[prop, value]];
  const four = (prefix, suffix = "") =>
    ["top", "right", "bottom", "left"].map((side, i) => [
      `${prefix}-${side}${suffix}`,
      parts[[0, 1, 2, 3][i]] ?? parts[i === 2 ? 0 : 1] ?? parts[0],
    ]);
  if (prop === "background")
    return [
      ...result,
      ["background-color", value],
      ["background-image", "none"],
    ];
  if (prop === "border")
    return [
      ...result,
      ...["top", "right", "bottom", "left"].flatMap((s) => [
        [`border-${s}-width`, parts[0]],
        [`border-${s}-style`, parts[1] ?? "none"],
        [`border-${s}-color`, parts.slice(2).join(" ") || "currentColor"],
      ]),
    ];
  if (
    prop === "border-width" ||
    prop === "border-color" ||
    prop === "border-style"
  )
    return [...result, ...four("border", `-${prop.slice(7)}`)];
  if (["padding", "margin"].includes(prop)) return [...result, ...four(prop)];
  if (prop === "inset")
    return [
      ...result,
      ...["top", "right", "bottom", "left"].map((s, i) => [
        s,
        parts[i] ?? parts[i === 2 ? 0 : 1] ?? parts[0],
      ]),
    ];
  if (prop === "outline")
    return [
      ...result,
      ["outline-width", parts[0]],
      ["outline-style", parts[1] ?? "none"],
      ["outline-color", parts.slice(2).join(" ")],
    ];
  return result;
}
export function productionCascade(cssText) {
  const rules = [],
    root = postcss.parse(cssText),
    layers = [],
    candidates = new WeakMap();
  root.walkAtRules("layer", (n) => {
    for (const name of n.params.split(",")) {
      const v = name.trim();
      if (!layers.includes(v)) layers.push(v);
    }
  });
  root.walkRules((r) => {
    let p = r.parent,
      layer = null,
      conditions = [],
      skip = false;
    while (p && p.type !== "root") {
      if (p.type === "atrule") {
        if (p.name.includes("keyframes")) skip = true;
        else if (p.name === "layer") layer = p.params;
        else conditions.push([p.name, p.params]);
      }
      p = p.parent;
    }
    if (skip) return;
    const declarations = r.nodes.filter((n) => n.type === "decl");
    if (!declarations.length) return;
    for (const s of selectors(r.selector))
      rules.push({
        s,
        specificity: specificity(s),
        selector: r.selector,
        layer,
        conditions,
        declarations,
        order: rules.length,
      });
  });
  return (
    node,
    { viewport, state = new Map(), hover = true, pseudo = null } = {},
  ) => {
    const selected = [];
    if (!candidates.has(node))
      candidates.set(
        node,
        rules.filter((r) => {
          let at = r.s.length - 1;
          while (at >= 0 && r.s[at].type !== "combinator") at--;
          return compound(
            r.s.slice(at + 1).filter((p) => !p.type.startsWith("pseudo")),
            node,
            new Map(),
            null,
          );
        }),
      );
    for (const r of candidates.get(node)) {
      if (!matches(r.s, node, state, pseudo)) continue;
      let ok = true;
      for (const [name, query] of r.conditions) {
        if (name === "media") ok &&= media(query, viewport, hover);
        else if (name === "supports") {
          // All audited styles use supported modern CSS.
          assert(
            !query.startsWith("not"),
            `Review conditional support: ${query}`,
          );
        } else
          throw new Error(
            `Unsupported matching @${name} ${query}: ${r.selector}`,
          );
      }
      if (!ok) continue;
      for (const d of r.declarations)
        selected.push({
          prop: d.prop,
          value: d.value,
          source: r.selector,
          rank: [
            d.important ? 1 : 0,
            d.important
              ? r.layer
                ? layers.length - layers.indexOf(r.layer)
                : 0
              : r.layer
                ? layers.indexOf(r.layer) + 1
                : layers.length + 1,
            0,
            ...r.specificity,
            r.order,
          ],
        });
    }
    if (!pseudo && node.attrs.style) {
      postcss
        .parse(`x{${node.attrs.style}}`)
        .first.nodes.forEach((d) =>
          selected.push({
            prop: d.prop,
            value: d.value,
            source: "inline style",
            rank: [
              d.important ? 1 : 0,
              layers.length + 2,
              1,
              0,
              0,
              0,
              Infinity,
            ],
          }),
        );
    }
    // SVG presentation attributes are author declarations of specificity zero.
    if (!pseudo)
      for (const p of ["color", "fill", "stroke", "stroke-width", "opacity"])
        if (node.attrs[p])
          selected.unshift({
            prop: p,
            value: node.attrs[p],
            source: "SVG presentation attribute",
            rank: [0, 0, 0, 0, 0, 0, -1],
          });
    const values = {},
      winners = {};
    for (const d of selected.sort((a, b) => compare(a.rank, b.rank)))
      for (const [k, v] of expand(d.prop, d.value)) {
        values[k] = v;
        winners[k] = { selector: d.source, value: v };
      }
    return { values, winners };
  };
}
export function resolveTree(tree, cascade, context) {
  const styles = new Map();
  function visit(n, parent) {
    const raw = cascade(n, context),
      vars = { ...parent?.vars };
    for (const [k, v] of Object.entries(raw.values))
      if (k.startsWith("--")) vars[k] = v;
    const values = {
      opacity: "1",
      filter: "none",
      "backdrop-filter": "none",
      transform: "none",
      "box-shadow": "none",
      "background-color": "transparent",
      "background-image": "none",
      "box-sizing": "content-box",
      "outline-width": "0",
      "outline-offset": "0",
    };
    for (const p of [
      "color",
      "font-size",
      "font-family",
      "font-weight",
      "font-variant-numeric",
      "stroke-width",
      "fill",
      "stroke",
    ])
      if (parent?.values[p]) values[p] = parent.values[p];
    for (const [k, v] of Object.entries(raw.values))
      if (!k.startsWith("--"))
        values[k] = v === "inherit" ? parent?.values[k] : variables(v, vars);
    const s = { values, vars, winners: raw.winners };
    styles.set(n, s);
    for (const c of n.children) visit(c, s);
  }
  visit(tree);
  return styles;
}
