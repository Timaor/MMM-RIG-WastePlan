/* MagicMirror²
 * Module: MMM-RIG-WastePlan
 *
 * Waste pickup calendar for RiG and other Min Renovasjon style municipalities.
 */

Module.register("MMM-RIG-WastePlan", {
  defaults: {
    header: "Tømmeplan",
    address: "",
    streetName: "",
    houseNumber: "",
    addressCode: "",
    municipalityId: "",
    maxEntries: 6,
    showDate: true,
    dateFormat: "ddd D. MMM",
    showDaysLeft: true,
    showFraction: true,
    showIcon: true,
    showMunicipality: false,
    showLegend: false,
    minWidth: 240,
    updateInterval: 6 * 60 * 60 * 1000,
    requestTimeout: 10000,
    retryDelay: 60 * 1000,
    cacheMaxAge: 12 * 60 * 60 * 1000
  },

  start: function () {
    this.events = [];
    this.addressLabel = "";
    this.municipalityName = "";
    this.error = null;
    this.loaded = false;
    this.lastUpdated = null;

    moment.locale(config.language || "nb");
    this.getWastePlan();
    this.scheduleUpdate();
  },

  getScripts: function () {
    return ["moment.js"];
  },

  getStyles: function () {
    return ["MMM-RIG-WastePlan.css"];
  },

  getTranslations: function () {
    return {
      nb: "translations/nb.json",
      nn: "translations/nb.json",
      en: "translations/en.json"
    };
  },

  scheduleUpdate: function () {
    setInterval(() => {
      this.getWastePlan();
    }, this.config.updateInterval);
  },

  getWastePlan: function () {
    this.sendSocketNotification("GET_WASTE_PLAN", { config: this.config });
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification !== "WASTE_PLAN") {
      return;
    }

    this.loaded = true;
    this.error = payload && payload.error ? payload.error : null;
    this.addressLabel = payload && payload.addressLabel ? payload.addressLabel : "";
    this.municipalityName = payload && payload.municipalityName ? payload.municipalityName : "";
    this.events = payload && Array.isArray(payload.events) ? payload.events : [];
    this.lastUpdated = payload && payload.fetchedAt ? payload.fetchedAt : null;
    this.updateDom(500);

    if (this.error) {
      setTimeout(() => this.getWastePlan(), this.config.retryDelay);
    }
  },

  formatDaysLeft: function (dateValue) {
    const today = moment().startOf("day");
    const pickupDate = moment(dateValue).startOf("day");
    const diff = pickupDate.diff(today, "days");

    if (diff <= 0) {
      return this.translate("TODAY");
    }
    if (diff === 1) {
      return `1 ${this.translate("DAY")}`;
    }
    return `${diff} ${this.translate("DAYS")}`;
  },

  buildMetaLine: function (event) {
    const parts = [];

    if (this.config.showDate && event.date) {
      parts.push(moment(event.date).format(this.config.dateFormat));
    }

    if (this.config.showDaysLeft && event.date) {
      parts.push(this.formatDaysLeft(event.date));
    }

    return parts.join(" • ");
  },

  buildIconElement: function (event) {
    const wrapper = document.createElement("div");
    wrapper.className = "rig-waste-icon-slot";

    if (!this.config.showIcon) {
      return wrapper;
    }

    if (event.iconClass) {
      const icon = document.createElement("span");
      icon.className = `rig-waste-fa ${event.iconClass}`;
      icon.setAttribute("aria-hidden", "true");
      wrapper.appendChild(icon);
      return wrapper;
    }

    const span = document.createElement("span");
    span.className = "rig-waste-icon-emoji";
    span.innerHTML = event.emoji || "♻️";
    wrapper.appendChild(span);
    return wrapper;
  },

  getDom: function () {
    const wrapper = document.createElement("div");

    if (this.config.minWidth) {
      wrapper.style.minWidth = `${this.config.minWidth}px`;
    }

    if (!this.loaded) {
      wrapper.className = "dimmed light small";
      wrapper.innerHTML = `${this.translate("LOADING")}...`;
      return wrapper;
    }

    if (this.error) {
      wrapper.className = "small";
      wrapper.innerHTML = this.translate(this.error) || this.translate("ERROR");
      return wrapper;
    }

    if (this.config.header) {
      const header = document.createElement("div");
      header.className = "light small";
      header.innerHTML = this.config.header;
      wrapper.appendChild(header);
    }

    if (this.addressLabel) {
      const address = document.createElement("div");
      address.className = "dimmed xsmall";
      address.innerHTML = this.addressLabel;
      wrapper.appendChild(address);
    }

    if (this.config.showMunicipality && this.municipalityName) {
      const municipality = document.createElement("div");
      municipality.className = "dimmed xsmall";
      municipality.innerHTML = this.municipalityName;
      wrapper.appendChild(municipality);
    }

    if (!this.events.length) {
      const empty = document.createElement("div");
      empty.className = "dimmed light small";
      empty.innerHTML = this.translate("NO_DATA");
      wrapper.appendChild(empty);
      return wrapper;
    }

    const list = document.createElement("div");
    list.className = "rig-waste-list";

    this.events.slice(0, this.config.maxEntries).forEach((event) => {
      const row = document.createElement("div");
      row.className = "rig-waste-row";

      row.appendChild(this.buildIconElement(event));

      const content = document.createElement("div");
      content.className = "rig-waste-content";

      const title = document.createElement("div");
      title.className = "rig-waste-title";
      title.innerHTML = this.config.showFraction
        ? (event.fractionName || this.translate("UNKNOWN_FRACTION"))
        : this.translate("PICKUP");
      content.appendChild(title);

      const meta = this.buildMetaLine(event);
      if (meta) {
        const metaEl = document.createElement("div");
        metaEl.className = "rig-waste-meta dimmed";
        metaEl.innerHTML = meta;
        content.appendChild(metaEl);
      }

      row.appendChild(content);
      list.appendChild(row);
    });

    wrapper.appendChild(list);

    if (this.lastUpdated) {
      const updated = document.createElement("div");
      updated.className = "dimmed xsmall rig-waste-updated";
      updated.innerHTML = `${this.translate("UPDATED")} ${moment(this.lastUpdated).format("D.M HH:mm")}`;
      wrapper.appendChild(updated);
    }

    return wrapper;
  }
});
