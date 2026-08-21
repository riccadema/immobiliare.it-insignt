<h1 align="center">🏠 Immobiliare.it Insight</h1>

<p align="center">
  Estensione Chromium che aggiunge informazioni, stime e collegamenti utili agli annunci di <a href="https://www.immobiliare.it">Immobiliare.it</a>.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue" alt="Chrome Manifest V3" />
  <img src="https://img.shields.io/github/license/riccadema/immobiliare.it-insignt" alt="Licenza MIT" />
</p>

<p align="center">
  <img src="showcase.gif" alt="Demo dell'estensione" width="90%" />
</p>

## Stato del progetto

Progetto JavaScript/CSS senza build system o dipendenze npm. L'estensione viene caricata direttamente come unpacked extension.

## Installazione locale

1. Clona o scarica il repository:

   ```bash
   git clone https://github.com/riccadema/immobiliare.it-insignt
   ```

2. Apri Chrome e visita `chrome://extensions/`.
3. Attiva **Modalità sviluppatore**.
4. Seleziona **Carica estensione non pacchettizzata**.
5. Scegli la cartella `immobiliare.it-insignt`.
6. Apri un URL compatibile, ad esempio `https://www.immobiliare.it/annunci/...`.

Per Chrome, Edge e altri browser Chromium la procedura è equivalente, con nomi dei menu eventualmente diversi.

## Funzionalità

Su ogni annuncio compatibile, il content script legge i dati JSON già presenti nella pagina e costruisce un popup trascinabile e minimizzabile con:

- tema chiaro/scuro selezionabile dall'header e ricordato localmente;
- prezzo richiesto in evidenza, prezzo al m² dell'annuncio e disponibilità;
- data di creazione e aggiornamento, inclusi giorni trascorsi;
- confronto tra prezzo al m² dell'annuncio e prezzo medio della zona;
- locali, superficie, piano e ascensore;
- box colorati in base al contenuto; campi mancanti evidenziati in rosso;
- riscaldamento, condizionamento, garage, anno di costruzione e spese condominiali;
- simulatore mutuo con importo proposta sempre visibile e parametri modificabili in un pannello collapse;
- elenco delle caratteristiche dell'immobile, aperto di default;
- pulsante **Apri in Google Maps** e link alla pagina del mercato immobiliare;
- memoria locale per tema e parametri mutuo personalizzati.

Il prezzo medio della zona viene cercato prima nella pagina **Mercato immobiliare**, ignorando i valori minimo/massimo del range, e poi nel price-chart API. Il riquadro del prezzo medio apre direttamente la pagina mercato. Se il sito presenta una verifica anti-bot o cambia struttura, il campo resta visibile come non disponibile e viene evidenziato in rosso.

## Ambito di esecuzione e dati

Il manifest abilita il content script solo per:

```text
https://www.immobiliare.it/annunci/*
```

L'estensione:

- non contiene popup di Chrome, options page o service worker;
- non usa un backend proprietario o database;
- usa `localStorage` solo per tema e parametri mutuo dell'utente;
- legge `#__NEXT_DATA__` dalla pagina dell'annuncio;
- interroga prima la pagina mercato per la media e usa l'endpoint chart solo come fallback;
- apre collegamenti esterni a Google Maps quando l'utente li seleziona.

I dettagli tecnici e il flusso completo sono in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Struttura del progetto

```text
immobiliare.it-insignt/
├── manifest.json                  # Contratto Chrome MV3
├── content.js                     # Estrazione dati, API e UI
├── style.css                      # Stili del popup iniettato
├── showcase.gif                   # Demo visiva
├── package.json                   # Script check/test senza dipendenze runtime
├── tests/
│   ├── content.test.js            # Test unitari Node
│   └── market-page.fixture.html   # Fixture per scraping prezzo zona
├── README.md                      # Uso e installazione
├── AGENTS.md                      # Regole per agenti e manutentori
├── CONTRIBUTING.md                # Workflow di modifica e verifica
├── docs/
│   └── ARCHITECTURE.md            # Mappa tecnica e flusso dati
└── .github/
    └── copilot-instructions.md    # Istruzioni repository per Copilot
```

Il nome della cartella contiene intenzionalmente `insignt`, come nel repository esistente.

## Sviluppo e verifica

Gli script locali non richiedono dipendenze esterne:

```bash
npm run check
npm test
```

Dopo una modifica:

1. ricarica l'estensione da `chrome://extensions/`;
2. apri un annuncio compatibile;
3. controlla popup, console della pagina e collegamenti generati;
4. verifica sia un annuncio con dati completi sia uno con campi mancanti.

Per convenzioni e vincoli, consulta [AGENTS.md](AGENTS.md) e [CONTRIBUTING.md](CONTRIBUTING.md).

## Limiti noti

- Il codice dipende dalla struttura interna di `#__NEXT_DATA__` e dai nomi dei campi di Immobiliare.it.
- Il confronto zona dipende da struttura della pagina interna e endpoint non versionati, che possono cambiare senza preavviso; il popup base resta comunque disponibile.
- Il confronto del prezzo usa valori grezzi; formato e unità dipendono dai dati ricevuti.
- L'origine del percorso Google Maps è vuota (`origin=`), quindi Google Maps decide l'origine.
- Il mutuo è una stima indicativa e non rappresenta un'offerta finanziaria.

## Licenza

Distribuito con licenza **MIT**. Vedi [LICENSE](LICENSE).
