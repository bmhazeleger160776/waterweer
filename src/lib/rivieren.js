// Overzichtspagina's per rivier: /waterstand/<slug>
// "plaatsen" staan van boven- naar benedenstrooms.
export const RIVIEREN = {
  rijn: {
    naam: "Rijn",
    titel: "Waterstand Rijn bij Lobith – actueel, verwachting en records",
    h1: "Waterstand Rijn",
    plaatsen: ["lobith"],
    oordeel: (v) => (v < 720 ? "Dat is een verlaagde stand: lager dan normaal bij Lobith." : v <= 1200 ? "Dat is een normale stand voor Lobith." : "Dat is hoger dan normaal voor Lobith."),
    zijtakken: ["waal", "lek", "ijssel"],
    intro: [
      "Bij Lobith stroomt de Rijn Nederland binnen. De waterstand die hier gemeten wordt, is de bekendste rivierstand van het land: Rijkswaterstaat, schippers en waterschappen gebruiken hem om te zien hoeveel water er naar Nederland komt.",
      "Kort na Lobith splitst de Rijn zich. Het grootste deel van het water gaat via de Waal naar het westen, de rest via het Pannerdensch Kanaal naar de Nederrijn en de Lek, en een deel daarvan via de IJssel naar het IJsselmeer. Een stijging bij Lobith is daarom een tot enkele dagen later ook langs die rivieren te zien.",
    ],
    secties: [
      {
        kop: "Wat is een normale waterstand bij Lobith?",
        tekst: "Een waterstand tussen ongeveer 7,20 en 12 meter boven NAP geldt bij Lobith als normaal. Onder de 7,20 meter spreekt Rijkswaterstaat van een verlaagde stand: binnenvaartschepen kunnen dan minder lading meenemen, en in droge zomers neemt de verzilting in het westen van het land toe. Bij hoog water stijgt de Rijn bij Lobith ruim boven de 12 meter, en lopen de uiterwaarden langs Waal, Nederrijn en IJssel onder.",
      },
      {
        kop: "Hoogste en laagste waterstand bij Lobith",
        tekst: "De hoogste bekende waterstand van de Rijn bij Lobith is 16,93 meter boven NAP, in januari 1926. Toen braken in het rivierengebied dijken door. Eind januari 1995 kwam het water tot 16,68 meter; toen werden rond de 250.000 mensen in het rivierengebied geëvacueerd. In de droge zomer van 2022 zakte de Rijn juist tot zo'n 6,48 meter boven NAP, een van de laagste standen sinds het begin van de metingen.",
      },
    ],
    faq: (st) => [
      st("lobith") && { v: "Wat is de waterstand van de Rijn bij Lobith nu?", a: `De laatst gemeten waterstand van de Rijn bij Lobith is ${st("lobith")}. Deze pagina wordt elk uur bijgewerkt met metingen van Rijkswaterstaat.` },
      { v: "Wat is de hoogste waterstand bij Lobith ooit?", a: "De hoogste bekende waterstand bij Lobith is 16,93 meter boven NAP, in januari 1926. In januari 1995 kwam het water tot 16,68 meter boven NAP." },
      { v: "Wat is een lage waterstand bij Lobith?", a: "Onder ongeveer 7,20 meter boven NAP spreekt Rijkswaterstaat van een verlaagde waterstand bij Lobith. In augustus 2022 zakte de Rijn tot zo'n 6,48 meter boven NAP." },
    ],
  },
  waal: {
    naam: "Waal",
    titel: "Waterstand Waal – Nijmegen, Tiel en Zaltbommel actueel",
    h1: "Waterstand Waal",
    plaatsen: ["nijmegen", "tiel", "zaltbommel"],
    intro: [
      "De Waal is de grootste Rijntak: het grootste deel van het Rijnwater stroomt via Nijmegen, Tiel en Zaltbommel naar het westen. Het is ook een van de drukst bevaren rivieren van Europa, dus de waterstand is hier belangrijk voor de binnenvaart.",
      "Een verandering bij Lobith is op de Waal binnen ongeveer een dag terug te zien, eerst bij Nijmegen en daarna verder stroomafwaarts. Bij hoog water lopen de uiterwaarden onder, bij laag water komen de kribvakken en zandstrandjes droog te liggen.",
    ],
    faq: (st) => [
      st("nijmegen") && { v: "Wat is de waterstand van de Waal nu?", a: `De laatst gemeten waterstand van de Waal bij Nijmegen is ${st("nijmegen")}. Verderop langs de Waal staat het water lager, omdat de rivier richting zee afloopt.` },
      { v: "Waarom staat de Waal bij Zaltbommel lager dan bij Nijmegen?", a: "Een rivier loopt af naar zee. De waterstanden zijn gemeten ten opzichte van NAP, en hoe dichter bij zee, hoe lager het water staat. Voor de vraag of het water hoog of laag staat, kijk je dus naar de verandering op één meetpunt, niet naar het verschil tussen meetpunten." },
    ],
  },
  lek: {
    naam: "Nederrijn en Lek",
    titel: "Waterstand Nederrijn en Lek – Arnhem, Hagestein en Schoonhoven",
    h1: "Waterstand Nederrijn en Lek",
    plaatsen: ["arnhem", "hagestein", "schoonhoven"],
    intro: [
      "De Nederrijn stroomt langs Arnhem en Wageningen en heet vanaf Wijk bij Duurstede de Lek. De rivier is gestuwd: met de stuwen bij Driel, Amerongen en Hagestein regelt Rijkswaterstaat hoeveel Rijnwater naar de IJssel gaat en houdt het de rivier bevaarbaar.",
      "Stroomafwaarts van Hagestein merk je het getij uit zee: bij Schoonhoven gaat het water twee keer per dag op en neer. Daar spelen dus zowel de rivierafvoer als eb en vloed mee.",
    ],
    faq: (st) => [
      st("arnhem") && { v: "Wat is de waterstand van de Nederrijn bij Arnhem nu?", a: `De laatst gemeten waterstand van de Nederrijn bij Arnhem is ${st("arnhem")}.` },
      { v: "Heeft de Lek eb en vloed?", a: "Ja, stroomafwaarts van de stuw bij Hagestein. Bij Schoonhoven gaat de waterstand twee keer per dag op en neer door het getij uit zee." },
    ],
  },
  ijssel: {
    naam: "IJssel",
    titel: "Waterstand IJssel – Deventer, Zutphen en Kampen actueel",
    h1: "Waterstand IJssel",
    plaatsen: ["doesburg", "zutphen", "deventer", "olst", "wijhe", "kampen"],
    intro: [
      "De IJssel takt bij Arnhem af van de Rijn en stroomt via Doesburg, Zutphen, Deventer en Zwolle naar het Ketelmeer bij Kampen. Ongeveer een negende deel van het Rijnwater gaat deze kant op. Bij lage afvoer zorgen de stuwen in de Nederrijn ervoor dat de IJssel toch genoeg water krijgt.",
      "Een stijging bij Lobith is bij Doesburg snel te zien en bereikt Deventer en Kampen een tot twee dagen later. Bij Kampen speelt ook de wind mee: een noordwesterstorm kan het water vanuit het IJsselmeer opstuwen.",
    ],
    faq: (st) => [
      st("deventer") && { v: "Wat is de waterstand van de IJssel bij Deventer nu?", a: `De laatst gemeten waterstand van de IJssel bij Deventer is ${st("deventer")}.` },
      { v: "Wanneer staat de IJsselkade in Deventer onder water?", a: "Bij hoog water op de Rijn stijgt de IJssel bij Deventer flink, en kan de kade onderlopen. De gemeente sluit die dan af; volg bij hoogwater altijd de berichten van de gemeente en Rijkswaterstaat." },
    ],
  },
  maas: {
    naam: "Maas",
    titel: "Waterstand Maas – Borgharen, Venlo, Roermond actueel",
    h1: "Waterstand Maas",
    plaatsen: ["borgharen", "roermond", "venlo", "grave", "lith", "heesbeen", "keizersveer"],
    intro: [
      "De Maas komt bij Eijsden Nederland binnen en stroomt via Maastricht, Roermond, Venlo en Grave naar het westen, waar ze via de Bergsche Maas en de Amer in het Hollands Diep uitkomt. Anders dan de Rijn is de Maas een regenrivier: na veel regen in de Ardennen kan het water binnen een paar dagen flink stijgen.",
      "Tussen Maastricht en Lith houden stuwen het water op peil voor de scheepvaart. Bij Borgharen begint de Grensmaas, het vrij stromende stuk langs de Belgische grens. De hoogste Maasafvoer bij Borgharen werd gemeten in december 1993; ook in 1995 en juli 2021 stond de Maas extreem hoog.",
    ],
    faq: (st) => [
      st("borgharen") && { v: "Wat is de waterstand van de Maas bij Borgharen nu?", a: `De laatst gemeten waterstand van de Maas bij Borgharen is ${st("borgharen")}. De Maas ligt in Limburg tientallen meters boven NAP, omdat het land daar hoger ligt.` },
      { v: "Waarom staat de Maas bij Borgharen meer dan 40 meter boven NAP?", a: "NAP is een vast nulpunt, ongeveer op zeeniveau. Zuid-Limburg ligt veel hoger dan de rest van Nederland, dus de rivier stroomt daar ook ver boven NAP. Of het water hoog of laag staat, zie je aan de verandering op hetzelfde meetpunt." },
    ],
  },
};
