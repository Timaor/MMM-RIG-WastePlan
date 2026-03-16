# MMM-RIG-WastePlan

MagicMirror² module for waste pickup calendars from RiG and other **Min Renovasjon** style municipalities.

This version adds:
- Norwegian and English translations
- built-in icon mapping for common waste fractions
- support for RiG and other municipalities using the same Min Renovasjon backend pattern
- simple in-memory cache to avoid hammering the API
- optional pre-resolved address fields when you want to skip address lookup

## Install

```bash
cd ~/MagicMirror/modules
git clone https://github.com/YOURUSER/MMM-RIG-WastePlan.git
cd MMM-RIG-WastePlan
npm install
```

## Basic config

```js
{
  module: "MMM-RIG-WastePlan",
  position: "top_left",
  config: {
    address: "Vestheimvegen 80, 3919 Porsgrunn",
    maxEntries: 6,
    showIcon: true,
    showDaysLeft: true,
    dateFormat: "ddd D. MMM"
  }
},
```

## Faster config without address lookup

```js
{
  module: "MMM-RIG-WastePlan",
  position: "top_left",
  config: {
    streetName: "Vestheimvegen",
    houseNumber: "80",
    addressCode: "5225",
    municipalityId: "4001",
    maxEntries: 6,
    showIcon: true
  }
},
```

## Options

| Option | Default | Description |
|---|---:|---|
| `header` | `"Tømmeplan"` | Header text |
| `address` | `""` | Full address used for Geonorge lookup |
| `streetName` | `""` | Street name if you want to skip address lookup |
| `houseNumber` | `""` | House number, optionally with letter |
| `addressCode` | `""` | Geonorge `adressekode` |
| `municipalityId` | `""` | Geonorge `kommunenummer` |
| `maxEntries` | `6` | Number of upcoming entries to show |
| `showDate` | `true` | Show formatted pickup date |
| `dateFormat` | `"ddd D. MMM"` | Moment date format |
| `showDaysLeft` | `true` | Show days until pickup |
| `showFraction` | `true` | Show waste fraction name |
| `showIcon` | `true` | Show built-in icons / emoji fallback |
| `showMunicipality` | `false` | Show municipality name under the address |
| `minWidth` | `240` | Minimum width in pixels |
| `updateInterval` | `21600000` | Refresh interval in ms |
| `requestTimeout` | `10000` | Request timeout in ms |
| `retryDelay` | `60000` | Retry delay after errors |
| `cacheMaxAge` | `43200000` | Helper-side cache lifetime |

## Notes

- RiG tells users to use the **Min Renovasjon** app and online calendar for pickup days.
- RiG also notes that pickup days can change around holidays, so the module fetches live upcoming dates instead of relying on printed calendars.
- Waste fractions in Grenland include restavfall, matavfall, glass- og metallemballasje, papp/papir and plastemballasje, which is what the built-in icon mapping is optimized for.

If your municipality uses the same backend but returns slightly different fraction names, you can extend `iconDataForFraction()` in `node_helper.js`.
