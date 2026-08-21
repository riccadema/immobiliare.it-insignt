const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const api = require("../content.js");

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.listeners = {};
    this.className = "";
    this.classList = {
      values: new Set(),
      add: (...values) => values.forEach((value) => this.classList.values.add(value)),
      remove: (...values) => values.forEach((value) => this.classList.values.delete(value)),
      toggle: (value, force) => {
        const shouldAdd = force === undefined
          ? !this.classList.values.has(value)
          : force;
        if (shouldAdd) {
          this.classList.values.add(value);
        } else {
          this.classList.values.delete(value);
        }
        return shouldAdd;
      },
    };
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  addEventListener(type, listener) {
    this.listeners[type] = listener;
  }

  dispatch(type) {
    this.listeners[type]?.({ button: 0, pointerId: 1, target: this });
  }

  getBoundingClientRect() {
    return { left: 10, top: 10 };
  }

  setPointerCapture() {}

  hasPointerCapture() {
    return false;
  }

  remove() {
    if (!this.parentNode) {
      return;
    }
    this.parentNode.children = this.parentNode.children.filter(
      (child) => child !== this
    );
    this.parentNode = null;
  }

  closest() {
    return null;
  }
}

class FakeDocument {
  constructor() {
    this.body = new FakeElement("body");
    const storage = new Map();
    this.defaultView = {
      innerWidth: 1200,
      innerHeight: 900,
      localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, String(value)),
      },
      matchMedia: () => ({ matches: false }),
    };
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  getElementById(id) {
    return findElement(this.body, (element) => element.id === id);
  }
}

function findElement(root, predicate) {
  if (predicate(root)) {
    return root;
  }
  for (const child of root.children) {
    const result = findElement(child, predicate);
    if (result) {
      return result;
    }
  }
  return null;
}

function findElements(root, predicate, result = []) {
  if (predicate(root)) {
    result.push(root);
  }
  root.children.forEach((child) => findElements(child, predicate, result));
  return result;
}

test("formatta prezzi e valori mancanti senza perdere zero", () => {
  assert.equal(api.formatPrice(0), "0 €");
  assert.equal(api.formatPrice("125000"), "125.000 €");
  assert.equal(api.formatPrice(null), "N/D");
  assert.equal(api.formatValue(0), "0");
  assert.equal(api.formatValue(undefined), "N/D");
});

test("normalizza nomi città e costruisce path mercato", () => {
  assert.equal(api.formatCityName("San Benedètto d'Àlba"), "san-benedetto-d-alba");
  assert.equal(
    api.buildMarketPath("Piemonte", "San Benedètto d'Àlba"),
    "/mercato-immobiliare/piemonte/san-benedetto-d-alba/"
  );
  assert.equal(api.buildMarketPath("", "Roma"), null);
});

test("genera link Maps con coordinate valide anche quando sono zero", () => {
  const url = new URL(
    api.generateGoogleMapsLink({ latitude: 0, longitude: 0 })
  );

  assert.equal(url.hostname, "www.google.com");
  assert.equal(url.searchParams.get("destination"), "0,0");
  assert.equal(url.searchParams.get("origin"), null);
});

test("usa indirizzo come fallback per Google Maps", () => {
  const url = new URL(
    api.generateGoogleMapsLink({
      address: "Via Roma",
      streetNumber: "10",
      city: "Torino",
      province: "TO",
    })
  );

  assert.equal(url.searchParams.get("destination"), "Via Roma, 10, Torino, TO");
});

test("calcola rata standard, tasso zero e input non validi", () => {
  const monthlyPayment = api.calculateMonthlyPayment(100000, 0.04, 30);
  assert.ok(monthlyPayment > 0);
  assert.ok(monthlyPayment < 510);
  assert.equal(api.calculateMonthlyPayment(120000, 0, 10), 950);
  assert.equal(api.calculateMonthlyPayment(0), null);
  assert.equal(api.calcolaRataMensile("non valido"), "N/D");
});

test("mantiene confronto prezzi e formato superficie senza duplicare unità", () => {
  assert.equal(
    api.formatPriceComparison(3125, 2800),
    "Annuncio: 3125 €/m² · Zona: 2800 €/m²"
  );
  assert.equal(api.formatSurface(70), "70 m²");
  assert.equal(api.formatSurface("70 m²"), "70 m²");
});

test("formatta anzianità annuncio con riferimento deterministico", () => {
  const now = 1_700_000_000_000;
  const oneDayAgo = (now - 24 * 60 * 60 * 1000) / 1000;

  assert.match(api.formatUnixTimestampWithDays(oneDayAgo, now), /^1 gg · /);
  assert.equal(api.getAgeInDays(null, now), null);
  assert.equal(api.dotColorBasedOnToday(null, now), null);
});

test("gestisce proprietà mancanti durante estrazione view model", () => {
  const model = api.buildViewModel({
    price: { value: 250000, pricePerSquareMeter: 3000 },
    properties: [{}],
  });

  assert.equal(model.price, 250000);
  assert.equal(model.pricePerSquareMeter, 3000);
  assert.equal(model.features.length, 0);
  assert.ok(model.info.every((item) => typeof item.value === "string"));
  assert.equal(model.info.some((item) => item.key === "price"), false);
  assert.equal(model.info.some((item) => item.key === "pricePerSquareMeter"), false);
  assert.equal(model.info.some((item) => item.key === "availability"), false);
  assert.equal(model.info.some((item) => item.key === "loan"), false);
  assert.equal(model.links.length, 0);
});

test("assegna colore semantico ai box e mantiene griglia standard", () => {
  const model = api.buildViewModel({
    properties: [
      {
        availability: "libero",
        buildingYear: 2020,
        energy: { class: { name: "B" }, heatingType: "Riscaldamento molto lungo" },
        location: { city: "Roma" },
      },
    ],
  });
  const fields = Object.fromEntries(model.info.map((item) => [item.key, item]));
  const popup = api.showPopup(model, new FakeDocument());
  const availabilityMetric = findElement(
    popup,
    (element) => element.dataset.field === "availability"
  );

  assert.equal(fields.energy.tone, "positive");
  assert.equal(fields.buildingYear.tone, "positive");
  assert.match(availabilityMetric.className, /ii-hero-metric--positive/);
  assert.equal(fields.heating.wide, undefined);
  assert.equal(fields.airConditioning.wide, undefined);
});

test("colora spese condominiali in base all'importo", () => {
  const getExpenses = (value) => {
    const model = api.buildViewModel({
      properties: [{ costs: { condominiumExpenses: value } }],
    });
    return model.info.find((item) => item.key === "condominiumExpenses");
  };

  assert.deepEqual(getExpenses(0), {
    key: "condominiumExpenses",
    label: "Spese condominiali",
    value: "Nessuna spesa condominiale",
    tone: "positive",
  });
  assert.equal(getExpenses("Nessuna").tone, "positive");
  assert.equal(getExpenses(50).tone, "positive");
  assert.equal(getExpenses(51).tone, "warning");
  assert.equal(getExpenses(100).tone, "warning");
  assert.equal(getExpenses(100.01).tone, "negative");
  assert.equal(api.formatCondominiumExpenses(undefined), "N/D");
});

test("marca in rosso i campi non disponibili", () => {
  const documentMock = new FakeDocument();
  const popup = api.showPopup(
    api.buildViewModel({ properties: [{}] }),
    documentMock
  );
  const missingBlocks = findElements(
    popup,
    (element) => element.className.includes("ii-info-block--missing")
  );
  const missingMetrics = findElements(
    popup,
    (element) => element.className.includes("ii-hero-metric--missing")
  );

  assert.ok(missingBlocks.length >= 8);
  assert.equal(missingMetrics.length, 3);
});

test("mostra prezzo annuncio, prezzo zona e disponibilità solo nell'hero", () => {
  const documentMock = new FakeDocument();
  const model = api.buildViewModel({
    price: { value: 250000, pricePerSquareMeter: 3125 },
    properties: [
      { availability: "libero", location: { region: "Lazio", city: "Roma" } },
    ],
  });
  const popup = api.showPopup(model, documentMock);
  const infoBlocks = findElements(
    popup,
    (element) => element.className.includes("ii-info-block")
  );
  const heroFields = findElements(
    popup,
    (element) => element.dataset.field
  ).map((element) => element.dataset.field);
  const heroTop = findElement(
    popup,
    (element) => element.className.includes("ii-hero-top")
  );
  const heroMetrics = findElement(
    popup,
    (element) => element.className.includes("ii-hero-metrics")
  );

  assert.ok(heroFields.includes("listingPricePerSquareMeter"));
  assert.ok(heroFields.includes("marketPricePerSquareMeter"));
  assert.ok(heroFields.includes("availability"));
  assert.equal(heroTop.children[1].dataset.field, "availability");
  assert.deepEqual(
    heroMetrics.children.map((metric) => metric.dataset.field),
    ["listingPricePerSquareMeter", "marketPricePerSquareMeter"]
  );
  assert.equal(heroMetrics.children[1].tagName, "A");
  assert.equal(
    heroMetrics.children[1].href,
    "https://www.immobiliare.it/mercato-immobiliare/lazio/roma/"
  );
  assert.equal(
    infoBlocks.some((block) => block.dataset.field === "pricePerSquareMeter"),
    false
  );
  assert.equal(
    infoBlocks.some((block) => block.dataset.field === "availability"),
    false
  );
});

test("legge realEstate da __NEXT_DATA__", () => {
  const realEstate = { properties: [{ rooms: 2 }] };
  const documentMock = {
    querySelector(selector) {
      assert.equal(selector, "#__NEXT_DATA__");
      return { textContent: JSON.stringify({ props: { pageProps: { detailData: { realEstate } } } }) };
    },
  };

  assert.deepEqual(api.readRealEstateFromDocument(documentMock), realEstate);
});

test("price chart preferisce media pagina mercato al range API", async () => {
  const originalFetch = global.fetch;
  const fixture = fs.readFileSync(
    path.join(__dirname, "market-page.fixture.html"),
    "utf8"
  );
  const requestedUrls = [];
  global.fetch = async (url) => {
    requestedUrls.push(url);
    return {
      ok: true,
      async text() {
        return fixture;
      },
    };
  };

  try {
    assert.deepEqual(await api.fetchPriceChart("Lazio", "Roma"), {
      label: "pagina mercato",
      value: 1457,
      source: "market-page",
    });
    assert.equal(requestedUrls.length, 1);
    assert.ok(requestedUrls[0].endsWith("/mercato-immobiliare/lazio/roma/"));
  } finally {
    global.fetch = originalFetch;
  }
});

test("usa API chart come fallback quando pagina mercato non è disponibile", async () => {
  const originalFetch = global.fetch;
  const requestedUrls = [];
  global.fetch = async (url) => {
    requestedUrls.push(url);
    if (String(url).includes("/mercato-immobiliare/")) {
      return { ok: false, status: 503 };
    }
    return {
      ok: true,
      async json() {
        return { labels: ["2024", "2025"], values: ["1.900", 2100] };
      },
    };
  };

  try {
    assert.deepEqual(await api.fetchPriceChart("Lazio", "Roma"), {
      label: "2025",
      value: 2100,
      source: "api",
    });
    assert.equal(requestedUrls.length, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test("estrae prezzo medio dalla pagina mercato", () => {
  const fixture = fs.readFileSync(
    path.join(__dirname, "market-page.fixture.html"),
    "utf8"
  );

  assert.deepEqual(api.extractMarketPriceFromHtml(fixture), {
    label: "pagina mercato",
    value: 1457,
    source: "market-page",
  });
});

test("ignora range min/max anche con unità HTML spezzata", () => {
  assert.deepEqual(
    api.extractMarketPriceFromHtml(`
      <p>da 401 €/m<sup>2</sup> a 2.112 €/m<sup>2</sup></p>
      <strong>€ 1.457 €/m<sup>2</sup></strong>
    `),
    {
      label: "pagina mercato",
      value: 1457,
      source: "market-page",
    }
  );
});

test("restituisce N/D quando pagina mercato e API non sono disponibili", async () => {
  const originalFetch = global.fetch;
  const requestedUrls = [];
  global.fetch = async (url) => {
    requestedUrls.push(url);
    return { ok: false, status: 503 };
  };

  try {
    assert.equal(await api.fetchPriceChart("Lazio", "Roma"), null);
    assert.equal(requestedUrls.length, 2);
    assert.ok(String(requestedUrls[0]).endsWith("/mercato-immobiliare/lazio/roma/"));
  } finally {
    global.fetch = originalFetch;
  }
});

test("renderizza popup sicuro, simulatore e chiusura", () => {
  const documentMock = new FakeDocument();
  const model = api.buildViewModel({
    price: { value: 200000 },
    properties: [
      {
        ga4features: ["Balcone", "<img src=x onerror=alert(1)>"],
        location: { city: "Roma" },
      },
    ],
  });

  const popup = api.showPopup(model, documentMock);
  const featureItems = findElements(
    popup,
    (element) => element.tagName === "LI"
  );
  const input = findElement(popup, (element) => element.id === "simulated-price");
  const output = findElement(popup, (element) => element.id === "rata-mutuo-manuale");
  const buttons = findElements(popup, (element) => element.tagName === "BUTTON");
  const inputs = findElements(popup, (element) => element.tagName === "INPUT");
  const summaries = findElements(popup, (element) => element.tagName === "SUMMARY");

  assert.equal(documentMock.body.children.length, 1);
  assert.equal(featureItems[1].textContent, "<img src=x onerror=alert(1)>");
  assert.notEqual(output.textContent, "N/D");
  assert.equal(inputs.length, 4);
  assert.ok(summaries.some((summary) => summary.textContent === "Modifica parametri mutuo"));

  input.value = "100000";
  input.dispatch("input");
  assert.notEqual(output.textContent, "N/D");
  inputs[1].value = "80";
  inputs[1].dispatch("input");
  assert.equal(
    JSON.parse(
      documentMock.defaultView.localStorage.getItem("immobiliare-insight-mortgage")
    ).loanPercentage,
    80
  );

  buttons[0].dispatch("click");
  assert.ok(popup.classList.values.has("ii-theme-dark"));
  assert.equal(documentMock.defaultView.localStorage.getItem("immobiliare-insight-theme"), "dark");

  const secondPopup = api.showPopup(model, documentMock);
  assert.ok(secondPopup.classList.values.has("ii-theme-dark"));
  const secondButtons = findElements(
    secondPopup,
    (element) => element.tagName === "BUTTON"
  );
  secondButtons[2].dispatch("click");
  assert.equal(documentMock.body.children.length, 0);
});
