// Haalt de berekende hoog- en laagwaters (astronomisch getij) voor een heel jaar op,
// per RWS-meetpunt, en schrijft data/metingen/jaar/<jaar>/<meetpunt>.json.
// Draait mee met het uurlijkse ophalen, maar doet alleen iets als een jaar nog
// ontbreekt of onvolledig is (en dan hooguit één poging per 20 uur per meetpunt).
//
// Gebruik: node scripts/fetch-jaar.mjs          (huidig en volgend jaar)
//          node scripts/fetch-jaar.mjs 2027     (alleen 2027)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { koppelExtremen } from "./fetch-rws.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCATIES = JSON.parse(fs.readFileSync(path.join(ROOT, "data/locaties.json"), "utf8"));
const BASE = "https://ddapi20-waterwebservices.rijkswaterstaat.nl";
const PAD = "/ONLINEWAARNEMINGENSERVICES/OphalenWaarnemingen";
const iso = (d) => d.toISOString().replace("Z", "+00:00");

async function post(body) {
  let fout;
  for (let poging = 0; poging < 3; poging++) {
    try {
      const res = await fetch(BASE + PAD, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
      const tekst = await res.text();
      if (res.ok) return tekst.trim() ? JSON.parse(tekst) : {};
      fout = `HTTP ${res.status}: ${tekst.slice(0, 150)}`;
      if ([400, 404, 405, 422].includes(res.status)) break;
    } catch (e) { fout = e.message; }
    await new Promise((r) => setTimeout(r, 1500 * (poging + 1)));
  }
  throw new Error(fout);
}

function metingen(res) {
  const out = [];
  for (const w of res?.WaarnemingenLijst || []) {
    const grootheid = w?.AquoMetadata?.Grootheid?.Code;
    for (const m of w?.MetingenLijst || []) {
      const v = m?.Meetwaarde?.Waarde_Numeriek;
      if (m?.Tijdstip) out.push({
        t: new Date(m.Tijdstip).toISOString(),
        v: typeof v === "number" && v < 9e8 ? v : null,
        alfa: m?.Meetwaarde?.Waarde_Alfanumeriek,
        grootheid,
      });
    }
  }
  return out;
}

async function maand(code, jaar, m) {
  const begin = new Date(Date.UTC(jaar, m, 1) - 864e5);
  const eind = new Date(Date.UTC(jaar, m + 1, 1) + 864e5);
  const res = await post({
    Locatie: { Code: code },
    AquoPlusWaarnemingMetadata: { AquoMetadata: { Groepering: { Code: "GETETBRKD2" } } },
    Periode: { Begindatumtijd: iso(begin), Einddatumtijd: iso(eind) },
  });
  return koppelExtremen(metingen(res));
}

async function station(code, jaar) {
  const map = path.join(ROOT, "data/metingen/jaar", String(jaar));
  const bestand = path.join(map, `${code}.json`);
  const vorig = fs.existsSync(bestand) ? JSON.parse(fs.readFileSync(bestand, "utf8")) : null;
  if (vorig?.compleet) return "al compleet";
  if (vorig?.laatstePoging && Date.now() - Date.parse(vorig.laatstePoging) < 20 * 3600e3) return "later opnieuw";

  const perTijd = new Map((vorig?.ext || []).map((e) => [e[0], e]));
  const maanden = { ...(vorig?.maanden || {}) };
  let mislukt = false, tijdOp = false;
  for (let m = 0; m < 12; m++) {
    const key = String(m + 1).padStart(2, "0");
    if (maanden[key]) continue;
    if (Date.now() > DEADLINE) { tijdOp = true; break; }
    try {
      const ext = await maand(code, jaar, m);
      if (ext.length >= 50) {
        for (const e of ext) perTijd.set(e.t, [e.t, Math.round(e.v), e.soort === "HW" ? "H" : "L"]);
        maanden[key] = true;
      } else mislukt = true;
    } catch (e) {
      mislukt = true;
      console.error(`  ${code} ${jaar}-${key}: ${e.message}`);
    }
  }
  const compleet = Object.keys(maanden).length === 12;
  if (!compleet && !mislukt && !Object.keys(maanden).length) return "geen tijd meer, volgende run";
  const data = {
    meetpunt: code, jaar, compleet, maanden,
    laatstePoging: !compleet && mislukt ? new Date().toISOString() : undefined,
    bijgewerkt: new Date().toISOString(),
    ext: [...perTijd.values()].sort((a, b) => a[0].localeCompare(b[0])),
  };
  fs.mkdirSync(map, { recursive: true });
  fs.writeFileSync(bestand, JSON.stringify(data));
  return compleet ? "compleet" : `${Object.keys(maanden).length}/12 maanden`;
}

// Per run hooguit 6 minuten; wat dan nog ontbreekt, komt in de volgende run.
const DEADLINE = Date.now() + 6 * 60e3;
// Vanaf oktober het volgende jaar, daarvoor het lopende jaar.
const nu = new Date();
const jaren = process.argv[2] ? [Number(process.argv[2])] : [nu.getUTCMonth() >= 9 ? nu.getUTCFullYear() + 1 : nu.getUTCFullYear()];
const codes = [...new Set(LOCATIES.map((l) => l.rws?.getij?.code).filter(Boolean))];
try {
  for (const jaar of jaren) {
    for (const code of codes) {
      try { console.log(`jaar ${jaar} ${code}: ${await station(code, jaar)}`); }
      catch (e) { console.error(`jaar ${jaar} ${code}: overgeslagen (${e.message})`); }
    }
  }
} catch (e) {
  console.error(`jaartabellen overgeslagen: ${e.message}`);
}
process.exitCode = 0;
