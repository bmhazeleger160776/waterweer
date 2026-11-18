// Haalt per locatie de actuele RWS-data op (nieuwe WaterWebservices, ddapi20)
// en schrijft data/metingen/<slug>.json.
// - getij: berekende hoog-/laagwaters (groepering GETETBRKD2) voor vandaag t/m +7 dagen;
//          de getijcurve wordt daartussen geïnterpoleerd
// - temperatuur: laatste meting watertemperatuur (T)
// - waterstand: laatste gemeten waterstand (WATHTE)
// Mislukt een onderdeel, dan blijft de vorige waarde staan (laatste geldige data).
//
// Gebruik: node scripts/fetch-rws.mjs            (alle locaties)
//          node scripts/fetch-rws.mjs vlissingen (één locatie)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCATIES = JSON.parse(fs.readFileSync(path.join(ROOT, "data/locaties.json"), "utf8"));
const OUT = path.join(ROOT, "data/metingen");
const KANDIDATEN_PAD = path.join(ROOT, "data/golf-kandidaten.json");
const KANDIDATEN = fs.existsSync(KANDIDATEN_PAD) ? JSON.parse(fs.readFileSync(KANDIDATEN_PAD, "utf8")) : {};

const BASE = "https://ddapi20-waterwebservices.rijkswaterstaat.nl";
const P = {
  waarnemingen: "/ONLINEWAARNEMINGENSERVICES/OphalenWaarnemingen",
  laatste: "/ONLINEWAARNEMINGENSERVICES/OphalenLaatsteWaarnemingen",
};

async function post(pad, body) {
  let fout;
  for (let poging = 0; poging < 3; poging++) {
    try {
      const res = await fetch(BASE + pad, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
      const tekst = await res.text();
      if (!res.ok) {
        fout = `HTTP ${res.status}: ${tekst.slice(0, 200)}`;
        if ([400, 404, 405, 422].includes(res.status)) break;
      } else {
        return tekst.trim() ? JSON.parse(tekst) : {};
      }
    } catch (e) {
      fout = e.message;
    }
    await new Promise((r) => setTimeout(r, 1500 * (poging + 1)));
  }
  throw new Error(fout);
}

const get = (o, ...keys) => {
  if (!o || typeof o !== "object") return undefined;
  const lower = Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v]));
  for (const k of keys) if (k.toLowerCase() in lower) return lower[k.toLowerCase()];
};
const code = (o, veld) => get(get(o, veld) || {}, "Code");

// Alle metingen als { t, v, alfa, grootheid }
function metingen(res) {
  const out = [];
  for (const w of get(res, "WaarnemingenLijst") || []) {
    const grootheid = code(get(w, "AquoMetadata") || {}, "Grootheid");
    for (const m of get(w, "MetingenLijst") || []) {
      const t = get(m, "Tijdstip");
      const mw = get(m, "Meetwaarde") || {};
      const v = get(mw, "Waarde_Numeriek");
      const alfa = get(mw, "Waarde_Alfanumeriek");
      if (t) out.push({ t: new Date(t).toISOString(), v: typeof v === "number" && v < 9e8 ? v : null, alfa, grootheid });
    }
  }
  return out.sort((a, b) => a.t.localeCompare(b.t));
}

const iso = (d) => d.toISOString().replace("Z", "+00:00");
const rwsCode = (x) => (typeof x === "string" ? x : x?.code);

// Hoog-/laagwaters: RWS levert per extreem een waterhoogte (WATHTE) én een type
// ("hoogwater"/"laagwater") op hetzelfde tijdstip. Die koppelen we.
export function koppelExtremen(lijst) {
  const perTijd = new Map();
  for (const m of lijst) {
    const e = perTijd.get(m.t) || { t: m.t };
    if (m.v !== null && (m.grootheid === "WATHTE" || e.v === undefined)) e.v = m.v;
    if (typeof m.alfa === "string" && /hoog|laag/i.test(m.alfa)) e.soort = /hoog/i.test(m.alfa) ? "HW" : "LW";
    perTijd.set(m.t, e);
  }
  const res = [...perTijd.values()].filter((e) => typeof e.v === "number").sort((a, b) => a.t.localeCompare(b.t));
  // Type ontbreekt? Afleiden uit de buren.
  for (let i = 0; i < res.length; i++) {
    if (res[i].soort) continue;
    const buren = [res[i - 1]?.v, res[i + 1]?.v].filter((x) => typeof x === "number");
    res[i].soort = buren.every((b) => res[i].v > b) ? "HW" : "LW";
  }
  return res;
}

// Getijcurve tussen de extremen: halve cosinus per stap (goede benadering voor de grafiek).
export function curveUitExtremen(ext, stapMin = 10) {
  const reeks = [];
  for (let i = 0; i < ext.length - 1; i++) {
    const a = ext[i], b = ext[i + 1];
    const ta = Date.parse(a.t), tb = Date.parse(b.t);
    for (let t = ta; t < tb; t += stapMin * 60e3) {
      const f = (1 - Math.cos((Math.PI * (t - ta)) / (tb - ta))) / 2;
      reeks.push({ t: new Date(t).toISOString(), v: Math.round(a.v + (b.v - a.v) * f) });
    }
  }
  if (ext.length) reeks.push({ t: ext.at(-1).t, v: ext.at(-1).v });
  return reeks;
}

async function getij(stationCode) {
  const start = new Date(Date.now() - 12 * 3600e3);
  const eind = new Date(Date.now() + 8 * 864e5);
  const res = await post(P.waarnemingen, {
    Locatie: { Code: stationCode },
    AquoPlusWaarnemingMetadata: { AquoMetadata: { Groepering: { Code: "GETETBRKD2" } } },
    Periode: { Begindatumtijd: iso(start), Einddatumtijd: iso(eind) },
  });
  const extremen = koppelExtremen(metingen(res));
  if (extremen.length < 2) throw new Error("geen hoog-/laagwaters in de voorspelling");
  return { extremen, reeks: curveUitExtremen(extremen) };
}

async function laatste(stationCode, grootheid) {
  const meta = { Compartiment: { Code: "OW" }, Grootheid: { Code: grootheid }, ProcesType: "meting" };
  let lijst = [];
  try {
    const res = await post(P.laatste, {
      AquoPlusWaarnemingMetadataLijst: [{ AquoMetadata: meta }],
      LocatieLijst: [{ Code: stationCode }],
    });
    lijst = metingen(res).filter((m) => m.v !== null);
  } catch {
    // terugval: laatste 2 dagen ophalen
    const res = await post(P.waarnemingen, {
      Locatie: { Code: stationCode },
      AquoPlusWaarnemingMetadata: { AquoMetadata: meta },
      Periode: { Begindatumtijd: iso(new Date(Date.now() - 2 * 864e5)), Einddatumtijd: iso(new Date()) },
    });
    lijst = metingen(res).filter((m) => m.v !== null);
  }
  const l = lijst.at(-1);
  if (!l) throw new Error("geen recente waarneming");
  if (Date.now() - Date.parse(l.t) > 48 * 3600e3) throw new Error(`laatste meting is oud (${l.t})`);
  return { t: l.t, v: l.v };
}

// Verloop van de gemeten waterstand (uurwaarden) voor rivier- en meerpagina's.
async function verloop(stationCode, dagen = 7) {
  const res = await post(P.waarnemingen, {
    Locatie: { Code: stationCode },
    AquoPlusWaarnemingMetadata: { AquoMetadata: { Compartiment: { Code: "OW" }, Grootheid: { Code: "WATHTE" }, ProcesType: "meting" } },
    Periode: { Begindatumtijd: iso(new Date(Date.now() - dagen * 864e5)), Einddatumtijd: iso(new Date()) },
  });
  const perUur = new Map();
  for (const m of metingen(res)) {
    if (m.v === null) continue;
    perUur.set(m.t.slice(0, 13), { t: m.t.slice(0, 13) + ":00:00.000Z", v: Math.round(m.v) });
  }
  const reeks = [...perUur.values()].sort((a, b) => a.t.localeCompare(b.t));
  if (reeks.length < 24) throw new Error("te weinig metingen voor het verloop");
  return reeks;
}

// Metingen van de afgelopen uren als { t, v }; bij meerdere reeksen (bijv. frequentiebanden)
// nemen we de reeks met de meest recente waarde.
async function recent(stationCode, compartiment, grootheid, uren = 24) {
  const res = await post(P.waarnemingen, {
    Locatie: { Code: stationCode },
    AquoPlusWaarnemingMetadata: { AquoMetadata: { Compartiment: { Code: compartiment }, Grootheid: { Code: grootheid }, ProcesType: "meting" } },
    Periode: { Begindatumtijd: iso(new Date(Date.now() - uren * 3600e3)), Einddatumtijd: iso(new Date()) },
  });
  let beste = [];
  for (const w of get(res, "WaarnemingenLijst") || []) {
    const lijst = (get(w, "MetingenLijst") || [])
      .map((m) => ({ t: new Date(get(m, "Tijdstip")).toISOString(), v: get(get(m, "Meetwaarde") || {}, "Waarde_Numeriek") }))
      .filter((m) => typeof m.v === "number" && m.v < 9e8)
      .sort((a, b) => a.t.localeCompare(b.t));
    if (lijst.length && (!beste.length || lijst.at(-1).t > beste.at(-1).t)) beste = lijst;
  }
  return beste;
}

const vers = (lijst, uren = 6) => lijst.length && Date.now() - Date.parse(lijst.at(-1).t) < uren * 3600e3;

// Golfhoogte en wind: probeer eerst het meetpunt van de vorige keer, dan de dichtstbijzijnde kandidaten.
async function golfEnWind(slug, vorig) {
  const kand = KANDIDATEN[slug];
  if (!kand) return {};
  const uit = {};
  const volgorde = (lijst, vorigCode) => {
    const v = lijst.find((k) => k.code === vorigCode);
    return [...(v ? [v] : []), ...lijst.filter((k) => k.code !== vorigCode)].slice(0, 8);
  };
  for (const k of volgorde(kand.golf, vorig.golf?.meetpunt)) {
    try {
      const hm0 = await recent(k.code, "OW", "Hm0");
      if (!vers(hm0)) continue;
      const vals = hm0.map((m) => m.v);
      uit.golf = { meetpunt: k.code, meetpuntNaam: k.naam, km: k.km, t: hm0.at(-1).t, v: Math.round(hm0.at(-1).v), min24: Math.round(Math.min(...vals)), max24: Math.round(Math.max(...vals)) };
      try {
        const per = await recent(k.code, "OW", "Tm02", 3);
        if (vers(per)) uit.golf.periode = Math.round(per.at(-1).v * 10) / 10;
      } catch {}
      break;
    } catch {}
  }
  for (const k of volgorde(kand.wind, vorig.wind?.meetpunt)) {
    try {
      const shd = await recent(k.code, "LT", "WINDSHD", 3);
      if (!vers(shd, 3)) continue;
      uit.wind = { meetpunt: k.code, meetpuntNaam: k.naam, km: k.km, t: shd.at(-1).t, snelheid: Math.round(shd.at(-1).v * 10) / 10 };
      try {
        const rtg = await recent(k.code, "LT", "WINDRTG", 3);
        if (vers(rtg, 3)) uit.wind.richting = Math.round(rtg.at(-1).v);
      } catch {}
      break;
    } catch {}
  }
  return uit;
}

async function locatie(loc) {
  const bestand = path.join(OUT, `${loc.slug}.json`);
  const vorig = fs.existsSync(bestand) ? JSON.parse(fs.readFileSync(bestand, "utf8")) : {};
  const data = { ...vorig, slug: loc.slug, voorbeeld: false, bijgewerkt: new Date().toISOString(), fouten: [] };
  for (const thema of ["getij", "temperatuur", "waterstand"]) if (!loc.rws[thema]) delete data[thema];

  if (loc.rws.getij) {
    try {
      data.getij = { meetpunt: rwsCode(loc.rws.getij), eenheid: "cm NAP", ...(await getij(rwsCode(loc.rws.getij))) };
    } catch (e) { data.fouten.push(`getij: ${e.message}`); }
  }
  for (const [thema, grootheid, eenheid] of [["temperatuur", "T", "°C"], ["waterstand", "WATHTE", "cm NAP"]]) {
    if (!loc.rws[thema]) continue;
    try {
      data[thema] = { meetpunt: rwsCode(loc.rws[thema]), meetpuntNaam: loc.rws[thema].naam, eenheid, ...(await laatste(rwsCode(loc.rws[thema]), grootheid)) };
    } catch (e) { data.fouten.push(`${thema}: ${e.message}`); }
  }
  if (KANDIDATEN[loc.slug]) {
    const gw = await golfEnWind(loc.slug, vorig);
    for (const k of ["golf", "wind"]) {
      if (gw[k]) data[k] = gw[k];
      else {
        data.fouten.push(`${k}: geen recente meting`);
        if (data[k] && Date.now() - Date.parse(data[k].t) > 24 * 3600e3) delete data[k];
      }
    }
  }
  if (!loc.rws.getij && loc.rws.waterstand && data.waterstand) {
    try { data.waterstand.reeks = await verloop(rwsCode(loc.rws.waterstand)); }
    catch (e) { data.fouten.push(`verloop: ${e.message}`); }
  }
  fs.writeFileSync(bestand, JSON.stringify(data, null, 1));
  console.log(`${loc.slug}: ${data.fouten.length ? "met fouten -> " + data.fouten.join(" | ") : "ok"}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(OUT, { recursive: true });
  const filter = process.argv[2];
  const lijst = LOCATIES.filter((l) => l.rws && Object.keys(l.rws).length && (!filter || l.slug === filter));
  for (const loc of lijst) {
    try { await locatie(loc); }
    catch (e) { console.error(`${loc.slug}: overgeslagen (${e.message}); vorige data blijft staan`); }
  }
}
