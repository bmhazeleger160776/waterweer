import fs from "node:fs";
import path from "node:path";

// Jaren met een complete getijtabel voor een meetpunt
export function jarenVoor(code) {
  const map = path.join(process.cwd(), "data/metingen/jaar");
  if (!code || !fs.existsSync(map)) return [];
  return fs.readdirSync(map).filter((j) => /^\d{4}$/.test(j)).filter((j) => {
    const f = path.join(map, j, `${code}.json`);
    return fs.existsSync(f) && JSON.parse(fs.readFileSync(f, "utf8")).compleet;
  }).filter((j) => Number(j) >= new Date().getUTCFullYear()).sort();
}

// Alle bekende extremen (jaardata + actuele data) tussen twee tijdstippen, als { t, v, soort }
export function extremenTussen(code, actueel, van, tot) {
  const map = path.join(process.cwd(), "data/metingen/jaar");
  const perTijd = new Map();
  if (fs.existsSync(map)) {
    for (const j of fs.readdirSync(map)) {
      const f = path.join(map, j, `${code}.json`);
      if (!fs.existsSync(f)) continue;
      for (const [t, v, s] of JSON.parse(fs.readFileSync(f, "utf8")).ext) {
        if (t >= van && t <= tot) perTijd.set(t, { t, v, soort: s === "H" ? "HW" : "LW" });
      }
    }
  }
  for (const e of actueel || []) if (e.t >= van && e.t <= tot) perTijd.set(e.t, e);
  return [...perTijd.values()].sort((a, b) => a.t.localeCompare(b.t));
}

export function leesJaar(code, jaar) {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/metingen/jaar", String(jaar), `${code}.json`), "utf8"));
}

// Jaren waarvoor een landelijke getijtabel-pagina (/getijtabel/<jaar>) bestaat: minstens 10 complete meetpunten
let hubCache;
export function hubJaren() {
  if (hubCache) return hubCache;
  const map = path.join(process.cwd(), "data/metingen/jaar");
  if (!fs.existsSync(map)) return [];
  const huidig = new Date().getUTCFullYear();
  const hub = fs.readdirSync(map).filter((j) => /^\d{4}$/.test(j) && Number(j) >= huidig).filter((j) =>
    fs.readdirSync(path.join(map, j)).filter((f) => f.endsWith(".json")).filter((f) => JSON.parse(fs.readFileSync(path.join(map, j, f), "utf8")).compleet).length >= 10
  ).sort();
  hubCache = hub;
  return hub;
}
