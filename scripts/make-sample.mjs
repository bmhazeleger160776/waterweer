// Maakt VOORBEELDDATA voor Vlissingen, zodat de pagina te bekijken is zonder RWS-verbinding.
// Dit is een gesimuleerd getij (geen echte voorspelling). De pagina toont dan een duidelijke melding.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { curveUitExtremen } from "./fetch-rws.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const start = new Date(); start.setUTCHours(0, 0, 0, 0); start.setUTCHours(-2);
const reeks = [];
for (let i = 0; i <= 8 * 144; i++) {
  const t = new Date(start.getTime() + i * 600_000);
  const uur = i / 6;
  // M2 (12,42 u) + S2 (12 u) + kleine M4-vervorming; waarden in cm NAP
  const v = 190 * Math.cos((2 * Math.PI * (uur - 3)) / 12.42) + 45 * Math.cos((2 * Math.PI * uur) / 12) +
    18 * Math.cos((2 * Math.PI * (uur - 1)) / 6.21) + 15;
  reeks.push({ t: t.toISOString(), v: Math.round(v) });
}
// lokale extremen (±3 uur) uit de gesimuleerde reeks
const extremen = [];
for (let i = 18; i < reeks.length - 18; i++) {
  const w = reeks.slice(i - 18, i + 19).map((p) => p.v);
  const soort = reeks[i].v === Math.max(...w) ? "HW" : reeks[i].v === Math.min(...w) ? "LW" : null;
  if (soort && (!extremen.length || extremen.at(-1).soort !== soort)) extremen.push({ soort, ...reeks[i] });
}
const nu = reeks.find((p) => Date.parse(p.t) >= Date.now()) || reeks.at(-1);
const data = {
  slug: "vlissingen",
  voorbeeld: true,
  bijgewerkt: new Date().toISOString(),
  fouten: [],
  getij: { meetpunt: "vlissingen", eenheid: "cm NAP", extremen, reeks: curveUitExtremen(extremen) },
  temperatuur: { meetpunt: "vlissingen", meetpuntNaam: "Vlissingen", eenheid: "°C", t: new Date(Date.now() - 20 * 60000).toISOString(), v: 11.4 },
  waterstand: { meetpunt: "vlissingen", meetpuntNaam: "Vlissingen", eenheid: "cm NAP", t: nu.t, v: nu.v + 6 },
};
fs.mkdirSync(path.join(ROOT, "data/metingen"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "data/metingen/vlissingen.json"), JSON.stringify(data, null, 1));
console.log(`Voorbeelddata geschreven: ${extremen.length} hoog-/laagwaters`);
