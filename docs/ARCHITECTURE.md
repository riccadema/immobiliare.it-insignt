# Mappa tecnica

## Panoramica

L'estensione è un'iniezione statica lato pagina:

```mermaid
flowchart LR
    Chrome[Chrome MV3] -->|match URL| CS[content.js]
    Chrome --> CSS[style.css]
    CS --> NextData[#__NEXT_DATA__]
    NextData --> Extract[extractData]
    Extract --> Chart[fetchPriceChart]
    Chart --> API[Immobiliare.it api-next]
    Extract --> Popup[showPopup]
    Chart --> Popup
    Popup --> Maps[Google Maps]
    Popup --> Market[Mercato immobiliare]
```

Non esistono service worker, popup di estensione, options page, storage persistente o backend del progetto.

## File e responsabilità

### `manifest.json`

- Manifest version: `3`.
- Match: `https://www.immobiliare.it/annunci/*`.
- Script iniettati: `content.js` e `style.css`.
- Permesso dichiarato: `scripting`.

Il manifest non dichiara un service worker. L'esecuzione parte quindi dalla pagina compatibile, non da un contesto globale dell'estensione.

### `content.js`

Contiene tutto il comportamento applicativo:

| Area | Simboli | Ruolo |
| --- | --- | --- |
| Formattazione | `formatPrice`, `formatValue`, `formatDisponibilita` | Trasforma valori per la UI |
| Date | `formatUnixTimestampWithDays`, `dotColorBasedOnToday` | Mostra data e anzianità annuncio |
| Mercato | `formatCityName`, `fetchPriceChart` | Costruisce path e legge ultimo punto del grafico |
| Collegamenti | `generateGoogleMapsLink` | Preferisce coordinate, poi indirizzo |
| Finanza | `calcolaRataMensile` | Calcola rata con ammortamento a rata costante |
| Estrazione | `extractData` | Legge Next.js data e prepara `info`, feature e link |
| Rendering/interazione | `showPopup` | Crea popup e registra eventi UI |

### `style.css`

Stilizza il container `#immobiliare-popup`, intestazione, blocchi informativi, indicatori colore, feature list e link. Il popup è `position: fixed`, inizialmente in alto a destra, con `z-index: 9999`.

## Sequenza runtime

1. Chrome inietta i file quando l'URL soddisfa il match pattern.
2. `extractData()` cerca `#__NEXT_DATA__`; se assente termina senza UI.
3. Il testo dello script viene analizzato come JSON.
4. Il codice legge:

   ```text
   jsonData.props.pageProps.detailData.realEstate
   ```

5. `realEstate.properties[0]` fornisce i dettagli dell'immobile.
6. Vengono preparati:
   - campi informativi;
   - lista `props.ga4features`;
   - link Maps e mercato città.
7. `fetchPriceChart(region, city)` chiama l'endpoint di mercato e restituisce ultimo `label`/`value`.
8. Il valore del chart arricchisce **Prezzo al m²** e determina il colore di confronto.
9. `showPopup()` inserisce il popup nel `document.body`.
10. Gli handler gestiscono minimizzazione, drag e ricalcolo della rata proposta.

## Contratto dati osservato

Campi principali usati dal codice:

| Origine | Campi |
| --- | --- |
| `realEstate` | `createdAt`, `updatedAt`, `price.value`, `price.pricePerSquareMeter`, `properties` |
| `properties[0]` | `energy.class.name`, `energy.heatingType`, `energy.airConditioning`, `rooms`, `surface`, `availability`, `floor.floorOnlyValue`, `elevator`, `ga4Garage`, `buildingYear`, `costs.condominiumExpenses`, `ga4features` |
| `properties[0].location` | `latitude`, `longitude`, `address`, `streetNumber`, `city`, `province`, `nation.name`, `region` |
| API chart | array `labels` e array `values` non vuoti |

La struttura è fornita dal sito e non è un'API pubblica versionata. Ogni cambiamento di schema può richiedere un aggiornamento dell'estrattore.

## Richieste esterne

`fetchPriceChart()` costruisce:

```text
GET https://www.immobiliare.it/api-next/city-guide/price-chart/1/?__lang=it&path=<encoded-market-path>
```

Invia `credentials: "include"` e un referer della pagina mercato. Il progetto non salva la risposta. I link UI portano a:

- `https://www.google.com/maps/dir/?api=1...`
- `https://www.immobiliare.it/mercato-immobiliare/<region>/<city>/`

## Calcolo rata

`calcolaRataMensile(valoreImmobile, tassoAnnuo = 0.04, anni = 30)` usa:

- capitale: `valoreImmobile * 0.95`;
- rate: `anni * 12`;
- tasso mensile: `tassoAnnuo / 12`;
- formula standard di ammortamento francese.

La funzione restituisce una stringa in formato valuta italiano, non un numero.

## Interazioni UI

- **Minimizza**: alterna `display: none/block` su `#popup-body`.
- **Trascina**: usa `mousedown` sull'header, `mousemove` sul document e `mouseup` globale.
- **Proposta**: l'input `#simulated-price` ascolta `input` e aggiorna `#rata-mutuo-manuale`.
- **Link**: vengono aperti in nuova scheda con `noopener noreferrer`.

## Failure mode e limiti

- Senza `#__NEXT_DATA__`, `realEstate` o proprietà utili, `extractData()` termina senza mostrare il popup.
- `JSON.parse()` non è protetto: JSON non valido produce un errore nella console.
- `fetchPriceChart()` restituisce `null` per risposta HTTP non valida o dati incompleti, ma il callback finale destruttura il risultato; questo può impedire il rendering del popup. Un futuro fix dovrebbe separare rendering base e arricchimento chart.
- Il codice assume che `realEstate.properties[0]` esista.
- I valori sono interpolati in `innerHTML`; nuove superfici dati devono essere escapate o assegnate con `textContent`.
- Le date Unix sono interpretate nel fuso locale del browser.

Questi punti sono vincoli di manutenzione, non garanzie del sito sorgente.
