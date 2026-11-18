import fs from "node:fs";
import path from "node:path";
import { jarenVoor, leesJaar } from "./jaar.js";

const root = process.cwd();
export const locaties = () => JSON.parse(fs.readFileSync(path.join(root, "data/locaties.json"), "utf8"))
  .filter((l) => l.rws?.getij && fs.existsSync(path.join(root, `data/metingen/${l.slug}.json`)));

// Gemiddeld getijverschil (hoogwater min gemiddelde van de omliggende laagwaters) per meetpunt
export function gemiddeldVerschil(code) {
  const jaar = jarenVoor(code).at(-1);
  if (!jaar) return null;
  const e = leesJaar(code, jaar).ext;
  const r = [];
  for (let i = 1; i < e.length - 1; i++) {
    if (e[i][2] === "H" && e[i - 1][2] === "L" && e[i + 1][2] === "L") r.push(e[i][1] - (e[i - 1][1] + e[i + 1][1]) / 2);
  }
  return r.length ? { jaar, cm: Math.round(r.reduce((a, b) => a + b, 0) / r.length) } : null;
}

// Per plaats het gemiddelde getijverschil, gesorteerd van groot naar klein
export function verschilTabel() {
  return locaties()
    .map((l) => ({ l, v: gemiddeldVerschil(l.rws.getij.code) }))
    .filter((x) => x.v)
    .sort((a, b) => b.v.cm - a.v.cm);
}

// Springtij- en doodtijdagen: dagen met het grootste/kleinste getijverschil binnen ±5 dagen
export function springDood(code, vanaf, aantal = 6) {
  const jaar = jarenVoor(code).at(-1);
  if (!jaar) return [];
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" });
  const perDag = new Map();
  for (const [t, v] of leesJaar(code, jaar).ext) {
    const k = fmt.format(new Date(t));
    if (!perDag.has(k)) perDag.set(k, []);
    perDag.get(k).push(v);
  }
  const dagen = [...perDag.entries()].filter(([, v]) => v.length >= 3).map(([k, v]) => ({ k, r: Math.max(...v) - Math.min(...v) }));
  const uit = [];
  for (let i = 5; i < dagen.length - 5; i++) {
    const venster = dagen.slice(i - 5, i + 6).map((d) => d.r);
    if (dagen[i].k < vanaf) continue;
    if (dagen[i].r === Math.max(...venster)) uit.push({ soort: "springtij", ...dagen[i] });
    else if (dagen[i].r === Math.min(...venster)) uit.push({ soort: "doodtij", ...dagen[i] });
    if (uit.length >= aantal) break;
  }
  return uit;
}

// Hoogwatertijden langs de kust op één dag: laat zien hoe de getijgolf loopt
export function getijgolf(codes, dag) {
  return codes.map(({ code, naam, slug }) => {
    const jaar = jarenVoor(code).at(-1);
    if (!jaar) return null;
    const hw = leesJaar(code, jaar).ext.find((e) => e[2] === "H" && e[0] >= `${dag}T04:00`);
    return hw ? { naam, slug, t: hw[0] } : null;
  }).filter(Boolean);
}
