# Hjem-inventar – projektregler

Mobil web-app (PWA) til at gå rundt i boligen, indtale hvad der står i hvert rum og beslutte, hvad der skal
beholdes, smides ud, doneres eller sælges. Oversigten er boligens egen plantegning med rummene markeret.

## Teknik – faste rammer
- Kun HTML, CSS og vanilla JavaScript (ES-moduler). Ingen frameworks, ingen bundler, ingen build-step.
- Ingen backend, ingen login og ingen CDN-afhængigheder. Appen skal virke offline (service worker i `sw.js`).
- Statisk deploy på Netlify (`netlify.toml`, publish = ".").
- Kør lokalt: `python3 -m http.server 8080` i mappen → http://localhost:8080
- Tests: `node --test` (Nodes indbyggede testrunner finder `tests/*.test.js`, ingen npm-pakker).
- Nye afhængigheder kræver Andreas' godkendelse først.

## Sprog
- UI-tekster og README: dansk.
- Kode, kommentarer, commit-beskeder: engelsk.

## Data og privatliv
- Inventar og plantegninger ligger kun på telefonen (IndexedDB). De forlader den kun ved eksport/backup.
- **Ingen personlige data i repoet**: ingen rigtig plantegning, ingen rigtige inventarlister.
  `demo/eksempel-plan.svg` er en fiktiv bolig og bruges til demo og test. Skærmbilleder i `docs/` viser kun den.

## Arkitektur – lagdelingen må ikke brydes
- `js/model/`, `js/parse/`, `js/data/export.js` = rene funktioner. Ingen DOM, `window` eller IndexedDB. Testes i Node.
- `js/data/db.js` = eneste sted, der rører IndexedDB. `js/data/files.js` = browser-hjælpere (download, data-URL).
- `js/ui/` = visning. Kalder model og data. Ingen parse- eller statistiklogik i UI – den hører til i `model/`.
- Dokumentet (`doc`) ændres kun gennem funktionerne i `js/model/inventory.js`, og UI gemmer via `ctx.commit()`.

## Visning – ingen farver i JavaScript
- JS sætter kun tilstandsklasser: `room-empty`, `room-open`, `room-done`, `dec-<beslutning>`, `filter-<beslutning>`,
  `level-0` … `level-3`, `selected`. Alle farver er tokens i `css/app.css` under `:root` og
  `@media (prefers-color-scheme: dark)`. En test håndhæver det.
- Tankegang som ISA-101: det, der er færdigt, er roligt og gråt. Farve bruges til det, der kræver handling.
- Mobil først: store trykflader (min. 44 px), virker i 360 px bredde.

## Beslutninger
- `undecided` (Afgør senere), `keep` (Behold – skal med), `trash` (Smid ud), `donate` (Donér), `sell` (Sælg).
- Defineres ét sted: `js/model/decisions.js`, med dansk `labelDa` og `hintDa`.
- En post er en **beslutningsenhed** ("kasse med kabler"), ikke hver enkelt genstand. Antal (`qty`) tælles som "ting".

## Parseren (`js/parse/parse-da.js`)
- Deler på komma, punktum, linjeskift, " og ", "samt", "plus". Aldrig på "med" ("kasse med kabler" er én post).
- Fjerner fyldord ("jeg ser", "der står" …), læser antal (cifre, en/et … tolv) og beslutning sidst i en post
  ("skal smides ud", "doneres", "sælges", "skal med").
- Parseren må gerne tage fejl – brugeren retter i preview før gem. Hver ny regel skal have en test.

## Service worker
- `sw.js` har en `ASSETS`-liste med alle filer. En test fejler, hvis en fil i `js/`, `css/`, `icons/` eller `demo/` mangler.
- Strategi: stale-while-revalidate. Hæv `CACHE`-versionen, når filer fjernes eller omdøbes.

## Arbejdsgang
- Bygges i faser (se `PLAN.md`). Byg kun den aktuelle fase – spring ikke frem.
- Status: fase 1 (plantegning, hurtigstart, indtaling, beslutninger, eksport) er færdig. Fase 2 (flytning) er næste.
- Kør `node --test` og åbn siden lokalt uden konsolfejl før commit.
- Små, beskrivende commits på engelsk.
