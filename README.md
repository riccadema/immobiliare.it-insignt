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

- data di creazione e aggiornamento, inclusi giorni trascorsi;
- prezzo, prezzo al m² e confronto con l'ultimo valore del grafico di mercato;
- locali, superficie, piano e ascensore;
- classe energetica con indicatore cromatico;
- disponibilità, riscaldamento, condizionamento, garage, anno di costruzione e spese condominiali;
- stima della rata mensile usando mutuo al 95%, tasso annuo del 4% e durata di 30 anni;
- elenco delle caratteristiche dell'immobile;
- link a Google Maps e alla pagina del mercato immobiliare della città;
- simulazione di una proposta: modificando **Importo Proposta** viene ricalcolata la rata.

## Ambito di esecuzione e dati

Il manifest abilita il content script solo per:

```text
https://www.immobiliare.it/annunci/*
```

L'estensione:

- non contiene popup di Chrome, options page o service worker;
- non usa un backend proprietario, database o storage persistente;
- legge `#__NEXT_DATA__` dalla pagina dell'annuncio;
- interroga l'endpoint di mercato di Immobiliare.it per l'ultimo dato del grafico;
- apre collegamenti esterni a Google Maps quando l'utente li seleziona.

I dettagli tecnici e il flusso completo sono in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Struttura del progetto

```text
immobiliare.it-insignt/
├── manifest.json                  # Contratto Chrome MV3
├── content.js                     # Estrazione dati, API e UI
├── style.css                      # Stili del popup iniettato
├── showcase.gif                   # Demo visiva
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

Non esiste una pipeline automatica configurata. Dopo una modifica:

1. ricarica l'estensione da `chrome://extensions/`;
2. apri un annuncio compatibile;
3. controlla popup, console della pagina e collegamenti generati;
4. verifica sia un annuncio con dati completi sia uno con campi mancanti.

Per convenzioni e vincoli, consulta [AGENTS.md](AGENTS.md) e [CONTRIBUTING.md](CONTRIBUTING.md).

## Limiti noti

- Il codice dipende dalla struttura interna di `#__NEXT_DATA__` e dai nomi dei campi di Immobiliare.it.
- La risposta del price chart proviene da un endpoint interno al sito e può cambiare senza preavviso.
- Il rendering viene completato nel callback della richiesta del price chart: se la richiesta restituisce dati assenti o fallisce, il popup può non apparire.
- Il confronto del prezzo usa valori grezzi; formato e unità dipendono dai dati ricevuti.
- L'origine del percorso Google Maps è vuota (`origin=`), quindi Google Maps decide l'origine.
- Il mutuo è una stima indicativa e non rappresenta un'offerta finanziaria.

## Licenza

Distribuito con licenza **MIT**. Vedi [LICENSE](LICENSE).
