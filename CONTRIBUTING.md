# Contribuire

## Prima di modificare

Leggi [AGENTS.md](AGENTS.md) e [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Il progetto è volutamente senza dipendenze: modifica direttamente file JavaScript, CSS e manifest.

## Workflow

1. Crea un branch descrittivo.
2. Modifica solo i file necessari.
3. Mantieni compatibilità con browser Chromium e Manifest V3.
4. Aggiorna la documentazione se cambiano flusso, permessi, URL supportati o dati visualizzati.
5. Ricarica l'estensione da `chrome://extensions/` e prova un annuncio reale.

## Checklist

- `manifest.json` è JSON valido.
- Il match pattern resta limitato a `https://www.immobiliare.it/annunci/*`.
- Campi mancanti non causano errori non gestiti.
- Popup, tema, minimizzazione, trascinamento e simulatore rata funzionano.
- Parametri mutuo e tema restano dopo un reload della pagina.
- Il confronto prezzo annuncio/zona occupa una sola riga e colora il box.
- Le spese condominiali rispettano soglie verde 0–50 €, giallo 51–100 €, rosso oltre 100 €.
- Il fallback di scraping della pagina mercato continua a passare sulla fixture dedicata.
- Link Google Maps e mercato immobiliare puntano alla destinazione corretta.
- Nessun segreto, tracking o permesso non documentato è stato aggiunto.
- README e mappa tecnica riflettono il comportamento attuale.

## Note tecniche

Sono configurati check sintattico e test unitari Node senza dipendenze:

```bash
npm run check
npm test
```

La verifica finale resta manuale nel browser, con DevTools aperti sulla console della pagina. Se aggiungi tooling, documenta comando, motivazione e dipendenze in questa pagina e nel README.
