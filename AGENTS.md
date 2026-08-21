# AGENTS.md

## Scopo

Questo repository contiene una Chrome extension Manifest V3 che arricchisce pagine di annunci Immobiliare.it. Non è presente un'applicazione server, un bundler o un package manager.

## Mappa rapida

| Percorso | Responsabilità |
| --- | --- |
| `manifest.json` | Nome, versione, permessi e match pattern del content script |
| `content.js` | Estrazione da `#__NEXT_DATA__`, richiesta price chart, calcoli, stato locale e rendering |
| `style.css` | Layout e stile di `#immobiliare-popup` |
| `package.json` | Script `check` e `test`, senza dipendenze runtime |
| `tests/content.test.js` | Test unitari delle funzioni pure e del contratto API |
| `showcase.gif` | Demo visuale |
| `docs/ARCHITECTURE.md` | Flusso dati, contratti e limiti tecnici |
| `README.md` | Installazione e comportamento utente |
| `.github/copilot-instructions.md` | Istruzioni specifiche per Copilot |

## Regole di modifica

- Mantieni JavaScript browser-native e CSS semplice: non introdurre framework o build step senza richiesta esplicita.
- Mantieni Manifest V3 e il match pattern limitato agli annunci.
- Prima di cambiare un selettore o un campo JSON, verifica il contratto usato da `extractData()`.
- Riusa le funzioni esistenti di formattazione e calcolo invece di duplicare logica.
- Gestisci esplicitamente dati mancanti e risposte API non valide; non nascondere errori con fallback silenziosi.
- Non aggiungere permessi o host permissions se non sono necessari e documentati.
- Mantieni le chiavi `immobiliare-insight-theme` e `immobiliare-insight-mortgage` compatibili con i dati già salvati.
- Mantieni sia test API sia fixture `tests/market-page.fixture.html` per il prezzo zona.
- Non inserire credenziali, token o dati personali nel codice o nella documentazione.
- Aggiorna README e `docs/ARCHITECTURE.md` quando cambia comportamento, URL supportato, permesso o formato dati.
- Evita modifiche a `.idea/` salvo richiesta esplicita.

## Flusso runtime da preservare

1. Chrome inietta `content.js` e `style.css` solo su `https://www.immobiliare.it/annunci/*`.
2. `extractData()` legge `#__NEXT_DATA__` e usa `props.pageProps.detailData.realEstate`.
3. Il primo elemento di `realEstate.properties` alimenta i campi dell'interfaccia.
4. `fetchPriceChart()` recupera la media dalla pagina mercato città/regione e usa l'API chart come fallback.
5. `showPopup()` crea il DOM e registra tema, minimizzazione, trascinamento e simulatore rata.

## Verifica manuale

Per ogni modifica:

1. esegui `npm run check`;
2. esegui `npm test`;
3. valida che `manifest.json` resti JSON valido;
4. ricarica la cartella unpacked in `chrome://extensions/`;
5. prova un annuncio con dati completi;
6. prova dati assenti o risposta chart non disponibile;
7. controlla errori nella console della pagina;
8. verifica link esterni con `target="_blank"` e `rel="noopener noreferrer"`.

## Vincoli di review

Considera regressioni ad alta priorità:

- content script eseguito su pagine fuori scope;
- popup non renderizzato o duplicato;
- eccezioni causate da campi JSON mancanti;
- URL di mercato o Google Maps non validi;
- modifica involontaria della formula del mutuo;
- aumento non motivato di permessi o dati inviati a servizi esterni.
