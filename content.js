const energyColors = {
  A4: "#00b050",
  A3: "#00b050",
  A2: "#00b050",
  A1: "#00b050",
  B: "#92d050",
  C: "#ffff00",
  D: "#ffc000",
  E: "#ff9900",
  F: "#ff0000",
  G: "#c00000",
};

async function fetchPriceChart(region, city) {
  const path = `/mercato-immobiliare/${region.toLowerCase()}/${city
    .toLowerCase()
    .replace(/'/g, "-")
    .replace(/\s+/g, "-")}/`;
  const url = `https://www.immobiliare.it/api-next/city-guide/price-chart/1/?__lang=it&path=${encodeURIComponent(
    path
  )}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "*/*",
      "accept-language": "it-IT,it;q=0.9",
      referer: `https://www.immobiliare.it${path}`,
      "user-agent": navigator.userAgent,
    },
    credentials: "include",
  });

  if (!response.ok) {
    console.error("Errore nella richiesta:", response.status);
    return null;
  }

  const data = await response.json();

  const labels = data?.labels;
  const values = data?.values;

  if (!labels || !values || labels.length === 0 || values.length === 0) {
    console.warn("Dati non disponibili o incompleti");
    return null;
  }

  const lastIndex = labels.length - 1;
  return {
    label: labels[lastIndex],
    value: formatPrice(values[lastIndex]),
  };
}

function generateGoogleMapsLink(location) {
  const origin = ""; // SET HERE COORDINATES FOR MAPS ORIGIN

  if (location?.latitude && location?.longitude) {
    const destination = `${location.latitude},${location.longitude}`;
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  }

  const addressParts = [
    location?.address,
    location?.streetNumber,
    location?.city,
    location?.province,
    location?.nation?.name,
  ].filter(Boolean);

  if (addressParts.length > 0) {
    const destination = encodeURIComponent(addressParts.join(", "));
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  }

  return null;
}

function calcolaRataMensile(valoreImmobile, tassoAnnuo = 0.04, anni = 30) {
  const importoMutuo = valoreImmobile * 0.95;
  const mesi = anni * 12;
  const tassoMensile = tassoAnnuo / 12;

  const rata =
    (importoMutuo * (tassoMensile * Math.pow(1 + tassoMensile, mesi))) /
    (Math.pow(1 + tassoMensile, mesi) - 1);

  return formatPrice(rata);
}

function formatPrice(value) {
  if (!value) return "N/D";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
  }).format(value);
}

function formatValue(value, suffix = "") {
  return value ? `${value}${suffix}` : "N/D";
}

function formatDisponibilita(value) {
  return value === "libero" ? `${value} ✅` : `${value} ❌`;
}

function formatCityName(city) {
  return city.toLowerCase().replace(/'/g, "-").replace(/\s+/g, "-");
}

function formatUnixTimestampWithDays(seconds) {
  if (!seconds) return "N/D";
  const date = new Date(seconds * 1000);
  const today = new Date();
  const diffTime = today - date;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return `${diffDays} gg - ${date.toLocaleDateString("IT")}`;
}

function dotColorBasedOnToday(seconds) {
  if (!seconds) return "N/D";
  const date = new Date(seconds * 1000);
  const today = new Date();
  const diffTime = today - date;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays <= 20 && diffDays >= 0) {
    return "#00b050";
  } else if (diffDays < 45 && diffDays > 20) {
    return "#ffff00";
  } else {
    return "#c00000";
  }
}

function extractData() {
  const scriptTag = document.querySelector("#__NEXT_DATA__");
  if (!scriptTag) return;

  const jsonData = JSON.parse(scriptTag.textContent);
  const realEstate = jsonData.props?.pageProps?.detailData?.realEstate;
  if (!realEstate) return;

  const props = realEstate.properties[0];

  const energyClass = props.energy?.class?.name;
  const energyColor = energyColors[energyClass] || "#ccc";

  const featuresList = props.ga4features?.length
    ? `<ul class="features-list">${props.ga4features
        .map((f) => `<li>${f}</li>`)
        .join("")}</ul>`
    : "N/D";

  const mapsLink = generateGoogleMapsLink(props.location);

  const mercatoLink =
    props.location?.region && props.location?.city
      ? `https://www.immobiliare.it/mercato-immobiliare/${props.location.region.toLowerCase()}/${formatCityName(
          props.location.city
        )}/`
      : null;

  const links = [];
  if (mapsLink) {
    links.push({ label: "📍 Google Maps", url: mapsLink });
  }
  if (mercatoLink) {
    links.push({ label: "📊 Prezzo al mq", url: mercatoLink });
  }

  const disponibilita = props.availability;

  let info = [
    {
      label: "Creato",
      value: formatUnixTimestampWithDays(realEstate.createdAt),
      dot: dotColorBasedOnToday(realEstate.createdAt),
    },
    {
      label: "Aggiornato",
      value: formatUnixTimestampWithDays(realEstate.updatedAt),
      dot: dotColorBasedOnToday(realEstate.updatedAt),
    },
    { label: "Prezzo", value: formatPrice(realEstate.price?.value) },
    {
      label: "Prezzo al m²",
      value: realEstate.price?.pricePerSquareMeter || "N/D",
    },
    {
      label: "Locali - Superficie",
      value: formatValue(props.rooms) + " - " + formatValue(props.surface),
    },
    {
      label: "Disponibilità",
      value: formatDisponibilita(disponibilita),
    },
    {
      label: "Piano - Ascensore",
      value:
        props?.floor?.floorOnlyValue + " - " + (props.elevator ? "✅" : "❌"),
    },
    {
      label: "Classe Energetica",
      value: energyClass || "N/D",
      dot: energyColor,
    },
    { label: "Riscaldamento", value: formatValue(props.energy?.heatingType) },
    {
      label: "Condizionamento",
      value: formatValue(props.energy?.airConditioning),
    },
    { label: "Garage", value: formatValue(props.ga4Garage) },
    { label: "Anno Costruzione", value: formatValue(props.buildingYear) },
    {
      label: "Spese Condominiali",
      value: formatValue(props.costs?.condominiumExpenses),
    },
    {
      label: "Rata Mutuo (95%/4%)",
      value: calcolaRataMensile(realEstate.price?.value),
    },
  ];

  function showPopup(info, featuresList, links) {
    const container = document.createElement("div");
    container.id = "immobiliare-popup";

    const content = info
      .map(
        (item) => `
      <div class="info-block">
        <div class="info-label">${item.label}</div>
        <div class="info-value">
          ${item.value}
          ${
            item.dot
              ? `<span class="dot" style="background-color: ${item.dot}"></span>`
              : ""
          }
        </div>
      </div>`
      )
      .join("");

    const linksHtml = links.length
      ? `<div class="links-section">
        ${links
          .map(
            (link) => `
          <div class="link-item">
            <a href="${link.url}" target="_blank" rel="noopener noreferrer">${link.label}</a>
          </div>`
          )
          .join("")}
      </div>`
      : "";

    container.innerHTML = `
    <div id="popup-header">
      <h4></h4>
      <div><button id="popup-minimize">➖</button></div>
    </div>
    <div id="popup-body">
      <div class="info-container">
        ${content}
        <div class="info-block">
          <div class="info-label">
            Importo Proposta: 
            <input id="simulated-price" type="number" value="${realEstate.price?.value}" style="width: 80px;" />
          </div>
          <div id="rata-mutuo-manuale" class="info-value"></div>
        </div>
        </div>
      <div class="features-section">${featuresList}</div>
      ${linksHtml}
    </div>
  `;

    document.body.appendChild(container);

    document.getElementById("popup-minimize").onclick = () => {
      const body = document.getElementById("popup-body");
      body.style.display = body.style.display === "none" ? "block" : "none";
    };

    let isDragging = false;
    let offsetX, offsetY;

    const header = document.getElementById("popup-header");
    header.style.cursor = "move";

    header.addEventListener("mousedown", (e) => {
      isDragging = true;
      offsetX = e.clientX - container.offsetLeft;
      offsetY = e.clientY - container.offsetTop;
    });

    document.addEventListener("mousemove", (e) => {
      if (isDragging) {
        container.style.left = `${e.clientX - offsetX}px`;
        container.style.top = `${e.clientY - offsetY}px`;
        container.style.right = "auto";
      }
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
    });

    document
      .getElementById("simulated-price")
      .addEventListener("input", function (e) {
        const prezzo = parseFloat(e.target.value);
        const rata = calcolaRataMensile(prezzo);
        const rataElement = document.getElementById("rata-mutuo-manuale");
        if (rataElement) {
          rataElement.innerHTML = rata;
        }
      });
  }

  fetchPriceChart(props.location?.region, props.location?.city).then(
    ({ label, value }) => {
      const prezzoMqIndex = info.findIndex(
        (item) => item.label === "Prezzo al m²"
      );
      if (prezzoMqIndex !== -1 && value) {
        info[prezzoMqIndex].value += ` (~${value} €/m²)`;
      }
      const prezzoIndex = info.findIndex((item) => item.label === "Prezzo");
      info[prezzoIndex].dot =
        info[prezzoMqIndex].value > value ? "#c00000" : "#00b050";
      showPopup(info, featuresList, links);
    }
  );
}

extractData();
