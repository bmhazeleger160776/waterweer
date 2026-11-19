// Bepaalt of er nu (of volgens de verwachting) hoogwater is op de rivieren of opwaaiing aan de kust.
// Wordt gebruikt door /hoogwater en door de melding bovenaan elke pagina.
//
// Grenzen:
// - Rijn bij Lobith: vanaf ~12 m +NAP lopen de uiterwaarden onder, vanaf 13 m +NAP geeft Rijkswaterstaat code geel.
// - Maas bij Venlo: bij code groen (okt 2024) ~13,7 m +NAP, bij code geel (jan 2024) ~15,4 m +NAP.
// - Kust: gemeten waterstand minstens 80 cm boven het voorspelde getij = flinke opwaaiing door storm.
import fs from "node:fs";
import path from "node:path";

const RIVIER_PUNTEN = [
  { rivier: "Rijn", hub: "rijn", slug: "lobith", naam: "Lobith", verhoogd: 1200, hoog: 1300 },
  { rivier: "Maas", hub: "maas", slug: "venlo", naam: "Venlo", verhoogd: 1350, hoog: 1500 },
];
const KUST_OPZET = 80;

let cache;
export function hoogwaterStatus() {
  if (cache) return cache;
  const root = process.cwd();
  const lees = (slug) => {
    const f = path.join(root, `data/metingen/${slug}.json`);
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
  };
  const niveau = (v, p) => (v >= p.hoog ? "hoog" : v >= p.verhoogd ? "verhoogd" : "normaal");

  const rivieren = RIVIER_PUNTEN.map((p) => {
    const ws = lees(p.slug)?.waterstand;
    if (!ws) return null;
    const vw = (ws.verwachting ?? []).filter((x) => Date.parse(x.t) > Date.parse(ws.t));
    const piek = vw.length ? vw.reduce((a, b) => (b.v > a.v ? b : a)) : null;
    const max = Math.max(ws.v, piek?.v ?? -1e9);
    return { ...p, ws, piek, reeks: ws.reeks ?? [], vw, nu: niveau(ws.v, p), verwacht: niveau(max, p) };
  }).filter(Boolean);

  const alle = JSON.parse(fs.readFileSync(path.join(root, "data/locaties.json"), "utf8"));
  // Alleen plaatsen waar waterstand en getijvoorspelling van hetzelfde meetpunt komen.
  // Anders vergelijk je appels met peren (bijv. een wadmeetpunt dat bij eb droogvalt).
  const kust = alle.filter((l) => l.rws?.getij && l.rws?.waterstand?.code === l.rws.getij.code).map((l) => {
    const d = lees(l.slug);
    if (!d?.waterstand || !d.getij?.reeks?.length) return null;
    const tm = Date.parse(d.waterstand.t);
    if (Date.now() - tm > 6 * 3600e3) return null;
    const p = d.getij.reeks.reduce((a, b) => (Math.abs(Date.parse(b.t) - tm) < Math.abs(Date.parse(a.t) - tm) ? b : a));
    if (Math.abs(Date.parse(p.t) - tm) > 30 * 60e3) return null;
    return { l, ws: d.waterstand, opzet: Math.round(d.waterstand.v - p.v) };
  }).filter(Boolean).sort((a, b) => b.opzet - a.opzet);
  const kustHoog = kust.filter((k) => k.opzet >= KUST_OPZET);
  // Eén afwijkend meetpunt is eerder een storing dan storm: pas melden bij minstens 2 meetpunten.
  const kustActief = new Set(kustHoog.map((k) => k.l.rws.getij.code)).size >= 2;

  const rivierActief = rivieren.filter((r) => r.verwacht !== "normaal");
  const actief = rivierActief.length > 0 || kustActief;
  const onderwerpen = [...rivierActief.map((r) => r.rivier), ...(kustActief ? ["kust"] : [])];
  cache = { actief, rivieren, rivierActief, kust, kustHoog, kustActief, onderwerpen, grens: KUST_OPZET };
  return cache;
}
