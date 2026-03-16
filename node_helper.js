const https = require("https");
const NodeHelper = require("node_helper");

const APP_KEY = "AE13DEEC-804F-4615-A74E-B4FAC11F0A30";
const PROXY_BASE = "https://norkartrenovasjon.azurewebsites.net/proxyserver.ashx?server=";
const FRACTIONS_URL = `${PROXY_BASE}https://komteksky.norkart.no/MinRenovasjon.Api/api/fraksjoner/`;
const CALENDAR_URL = `${PROXY_BASE}https://komteksky.norkart.no/MinRenovasjon.Api/api/tommekalender/`;
const GEONORGE_URL = "https://ws.geonorge.no/adresser/v1/sok?sok=";
const MUNICIPALITY_URL = "https://ws.geonorge.no/kommuneinfo/v1/kommuner/";

function getJson(url, headers = {}, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let body = "";

      res.on("data", (chunk) => {
        body += chunk;
      });

      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
          return;
        }

        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`Invalid JSON from ${url}: ${error.message}`));
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(timeout, () => req.destroy(new Error("Request timed out")));
  });
}

function escapeQuery(value) {
  return encodeURIComponent(String(value || "").trim());
}

function normalizeAddressInput(config) {
  if (config.streetName && config.houseNumber && config.addressCode && config.municipalityId) {
    return {
      streetName: String(config.streetName).trim(),
      houseNumber: String(config.houseNumber).trim(),
      addressCode: String(config.addressCode).trim(),
      municipalityId: String(config.municipalityId).trim(),
      addressLabel: `${String(config.streetName).trim()} ${String(config.houseNumber).trim()}`.trim()
    };
  }
  return null;
}

function pickBestAddress(addresses, rawQuery = "") {
  if (!Array.isArray(addresses) || addresses.length === 0) {
    return null;
  }

  const query = String(rawQuery).trim().toLowerCase();
  if (!query) return addresses[0];

  const exact = addresses.find((entry) => {
    const full = String(entry.adressetekst || "").toLowerCase();
    const postal = String(entry.postnummer || "").toLowerCase();
    const city = String(entry.poststed || "").toLowerCase();
    const combined = `${full}, ${postal} ${city}`.trim();
    return full === query || combined === query;
  });

  return exact || addresses[0];
}

function iconDataForFraction(name = "", iconUrl = "") {
  const key = String(name).toLowerCase();

  if (key.includes("mat")) return { emoji: "🍏", iconClass: "fa-solid fa-apple-whole" };
  if (key.includes("rest")) return { emoji: "🗑️", iconClass: "fa-solid fa-trash" };
  if (key.includes("papir") || key.includes("papp")) return { emoji: "📦", iconClass: "fa-solid fa-box" };
  if (key.includes("plast")) return { emoji: "🧴", iconClass: "fa-solid fa-bottle-water" };
  if (key.includes("glass") || key.includes("metall")) return { emoji: "🍾", iconClass: "fa-solid fa-wine-bottle" };
  if (key.includes("hage")) return { emoji: "🌿", iconClass: "fa-solid fa-leaf" };
  if (key.includes("tekstil")) return { emoji: "👕", iconClass: "fa-solid fa-shirt" };
  if (key.includes("farlig") || key.includes("spesial")) return { emoji: "⚠️", iconClass: "fa-solid fa-triangle-exclamation" };
  if (key.includes("jul")) return { emoji: "🎄", iconClass: "fa-solid fa-tree" };

  return {
    emoji: "♻️",
    iconClass: iconUrl ? null : "fa-solid fa-recycle"
  };
}

module.exports = NodeHelper.create({
  start: function () {
    this.cache = new Map();
  },

  socketNotificationReceived: async function (notification, payload) {
    if (notification !== "GET_WASTE_PLAN") return;

    const config = payload.config || {};
    const timeout = Number(config.requestTimeout) || 10000;
    const cacheMaxAge = Number(config.cacheMaxAge) || 12 * 60 * 60 * 1000;

    try {
      let resolved = normalizeAddressInput(config);

      if (!resolved) {
        if (!config.address || !String(config.address).trim()) {
          this.sendSocketNotification("WASTE_PLAN", { error: "MISSING_ADDRESS" });
          return;
        }

        const geo = await getJson(`${GEONORGE_URL}${escapeQuery(config.address)}`, {}, timeout);
        const match = pickBestAddress(geo.adresser, config.address);

        if (!match) {
          this.sendSocketNotification("WASTE_PLAN", { error: "ADDRESS_NOT_FOUND" });
          return;
        }

        resolved = {
          streetName: String(match.adressenavn || "").trim(),
          houseNumber: `${String(match.nummer || "").trim()}${String(match.bokstav || "").trim()}`,
          addressCode: String(match.adressekode || "").trim(),
          municipalityId: String(match.kommunenummer || "").trim(),
          addressLabel: [
            String(match.adressetekst || "").trim(),
            [String(match.postnummer || "").trim(), String(match.poststed || "").trim()].filter(Boolean).join(" ")
          ].filter(Boolean).join(", ")
        };
      }

      const cacheKey = [resolved.municipalityId, resolved.addressCode, resolved.houseNumber].join(":");
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.fetchedAt < cacheMaxAge) {
        this.sendSocketNotification("WASTE_PLAN", cached.payload);
        return;
      }

      const headers = {
        Kommunenr: resolved.municipalityId,
        RenovasjonAppKey: APP_KEY,
        OS: "Android",
        "User-Agent": "okhttp/3.2.0",
        "Accept-Encoding": "gzip"
      };

      const [fractions, calendar, municipalityInfo] = await Promise.all([
        getJson(FRACTIONS_URL, headers, timeout),
        getJson(`${CALENDAR_URL}?kommunenr=${escapeQuery(resolved.municipalityId)}&gatenavn=${escapeQuery(resolved.streetName)}&gatekode=${escapeQuery(resolved.addressCode)}&husnr=${escapeQuery(resolved.houseNumber)}`, headers, timeout),
        getJson(`${MUNICIPALITY_URL}${escapeQuery(resolved.municipalityId)}`, {}, timeout).catch(() => null)
      ]);

      const fractionMap = new Map(
        (Array.isArray(fractions) ? fractions : []).map((fraction) => {
          const iconMeta = iconDataForFraction(fraction.Navn || "", fraction.Ikon || "");
          return [
            String(fraction.Id),
            {
              id: String(fraction.Id),
              name: fraction.Navn || `Fraksjon ${fraction.Id}`,
              icon: fraction.Ikon || "",
              emoji: iconMeta.emoji,
              iconClass: iconMeta.iconClass
            }
          ];
        })
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const events = [];
      (Array.isArray(calendar) ? calendar : []).forEach((entry) => {
        const fractionId = String(entry.FraksjonId);
        const fallbackMeta = iconDataForFraction(entry.Fraksjon && entry.Fraksjon.Navn ? entry.Fraksjon.Navn : "", entry.Fraksjon && entry.Fraksjon.Ikon ? entry.Fraksjon.Ikon : "");
        const fraction = fractionMap.get(fractionId) || {
          id: fractionId,
          name: entry.Fraksjon && entry.Fraksjon.Navn ? entry.Fraksjon.Navn : `Fraksjon ${fractionId}`,
          icon: entry.Fraksjon && entry.Fraksjon.Ikon ? entry.Fraksjon.Ikon : "",
          emoji: fallbackMeta.emoji,
          iconClass: fallbackMeta.iconClass
        };

        (Array.isArray(entry.Tommedatoer) ? entry.Tommedatoer : []).forEach((dateString) => {
          const date = new Date(dateString);
          if (Number.isNaN(date.getTime())) return;

          const normalized = new Date(date);
          normalized.setHours(0, 0, 0, 0);
          if (normalized < today) return;

          events.push({
            fractionId,
            fractionName: fraction.name,
            emoji: fraction.emoji,
            iconClass: fraction.iconClass,
            date: normalized.toISOString()
          });
        });
      });

      events.sort((a, b) => new Date(a.date) - new Date(b.date) || a.fractionName.localeCompare(b.fractionName, "nb"));

      const responsePayload = {
        addressLabel: resolved.addressLabel,
        municipalityName: municipalityInfo && municipalityInfo.kommunenavnNorsk ? municipalityInfo.kommunenavnNorsk : "",
        events,
        fetchedAt: new Date().toISOString()
      };

      this.cache.set(cacheKey, { fetchedAt: Date.now(), payload: responsePayload });
      this.sendSocketNotification("WASTE_PLAN", responsePayload);
    } catch (error) {
      console.error(`[MMM-RIG-WastePlan] ${error.message}`);
      this.sendSocketNotification("WASTE_PLAN", { error: "ERROR" });
    }
  }
});
