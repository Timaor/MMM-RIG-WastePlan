const https = require("https");
const NodeHelper = require("node_helper");

const APP_KEY = "AE13DEEC-804F-4615-A74E-B4FAC11F0A30";
const FRACTIONS_URL =
  "https://norkartrenovasjon.azurewebsites.net/proxyserver.ashx?server=" +
  "https://komteksky.norkart.no/MinRenovasjon.Api/api/fraksjoner/";
const CALENDAR_URL =
  "https://norkartrenovasjon.azurewebsites.net/proxyserver.ashx?server=" +
  "https://komteksky.norkart.no/MinRenovasjon.Api/api/tommekalender";
const GEONORGE_URL = "https://ws.geonorge.no/adresser/v1/sok?sok=";

function getJson(url, headers = {}, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let body = "";

      res.on("data", (chunk) => {
        body += chunk;
      });

      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(timeout, () => {
      req.destroy(new Error("Request timed out"));
    });
  });
}

function normalizeAddressInput(config) {
  if (
    config.streetName &&
    config.houseNumber &&
    config.addressCode &&
    config.municipalityId
  ) {
    return {
      streetName: String(config.streetName),
      houseNumber: String(config.houseNumber),
      addressCode: String(config.addressCode),
      municipalityId: String(config.municipalityId),
      addressLabel: `${config.streetName} ${config.houseNumber}`.trim()
    };
  }

  return null;
}

function pickBestAddress(addresses, rawQuery = "") {
  if (!Array.isArray(addresses) || addresses.length === 0) {
    return null;
  }

  const query = String(rawQuery).trim().toLowerCase();
  if (!query) {
    return addresses[0];
  }

  const exact = addresses.find((entry) => {
    const full = String(entry.adressetekst || "").toLowerCase();
    const postal = String(entry.postnummer || "").toLowerCase();
    const city = String(entry.poststed || "").toLowerCase();
    const combined = `${full}, ${postal} ${city}`.trim();
    return full === query || combined === query;
  });

  return exact || addresses[0];
}

function escapeQuery(value) {
  return encodeURIComponent(String(value || "").trim());
}

function iconToEmoji(name = "") {
  const key = String(name).toLowerCase();
  if (key.includes("mat")) return "🍎";
  if (key.includes("rest")) return "🗑️";
  if (key.includes("papir")) return "📦";
  if (key.includes("plast")) return "🧴";
  if (key.includes("glass") || key.includes("metall")) return "🍾";
  if (key.includes("hage")) return "🌿";
  if (key.includes("tekstil")) return "👕";
  return "♻️";
}

module.exports = NodeHelper.create({
  socketNotificationReceived: async function (notification, payload) {
    if (notification !== "GET_WASTE_PLAN") {
      return;
    }

    const config = payload.config || {};
    const timeout = Number(config.requestTimeout) || 10000;

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
          streetName: String(match.adressenavn || ""),
          houseNumber: String(match.nummer || ""),
          addressCode: String(match.adressekode || ""),
          municipalityId: String(match.kommunenummer || ""),
          addressLabel: [
            String(match.adressetekst || "").trim(),
            [String(match.postnummer || "").trim(), String(match.poststed || "").trim()].filter(Boolean).join(" ")
          ].filter(Boolean).join(", ")
        };
      }

      const headers = {
        Kommunenr: resolved.municipalityId,
        RenovasjonAppKey: APP_KEY
      };

      const fractions = await getJson(FRACTIONS_URL, headers, timeout);
      const fractionMap = new Map(
        (Array.isArray(fractions) ? fractions : []).map((fraction) => [
          String(fraction.Id),
          {
            name: fraction.Navn || `Fraksjon ${fraction.Id}`,
            icon: fraction.Ikon || ""
          }
        ])
      );

      const calendarQuery = [
        `kommunenr=${escapeQuery(resolved.municipalityId)}`,
        `gatenavn=${escapeQuery(resolved.streetName)}`,
        `gatekode=${escapeQuery(resolved.addressCode)}`,
        `husnr=${escapeQuery(resolved.houseNumber)}`
      ].join("&");

      const calendar = await getJson(`${CALENDAR_URL}?${calendarQuery}`, headers, timeout);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const events = [];
      (Array.isArray(calendar) ? calendar : []).forEach((entry) => {
        const fractionId = String(entry.FraksjonId);
        const fraction = fractionMap.get(fractionId) || {
          name: `Fraksjon ${fractionId}`,
          icon: ""
        };

        (entry.Tommedatoer || []).forEach((dateString) => {
          const date = new Date(dateString);
          if (Number.isNaN(date.getTime())) {
            return;
          }

          const normalized = new Date(date);
          normalized.setHours(0, 0, 0, 0);
          if (normalized < today) {
            return;
          }

          events.push({
            fractionId,
            fractionName: fraction.name,
            icon: fraction.icon,
            emoji: iconToEmoji(fraction.name),
            date: normalized.toISOString()
          });
        });
      });

      events.sort((a, b) => new Date(a.date) - new Date(b.date));

      this.sendSocketNotification("WASTE_PLAN", {
        addressLabel: resolved.addressLabel,
        events
      });
    } catch (error) {
      console.error(`[MMM-RIG-WastePlan] ${error.message}`);
      this.sendSocketNotification("WASTE_PLAN", { error: "ERROR" });
    }
  }
});
