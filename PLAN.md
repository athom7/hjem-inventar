# Plan: Hjem-inventar

## Kontekst
Gå rundt i boligen, sig højt hvad der står i hvert rum, og få et inventar ud af det. Målet er **beslutninger, ikke
et katalog**: hvad skal beholdes og med i flytningen, hvad skal smides ud, doneres eller sælges.
Oversigten er **boligens egen plantegning**, hvor hvert rum viser, hvor langt det er.

Valg:
- Tale → poster: telefonens diktering + en lokal dansk parser. Claude kommer først i fase 3.
- Én telefon, lokal data (IndexedDB), eksport til CSV/Excel og JSON-backup. Ingen server.
- Plantegningen lægges ind som billede. En PDF gemmes som skærmbillede først, så der ikke skal bruges pdf.js.

Kernen: en post er **en beslutningsenhed** ("kasse med køkkengrej", "bogreolen"), ikke hver enkelt genstand.
Så kan man nå gennem huset, før man bliver træt af det.

---

## Fase 1 – plantegning, gennemgang og beslutninger ✅
- **Etager og plantegninger:** et billede pr. etage (PNG/JPG/SVG), valgt med faner.
- **Markér rum:** træk en firkant over rummet på tegningen. Et rum kan have flere firkanter (L-formede rum).
  Koordinaterne er normaliserede (0..1), så de passer på alle skærme.
- **Oversigten (forsiden):** hvert rum på tegningen viser navn, antal ting, antal uafgjorte og en søjle med
  beslutningsfordelingen. Tilstanden er `room-empty` (ikke gennemgået), `room-open` (har uafgjorte) eller
  `room-done` (alt afgjort). Med filterchips (Smid ud, Donér, Sælg, Behold) viser hvert rum sit antal, og farvens
  styrke (`level-0..3`) viser, hvor der er mest.
- **Rummet:** postliste og redigering, plus knapperne Indtal og Beslut.
- **Indtal:** tekstfelt + mikrofon (Web Speech API, `da-DK`) eller tastaturets diktering → parser → redigerbar preview → gem.
- **Beslut:** én uafgjort post ad gangen, fem store knapper og fortryd, pr. rum eller for hele boligen.
- **Lister:** en liste pr. beslutning, grupperet efter rum, med knapper til at kopiere og printe.
- **Data:** eksport til CSV (Excel), fuld JSON-backup inkl. plantegninger, import (erstat/flet), påmindelse om backup
  efter 14 dage og `navigator.storage.persist()`.
- **PWA:** manifest, ikoner og service worker, så appen virker offline og kan installeres på hjemmeskærmen.
- **Eksempel-bolig:** en fiktiv plantegning med rum og ting, så man kan se appen uden at taste noget ind.

## Fase 2 – flytning
- Det **nye hjems plantegning** som destination: "Behold"-poster lægges i nummererede flyttekasser, og hver kasse får et
  destinationsrum i den nye bolig (samme plan-editor).
- Kasse-etiketter til print (stort nummer, destinationsrum, indhold).
- Søgning: "hvor er kaffemaskinen?" → rum eller kasse.
- Fotos pr. rum/post (kamera, nedskaleret via canvas, gemt i IndexedDB).
- Afkrydsning af "solgt" og "afleveret", så listerne kan bruges som tjeklister.

## Fase 3 – Claude og løbende inventar
- Valgfri egen Anthropic API-nøgle i indstillinger, kaldt direkte fra browseren. Appen skal virke fuldt uden nøgle.
- Claude fortolker rodet tale og **fotos af hylder og skabe** til poster og falder tilbage på den lokale parser.
- Claude læser plantegningen og **foreslår rum og firkanter** automatisk.
- Efter flytningen: eksport til indboforsikring (poster + fotos pr. rum).

---

## Filstruktur
```
hjem-inventar/
├── CLAUDE.md  PLAN.md  README.md  netlify.toml  package.json
├── index.html  manifest.webmanifest  sw.js
├── icons/                  app-ikoner (svg + png)
├── demo/eksempel-plan.svg  fiktiv bolig til demo og test
├── css/app.css             farvetokens (lys/mørk) og layout
├── js/
│   ├── main.js             opstart, tilstand, hash-routing
│   ├── model/              rene funktioner: decisions, inventory, stats, plan, demo
│   ├── parse/parse-da.js   dikteret dansk tekst → poster
│   ├── data/               db.js (IndexedDB), export.js (CSV/JSON), files.js (download/data-URL)
│   └── ui/                 visninger: planview, planedit, room, capture, speech, triage, lists, settings
└── tests/                  node --test
```
