# Istruzioni per Copilot

## Contesto

`immobiliare.it-insignt` è una Chrome extension Manifest V3 senza bundler. `content.js` viene iniettato nelle pagine `https://www.immobiliare.it/annunci/*` insieme a `style.css`.

## Prima di proporre modifiche

- Leggi `manifest.json`, `content.js`, `style.css` e `docs/ARCHITECTURE.md`.
- Tratta `#__NEXT_DATA__` e `props.pageProps.detailData.realEstate` come contratto esterno instabile.
- Cerca prima funzioni esistenti di formattazione, URL e calcolo rata.

## Vincoli

- Usa JavaScript browser-native; non introdurre framework, transpiler o dipendenze npm per modifiche locali.
- Mantieni Manifest V3 e permessi minimi.
- Non ampliare host pattern o inviare dati a nuovi servizi senza motivazione esplicita.
- Gestisci errori API e campi assenti in modo visibile e coerente; non usare catch generici o fallback che mascherano guasti.
- Evita `eval`, codice remoto e credenziali.
- Mantieni accessibilità di base: controlli da tastiera, nomi leggibili e contrasto sufficiente.
- Usa `textContent` o escaping quando dati della pagina vengono inseriti nel DOM; considera i dati dell'annuncio non attendibili.

## Documentazione e verifica

Aggiorna `README.md`, `AGENTS.md` o `docs/ARCHITECTURE.md` quando la modifica cambia comportamento o contratto. Non esiste una suite automatica: valida il manifest, ricarica l'estensione e prova annunci con dati completi e incompleti.
