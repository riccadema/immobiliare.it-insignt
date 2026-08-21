"use strict";

const POPUP_ID = "immobiliare-popup";
const THEME_STORAGE_KEY = "immobiliare-insight-theme";
const MORTGAGE_STORAGE_KEY = "immobiliare-insight-mortgage";
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const DEFAULT_MORTGAGE = Object.freeze({
  loanPercentage: 95,
  annualRate: 4,
  years: 30,
});
const EURO_FORMATTER = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function toFiniteNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  if (!normalized) {
    return null;
  }

  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function formatPrice(value) {
  const number = toFiniteNumber(value);
  return number === null ? "N/D" : EURO_FORMATTER.format(number);
}

function formatPricePerSquareMeter(value) {
  const number = toFiniteNumber(value);
  return number === null ? "N/D" : `${EURO_FORMATTER.format(number)}/m²`;
}

function formatPriceComparison(listingValue, marketValue = null) {
  const marketLabel =
    marketValue === null
      ? "caricamento…"
      : formatPricePerSquareMeter(marketValue);
  return `Annuncio: ${formatPricePerSquareMeter(
    listingValue
  )} · Zona: ${marketLabel}`;
}

function formatValue(value, suffix = "") {
  if (value === null || value === undefined || value === "") {
    return "N/D";
  }

  return `${String(value)}${suffix}`;
}

function formatSurface(value) {
  const number = toFiniteNumber(value);
  return number === null
    ? formatValue(value)
    : `${number.toLocaleString("it-IT")} m²`;
}

function formatDisponibilita(value) {
  if (value === null || value === undefined || value === "") {
    return "N/D";
  }

  const text = String(value);
  return text.toLowerCase() === "libero" ? `${text} ✅` : `${text} ❌`;
}

function formatCityName(city) {
  if (typeof city !== "string") {
    return "";
  }

  return city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildMarketPath(region, city) {
  const regionSlug = formatCityName(region);
  const citySlug = formatCityName(city);

  if (!regionSlug || !citySlug) {
    return null;
  }

  return `/mercato-immobiliare/${regionSlug}/${citySlug}/`;
}

async function fetchPriceChart(region, city) {
  const path = buildMarketPath(region, city);
  if (!path) {
    return null;
  }

  // La pagina mercato espone il valore medio insieme al range min/max.
  // Va preferita all'API chart, che può restituire il limite inferiore.
  const marketPagePrice = await fetchMarketPagePrice(path);
  if (marketPagePrice) {
    return marketPagePrice;
  }

  return fetchPriceChartFromApi(path);
}

async function fetchPriceChartFromApi(path) {
  const url = `https://www.immobiliare.it/api-next/city-guide/price-chart/1/?__lang=it&path=${encodeURIComponent(
    path
  )}`;

  try {
    const response = await fetch(url, {
      credentials: "include",
    });

    if (response.ok) {
      const data = await response.json();
      const labels = Array.isArray(data?.labels) ? data.labels : [];
      const values = Array.isArray(data?.values) ? data.values : [];
      const lastIndex = Math.min(labels.length, values.length) - 1;
      const value = lastIndex >= 0 ? toFiniteNumber(values[lastIndex]) : null;

      if (value !== null) {
        return {
          label: labels[lastIndex] === undefined ? "" : String(labels[lastIndex]),
          value,
          source: "api",
        };
      }
    } else {
      console.warn(`Price chart API non disponibile: HTTP ${response.status}`);
    }
  } catch (error) {
    console.warn("Price chart API non raggiungibile", error);
  }

  return null;
}

function extractMarketPriceFromHtml(html) {
  if (typeof html !== "string" || !html.trim()) {
    return null;
  }

  const normalizedHtml = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&euro;|&#8364;|&#x20ac;/gi, "€")
    .replace(/&sup2;|&#178;|&#xB2;/gi, "²")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ");

  const numberPattern =
    "(?:[0-9]{1,3}(?:[.\\s][0-9]{3})*(?:,[0-9]+)?|[0-9]+(?:[.,][0-9]+)?)";
  const priceUnitPattern = `\\s*€?\\s*/\\s*m\\s*(?:²|2)`;
  const averagePattern = new RegExp(
    `(?:prezzo\\s+medio|media\\b(?:\\s+(?:di|del|degli|delle|della))?|valore\\s+medio|quotazione\\s+media)[^0-9]{0,180}${numberPattern}${priceUnitPattern}`,
    "i"
  );

  const toResult = (text) => {
    const numberMatch = text.match(new RegExp(numberPattern));
    const value = numberMatch ? toFiniteNumber(numberMatch[0]) : null;
    return value === null
      ? null
      : { label: "pagina mercato", value, source: "market-page" };
  };

  const averageMatch = normalizedHtml.match(averagePattern);
  if (averageMatch && !/\bda\b/i.test(averageMatch[0])) {
    const result = toResult(averageMatch[0]);
    if (result) {
      return result;
    }
  }

  const rangePattern = new RegExp(
    `\\bda\\s+${numberPattern}${priceUnitPattern}\\s+a\\s+${numberPattern}${priceUnitPattern}`,
    "gi"
  );
  const rangeSpans = [...normalizedHtml.matchAll(rangePattern)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
  const genericPattern = new RegExp(
    `${numberPattern}${priceUnitPattern}`,
    "gi"
  );

  for (const match of normalizedHtml.matchAll(genericPattern)) {
    const isRangeValue = rangeSpans.some(
      ({ start, end }) => match.index >= start && match.index < end
    );
    if (!isRangeValue) {
      const result = toResult(match[0]);
      if (result) {
        return result;
      }
    }
  }

  return null;
}

async function fetchMarketPagePrice(path) {
  const url = `https://www.immobiliare.it${path}`;

  try {
    const response = await fetch(url, {
      credentials: "include",
      headers: {
        accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      console.warn(`Pagina mercato non disponibile: HTTP ${response.status}`);
      return null;
    }

    const html = await response.text();
    const result = extractMarketPriceFromHtml(html);
    if (!result) {
      console.warn("Prezzo zona non trovato nella pagina mercato");
    }
    return result;
  } catch (error) {
    console.warn("Pagina mercato non raggiungibile", error);
    return null;
  }
}

function generateGoogleMapsLink(location) {
  if (!location || typeof location !== "object") {
    return null;
  }

  const latitude = toFiniteNumber(location.latitude);
  const longitude = toFiniteNumber(location.longitude);
  const destination =
    latitude !== null && longitude !== null
      ? `${latitude},${longitude}`
      : [
          location.address,
          location.streetNumber,
          location.city,
          location.province,
          location.nation?.name,
        ]
          .filter(Boolean)
          .join(", ");

  if (!destination) {
    return null;
  }

  const params = new URLSearchParams({
    api: "1",
    destination,
    travelmode: "driving",
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function calculateMonthlyPayment(
  propertyValue,
  annualRate = 0.04,
  years = 30,
  loanRatio = 0.95
) {
  const value = toFiniteNumber(propertyValue);
  const rate = toFiniteNumber(annualRate);
  const duration = toFiniteNumber(years);
  const ratio = toFiniteNumber(loanRatio);

  if (
    value === null ||
    rate === null ||
    duration === null ||
    ratio === null ||
    value <= 0 ||
    rate < 0 ||
    duration <= 0 ||
    ratio <= 0
  ) {
    return null;
  }

  const principal = value * ratio;
  const months = Math.round(duration * 12);
  if (months <= 0) {
    return null;
  }

  const monthlyRate = rate / 12;
  if (monthlyRate === 0) {
    return principal / months;
  }

  const growth = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * growth) / (growth - 1);
}

function calcolaRataMensile(
  propertyValue,
  annualRate = DEFAULT_MORTGAGE.annualRate / 100,
  years = DEFAULT_MORTGAGE.years,
  loanRatio = DEFAULT_MORTGAGE.loanPercentage / 100
) {
  const payment = calculateMonthlyPayment(
    propertyValue,
    annualRate,
    years,
    loanRatio
  );
  return payment === null ? "N/D" : formatPrice(payment);
}

function getAgeInDays(seconds, now = Date.now()) {
  const timestamp = toFiniteNumber(seconds);
  if (timestamp === null) {
    return null;
  }

  return Math.floor((now - timestamp * 1000) / DAY_IN_MILLISECONDS);
}

function formatUnixTimestampWithDays(seconds, now = Date.now()) {
  const timestamp = toFiniteNumber(seconds);
  const ageInDays = getAgeInDays(seconds, now);
  if (timestamp === null || ageInDays === null) {
    return "N/D";
  }

  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) {
    return "N/D";
  }

  const ageLabel =
    ageInDays >= 0
      ? `${ageInDays} gg`
      : `tra ${Math.abs(ageInDays)} gg`;
  return `${ageLabel} · ${date.toLocaleDateString("it-IT")}`;
}

function dotColorBasedOnToday(seconds, now = Date.now()) {
  const ageInDays = getAgeInDays(seconds, now);
  if (ageInDays === null) {
    return null;
  }

  if (ageInDays < 0) {
    return "#2563eb";
  }
  if (ageInDays <= 20) {
    return "#16a34a";
  }
  if (ageInDays <= 45) {
    return "#ca8a04";
  }
  return "#dc2626";
}

function toneBasedOnAge(seconds, now = Date.now()) {
  const ageInDays = getAgeInDays(seconds, now);
  if (ageInDays === null) {
    return null;
  }
  if (ageInDays < 0) {
    return "info";
  }
  if (ageInDays <= 20) {
    return "positive";
  }
  if (ageInDays <= 45) {
    return "warning";
  }
  return "negative";
}

function toneBasedOnAvailability(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return String(value).toLowerCase() === "libero" ? "positive" : "warning";
}

function toneBasedOnEnergyClass(energyClass) {
  if (!energyClass) {
    return null;
  }
  if (["A4", "A3", "A2", "A1", "B"].includes(energyClass)) {
    return "positive";
  }
  if (["C", "D", "E"].includes(energyClass)) {
    return "warning";
  }
  return "negative";
}

function toneBasedOnBuildingYear(value, currentYear = new Date().getFullYear()) {
  const year = toFiniteNumber(value);
  if (year === null) {
    return null;
  }
  if (year >= currentYear - 25) {
    return "positive";
  }
  if (year >= currentYear - 50) {
    return "warning";
  }
  return "negative";
}

function hasNoCondominiumExpenses(value) {
  if (value === null || value === undefined || value === "") {
    return false;
  }

  const normalized = String(value).trim().toLowerCase();
  return (
    toFiniteNumber(value) === 0 ||
    /^(nessun[ao]?|nessuno|no|gratuit[oa]|gratis)$/.test(normalized) ||
    /^(nessun[ao]?|nessuno|no)\s+(?:spesa|spese|costo|costi)\b/.test(
      normalized
    )
  );
}

function formatCondominiumExpenses(value) {
  if (value === null || value === undefined || value === "") {
    return "N/D";
  }
  return hasNoCondominiumExpenses(value)
    ? "Nessuna spesa condominiale"
    : formatValue(value);
}

function toneBasedOnCondominiumExpenses(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (hasNoCondominiumExpenses(value)) {
    return "positive";
  }

  const amount = toFiniteNumber(value);
  if (amount === null) {
    return null;
  }
  if (amount <= 50) {
    return "positive";
  }
  if (amount <= 100) {
    return "warning";
  }
  return "negative";
}

function getStoredTheme(doc) {
  try {
    const storedTheme = doc?.defaultView?.localStorage?.getItem(
      THEME_STORAGE_KEY
    );
    return storedTheme === "dark" || storedTheme === "light"
      ? storedTheme
      : null;
  } catch (error) {
    console.warn("Tema salvato non disponibile", error);
    return null;
  }
}

function getInitialTheme(doc) {
  const storedTheme = getStoredTheme(doc);
  if (storedTheme) {
    return storedTheme;
  }

  try {
    return doc?.defaultView?.matchMedia?.("(prefers-color-scheme: dark)")
      ?.matches
      ? "dark"
      : "light";
  } catch (error) {
    console.warn("Preferenza tema di sistema non disponibile", error);
    return "light";
  }
}

function persistTheme(doc, theme) {
  try {
    doc?.defaultView?.localStorage?.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.warn("Impossibile salvare preferenza tema", error);
  }
}

function applyTheme(container, theme) {
  const normalizedTheme = theme === "dark" ? "dark" : "light";
  container.classList.remove("ii-theme-light", "ii-theme-dark");
  container.classList.add(`ii-theme-${normalizedTheme}`);
  container.dataset.theme = normalizedTheme;
  return normalizedTheme;
}

function updateThemeToggle(button, theme) {
  const isDark = theme === "dark";
  button.textContent = isDark ? "☀" : "☾";
  button.setAttribute("aria-pressed", String(isDark));
  button.setAttribute(
    "aria-label",
    isDark ? "Attiva tema chiaro" : "Attiva tema scuro"
  );
  button.title = isDark ? "Tema chiaro" : "Tema scuro";
}

function normalizeMortgageSettings(settings = {}) {
  const loanPercentage = toFiniteNumber(settings.loanPercentage);
  const annualRate = toFiniteNumber(settings.annualRate);
  const years = toFiniteNumber(settings.years);

  return {
    loanPercentage:
      loanPercentage !== null && loanPercentage > 0 && loanPercentage <= 100
        ? loanPercentage
        : DEFAULT_MORTGAGE.loanPercentage,
    annualRate:
      annualRate !== null && annualRate >= 0 && annualRate <= 100
        ? annualRate
        : DEFAULT_MORTGAGE.annualRate,
    years:
      years !== null && years > 0 && years <= 50
        ? years
        : DEFAULT_MORTGAGE.years,
  };
}

function getStoredMortgageSettings(doc) {
  try {
    const raw = doc?.defaultView?.localStorage?.getItem(
      MORTGAGE_STORAGE_KEY
    );
    return raw ? normalizeMortgageSettings(JSON.parse(raw)) : { ...DEFAULT_MORTGAGE };
  } catch (error) {
    console.warn("Parametri mutuo salvati non disponibili", error);
    return { ...DEFAULT_MORTGAGE };
  }
}

function persistMortgageSettings(doc, settings) {
  try {
    doc?.defaultView?.localStorage?.setItem(
      MORTGAGE_STORAGE_KEY,
      JSON.stringify(normalizeMortgageSettings(settings))
    );
  } catch (error) {
    console.warn("Impossibile salvare parametri mutuo", error);
  }
}

function readRealEstateFromDocument(doc) {
  const scriptTag = doc?.querySelector?.("#__NEXT_DATA__");
  if (!scriptTag?.textContent) {
    return null;
  }

  let jsonData;
  try {
    jsonData = JSON.parse(scriptTag.textContent);
  } catch (error) {
    console.error("Impossibile analizzare __NEXT_DATA__", error);
    return null;
  }

  const realEstate = jsonData?.props?.pageProps?.detailData?.realEstate;
  if (!realEstate || !Array.isArray(realEstate.properties)) {
    console.warn("Dati annuncio non disponibili in __NEXT_DATA__");
    return null;
  }

  return realEstate;
}

function buildViewModel(realEstate) {
  const props = realEstate?.properties?.[0] || {};
  const location = props.location || {};
  const energyClass = props.energy?.class?.name;
  const price = toFiniteNumber(realEstate?.price?.value);
  const pricePerSquareMeter = toFiniteNumber(
    realEstate?.price?.pricePerSquareMeter
  );
  const features = Array.isArray(props.ga4features)
    ? props.ga4features
        .filter((feature) => feature !== null && feature !== undefined)
        .map((feature) => String(feature).trim())
        .filter(Boolean)
    : [];
  const marketPath = buildMarketPath(location.region, location.city);
  const marketUrl = marketPath
    ? `https://www.immobiliare.it${marketPath}`
    : null;
  const links = [];
  const mapsLink = generateGoogleMapsLink(location);

  if (mapsLink) {
    links.push({ label: "Apri in Google Maps", url: mapsLink });
  }
  if (marketUrl) {
    links.push({
      label: "Mercato immobiliare",
      url: marketUrl,
    });
  }

  const elevator =
    props.elevator === null || props.elevator === undefined
      ? "N/D"
      : props.elevator
        ? "Sì"
        : "No";

  return {
    title: location.city
      ? `Analisi annuncio · ${String(location.city)}`
      : "Analisi annuncio",
    price,
    pricePerSquareMeter,
    availability: props.availability,
    availabilityLabel: formatDisponibilita(props.availability),
    region: location.region,
    city: location.city,
    marketUrl,
    features,
    links,
    info: [
      {
        key: "created",
        label: "Pubblicato",
        value: formatUnixTimestampWithDays(realEstate?.createdAt),
        tone: toneBasedOnAge(realEstate?.createdAt),
      },
      {
        key: "updated",
        label: "Aggiornato",
        value: formatUnixTimestampWithDays(realEstate?.updatedAt),
        tone: toneBasedOnAge(realEstate?.updatedAt),
      },
      {
        key: "roomsSurface",
        label: "Locali · Superficie",
        value: `${formatValue(props.rooms)} Locali · ${formatSurface(props.surface)}`,
      },
      {
        key: "floor",
        label: "Piano · Ascensore",
        value: `${formatValue(props.floor?.floorOnlyValue)} · ${elevator}`,
      },
      {
        key: "energy",
        label: "Classe energetica",
        value: energyClass || "N/D",
        tone: toneBasedOnEnergyClass(energyClass),
      },
      {
        key: "heating",
        label: "Riscaldamento",
        value: formatValue(props.energy?.heatingType),
      },
      {
        key: "airConditioning",
        label: "Condizionamento",
        value: formatValue(props.energy?.airConditioning),
      },
      {
        key: "garage",
        label: "Garage",
        value: formatValue(props.ga4Garage),
      },
      {
        key: "buildingYear",
        label: "Anno costruzione",
        value: formatValue(props.buildingYear),
        tone: toneBasedOnBuildingYear(props.buildingYear),
      },
      {
        key: "condominiumExpenses",
        label: "Spese condominiali",
        value: formatCondominiumExpenses(props.costs?.condominiumExpenses),
        tone: toneBasedOnCondominiumExpenses(
          props.costs?.condominiumExpenses
        ),
      },
    ],
  };
}

function createElement(doc, tagName, className, text) {
  const element = doc.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function createSectionHeading(doc, eyebrow, title) {
  const heading = createElement(doc, "div", "ii-section-heading");
  heading.appendChild(createElement(doc, "span", "ii-eyebrow", eyebrow));
  heading.appendChild(createElement(doc, "h3", "ii-section-title", title));
  return heading;
}

function resolveTone(tone, value) {
  if (
    value === null ||
    value === undefined ||
    String(value).includes("N/D")
  ) {
    return "missing";
  }
  return tone || "info";
}

function createInfoBlock(doc, item) {
  const classes = ["ii-info-block"];
  if (item.wide) {
    classes.push("ii-info-block--wide");
  }
  classes.push(`ii-info-block--${resolveTone(item.tone, item.value)}`);
  const block = createElement(doc, "div", classes.join(" "));
  block.dataset.field = item.key;

  const label = createElement(doc, "span", "ii-info-label", item.label);
  const value = createElement(doc, "span", "ii-info-value");
  const valueText = createElement(doc, "span", "ii-value-text", item.value);
  value.appendChild(valueText);

  block.appendChild(label);
  block.appendChild(value);
  return block;
}

function formatMortgageSummary(settings) {
  return `Mutuo ${settings.loanPercentage}% · ${settings.annualRate}% annuo · ${settings.years} anni`;
}

function updateMonthlyPayment(
  proposalInput,
  loanPercentageInput,
  annualRateInput,
  yearsInput,
  output,
  summary
) {
  const settings = normalizeMortgageSettings({
    loanPercentage: loanPercentageInput.value,
    annualRate: annualRateInput.value,
    years: yearsInput.value,
  });
  const payment = calcolaRataMensile(
    proposalInput.value,
    settings.annualRate / 100,
    settings.years,
    settings.loanPercentage / 100
  );
  output.textContent = payment;
  output.classList.toggle("ii-output--empty", payment === "N/D");
  summary.textContent = formatMortgageSummary(settings);
  return settings;
}

function setupDragging(doc, container, header) {
  let dragState = null;
  const view =
    doc.defaultView ||
    (typeof window !== "undefined" ? window : {
      innerWidth: 1920,
      innerHeight: 1080,
    });

  header.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("button")) {
      return;
    }

    const rect = container.getBoundingClientRect();
    dragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    header.setPointerCapture(event.pointerId);
    container.classList.add("ii-is-dragging");
  });

  header.addEventListener("pointermove", (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const maxLeft = Math.max(8, view.innerWidth - container.offsetWidth - 8);
    const maxTop = Math.max(8, view.innerHeight - container.offsetHeight - 8);
    const left = Math.min(
      Math.max(8, event.clientX - dragState.offsetX),
      maxLeft
    );
    const top = Math.min(
      Math.max(8, event.clientY - dragState.offsetY),
      maxTop
    );

    container.style.left = `${left}px`;
    container.style.top = `${top}px`;
    container.style.right = "auto";
  });

  const stopDragging = (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    dragState = null;
    container.classList.remove("ii-is-dragging");
    if (header.hasPointerCapture?.(event.pointerId)) {
      header.releasePointerCapture(event.pointerId);
    }
  };

  header.addEventListener("pointerup", stopDragging);
  header.addEventListener("pointercancel", stopDragging);
}

function updateMarketComparison(container, viewModel, chart) {
  if (!container || viewModel.pricePerSquareMeter === null) {
    return;
  }

  const marketMetric = container.querySelector(
    '[data-field="marketPricePerSquareMeter"]'
  );
  const valueText = marketMetric?.querySelector(".ii-hero-value");
  if (!marketMetric || !valueText) {
    return;
  }

  const marketValue = chart ? toFiniteNumber(chart.value) : null;
  valueText.textContent = formatPricePerSquareMeter(marketValue);
  marketMetric.classList.remove(
    "ii-hero-metric--info",
    "ii-hero-metric--positive",
    "ii-hero-metric--warning",
    "ii-hero-metric--missing"
  );
  marketMetric.removeAttribute("title");
  if (marketValue === null) {
    marketMetric.classList.add("ii-hero-metric--missing");
    return;
  }

  const difference = viewModel.pricePerSquareMeter - marketValue;
  const relation =
    difference > 0
      ? { className: "ii-hero-metric--warning", label: "Sopra la media" }
      : difference < 0
        ? { className: "ii-hero-metric--positive", label: "Sotto la media" }
        : { className: "ii-hero-metric--info", label: "In linea con la media" };
  marketMetric.classList.add(relation.className);
  marketMetric.setAttribute(
    "title",
    `${formatPriceComparison(viewModel.pricePerSquareMeter, marketValue)} · ${
      relation.label
    }${chart.label ? ` · ${chart.label}` : ""}`
  );
}

function createHeroMetric(doc, label, value, tone, field, url = null) {
  const classes = [
    "ii-hero-metric",
    `ii-hero-metric--${resolveTone(tone, value)}`,
  ];
  if (url) {
    classes.push("ii-hero-metric--link");
  }
  const metric = createElement(doc, url ? "a" : "div", classes.join(" "));
  if (field) {
    metric.dataset.field = field;
  }
  if (url) {
    metric.href = url;
    metric.target = "_blank";
    metric.rel = "noopener noreferrer";
    metric.setAttribute(
      "aria-label",
      `${label}: ${value}. Apri mercato immobiliare`
    );
  }
  metric.appendChild(createElement(doc, "span", "ii-hero-label", label));
  metric.appendChild(createElement(doc, "strong", "ii-hero-value", value));
  return metric;
}

function showPopup(viewModel, doc) {
  if (!doc?.body) {
    return null;
  }

  doc.getElementById(POPUP_ID)?.remove();

  const container = createElement(doc, "aside", "ii-popup");
  container.id = POPUP_ID;
  applyTheme(container, getInitialTheme(doc));
  container.setAttribute("role", "dialog");
  container.setAttribute("aria-label", "Immobiliare.it Insight");
  container.setAttribute("aria-live", "polite");

  const header = createElement(doc, "header", "ii-header");
  const identity = createElement(doc, "div", "ii-identity");
  identity.appendChild(createElement(doc, "span", "ii-brand", "IMMOBILIARE.IT"));
  identity.appendChild(createElement(doc, "h2", "ii-title", viewModel.title));
  header.appendChild(identity);

  const actions = createElement(doc, "div", "ii-actions");
  const themeToggle = createElement(doc, "button", "ii-icon-button", "☾");
  themeToggle.type = "button";
  updateThemeToggle(themeToggle, container.dataset.theme);
  const minimizeButton = createElement(doc, "button", "ii-icon-button", "−");
  minimizeButton.type = "button";
  minimizeButton.setAttribute("aria-label", "Minimizza pannello");
  minimizeButton.setAttribute("aria-expanded", "true");
  minimizeButton.setAttribute("aria-controls", "immobiliare-popup-body");
  const closeButton = createElement(doc, "button", "ii-icon-button", "×");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Chiudi pannello");
  actions.appendChild(themeToggle);
  actions.appendChild(minimizeButton);
  actions.appendChild(closeButton);
  header.appendChild(actions);

  const body = createElement(doc, "div", "ii-body");
  body.id = "immobiliare-popup-body";
  const hero = createElement(doc, "section", "ii-hero");
  const heroTop = createElement(doc, "div", "ii-hero-top");
  const heroMain = createElement(doc, "div", "ii-hero-main");
  heroMain.appendChild(
    createElement(doc, "span", "ii-eyebrow", "PREZZO RICHIESTO")
  );
  heroMain.appendChild(
    createElement(
      doc,
      "strong",
      `ii-hero-price ii-hero-price--${resolveTone(
        null,
        formatPrice(viewModel.price)
      )}`,
      formatPrice(viewModel.price)
    )
  );
  heroTop.appendChild(heroMain);
  heroTop.appendChild(
    createHeroMetric(
      doc,
      "Disponibilità",
      viewModel.availabilityLabel,
      toneBasedOnAvailability(viewModel.availability),
      "availability"
    )
  );
  hero.appendChild(heroTop);
  const heroMetrics = createElement(doc, "div", "ii-hero-metrics");
  heroMetrics.appendChild(
    createHeroMetric(
      doc,
      "Prezzo al m²",
      formatPricePerSquareMeter(viewModel.pricePerSquareMeter),
      null,
      "listingPricePerSquareMeter"
    )
  );
  heroMetrics.appendChild(
    createHeroMetric(
      doc,
      "Prezzo medio zona",
      formatPricePerSquareMeter(null),
      null,
      "marketPricePerSquareMeter",
      viewModel.marketUrl
    )
  );
  hero.appendChild(heroMetrics);
  body.appendChild(hero);

  const infoSection = createElement(doc, "section", "ii-section");
  const infoGrid = createElement(doc, "div", "ii-info-grid");
  viewModel.info.forEach((item) => {
    infoGrid.appendChild(createInfoBlock(doc, item));
  });
  infoSection.appendChild(infoGrid);
  body.appendChild(infoSection);

  const simulator = createElement(doc, "section", "ii-simulator");
  simulator.appendChild(createElement(doc, "span", "ii-eyebrow", "SIMULATORE"));
  simulator.appendChild(
    createElement(doc, "h3", "ii-simulator-title", "Prova una proposta")
  );
  const mortgageSettings = getStoredMortgageSettings(doc);
  const simulatorCopy = createElement(
    doc,
    "p",
    "ii-simulator-copy",
    formatMortgageSummary(mortgageSettings)
  );
  simulator.appendChild(simulatorCopy);
  const simulatorRow = createElement(doc, "div", "ii-simulator-row");
  const proposalLabel = createElement(
    doc,
    "label",
    "ii-input-label",
    "Importo proposta"
  );
  const proposalInput = createElement(doc, "input", "ii-price-input");
  proposalInput.id = "simulated-price";
  proposalInput.type = "number";
  proposalInput.inputMode = "decimal";
  proposalInput.min = "0";
  proposalInput.step = "1000";
  proposalInput.value = viewModel.price === null ? "" : String(viewModel.price);
  proposalInput.setAttribute("aria-label", "Importo proposta in euro");
  proposalLabel.appendChild(proposalInput);
  const paymentOutput = createElement(doc, "output", "ii-payment-output");
  paymentOutput.id = "rata-mutuo-manuale";
  paymentOutput.setAttribute("aria-live", "polite");
  simulatorRow.appendChild(proposalLabel);
  simulatorRow.appendChild(paymentOutput);
  simulator.appendChild(simulatorRow);

  const mortgageDetails = createElement(doc, "details", "ii-mortgage-details");
  mortgageDetails.appendChild(
    createElement(doc, "summary", "ii-details-summary", "Modifica parametri mutuo")
  );
  const mortgageControls = createElement(doc, "div", "ii-mortgage-controls");

  const loanPercentageLabel = createElement(
    doc,
    "label",
    "ii-input-label",
    "Mutuo (%)"
  );
  const loanPercentageInput = createElement(doc, "input", "ii-price-input");
  loanPercentageInput.type = "number";
  loanPercentageInput.min = "1";
  loanPercentageInput.max = "100";
  loanPercentageInput.step = "1";
  loanPercentageInput.value = String(mortgageSettings.loanPercentage);
  loanPercentageInput.setAttribute("aria-label", "Percentuale mutuo");
  loanPercentageLabel.appendChild(loanPercentageInput);

  const annualRateLabel = createElement(
    doc,
    "label",
    "ii-input-label",
    "Tasso annuo (%)"
  );
  const annualRateInput = createElement(doc, "input", "ii-price-input");
  annualRateInput.type = "number";
  annualRateInput.min = "0";
  annualRateInput.max = "100";
  annualRateInput.step = "0.1";
  annualRateInput.value = String(mortgageSettings.annualRate);
  annualRateInput.setAttribute("aria-label", "Tasso annuo percentuale");
  annualRateLabel.appendChild(annualRateInput);

  const yearsLabel = createElement(
    doc,
    "label",
    "ii-input-label",
    "Durata (anni)"
  );
  const yearsInput = createElement(doc, "input", "ii-price-input");
  yearsInput.type = "number";
  yearsInput.min = "1";
  yearsInput.max = "50";
  yearsInput.step = "1";
  yearsInput.value = String(mortgageSettings.years);
  yearsInput.setAttribute("aria-label", "Durata mutuo in anni");
  yearsLabel.appendChild(yearsInput);

  mortgageControls.appendChild(loanPercentageLabel);
  mortgageControls.appendChild(annualRateLabel);
  mortgageControls.appendChild(yearsLabel);
  mortgageDetails.appendChild(mortgageControls);
  simulator.appendChild(mortgageDetails);
  body.appendChild(simulator);

  const features = createElement(doc, "details", "ii-details");
  const featuresSummary = createElement(
    doc,
    "summary",
    "ii-details-summary",
    `Caratteristiche (${viewModel.features.length})`
  );
  features.appendChild(featuresSummary);
  if (viewModel.features.length) {
    const featureList = createElement(doc, "ul", "ii-features-list");
    viewModel.features.forEach((feature) => {
      featureList.appendChild(createElement(doc, "li", "", feature));
    });
    features.appendChild(featureList);
  } else {
    features.appendChild(
      createElement(doc, "p", "ii-empty", "Nessuna caratteristica disponibile")
    );
  }
  body.appendChild(features);

  if (viewModel.links.length) {
    const linksSection = createElement(doc, "nav", "ii-links");
    linksSection.setAttribute("aria-label", "Collegamenti utili");
    viewModel.links.forEach((link) => {
      const anchor = createElement(doc, "a", "ii-link", link.label);
      anchor.href = link.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      linksSection.appendChild(anchor);
    });
    body.appendChild(linksSection);
  }

  const footer = createElement(doc, "footer", "ii-footer");
  footer.appendChild(
    createElement(doc, "span", "", "Immobiliare.it Insight · ")
  );
  const repositoryLink = createElement(doc, "a", "ii-footer-link", "GitHub");
  repositoryLink.href = "https://github.com/riccadema/immobiliare.it-insignt";
  repositoryLink.target = "_blank";
  repositoryLink.rel = "noopener noreferrer";
  footer.appendChild(repositoryLink);
  body.appendChild(footer);

  container.appendChild(header);
  container.appendChild(body);
  doc.body.appendChild(container);

  let currentTheme = container.dataset.theme;
  themeToggle.addEventListener("click", () => {
    currentTheme = applyTheme(
      container,
      currentTheme === "dark" ? "light" : "dark"
    );
    persistTheme(doc, currentTheme);
    updateThemeToggle(themeToggle, currentTheme);
  });
  minimizeButton.addEventListener("click", () => {
    body.hidden = !body.hidden;
    minimizeButton.textContent = body.hidden ? "+" : "−";
    minimizeButton.setAttribute("aria-expanded", String(!body.hidden));
  });
  closeButton.addEventListener("click", () => container.remove());
  const updateSimulator = () => {
    const settings = updateMonthlyPayment(
      proposalInput,
      loanPercentageInput,
      annualRateInput,
      yearsInput,
      paymentOutput,
      simulatorCopy
    );
    persistMortgageSettings(doc, settings);
  };
  [
    proposalInput,
    loanPercentageInput,
    annualRateInput,
    yearsInput,
  ].forEach((input) => input.addEventListener("input", updateSimulator));
  updateSimulator();
  setupDragging(doc, container, header);

  return container;
}

function extractData(doc = typeof document !== "undefined" ? document : null) {
  const realEstate = readRealEstateFromDocument(doc);
  if (!realEstate) {
    return null;
  }

  const viewModel = buildViewModel(realEstate);
  const container = showPopup(viewModel, doc);
  if (!container || !viewModel.region || !viewModel.city) {
    return container;
  }

  fetchPriceChart(viewModel.region, viewModel.city)
    .then((chart) => updateMarketComparison(container, viewModel, chart))
    .catch((error) => {
      console.warn("Confronto prezzo di mercato non disponibile", error);
      updateMarketComparison(container, viewModel, null);
    });

  return container;
}

const publicApi = {
  buildMarketPath,
  buildViewModel,
  calculateMonthlyPayment,
  calcolaRataMensile,
  dotColorBasedOnToday,
  extractData,
  extractMarketPriceFromHtml,
  fetchPriceChart,
  formatCityName,
  formatCondominiumExpenses,
  formatDisponibilita,
  formatPrice,
  formatPriceComparison,
  formatPricePerSquareMeter,
  formatSurface,
  formatUnixTimestampWithDays,
  formatValue,
  getInitialTheme,
  getStoredMortgageSettings,
  generateGoogleMapsLink,
  getAgeInDays,
  normalizeMortgageSettings,
  readRealEstateFromDocument,
  showPopup,
  toFiniteNumber,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = publicApi;
}

if (typeof document !== "undefined" && document.querySelector) {
  extractData();
}
