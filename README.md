# MMM-RIG-WastePlan

MagicMirror² module for showing upcoming waste pickup dates from providers using the **Min Renovasjon** backend, including **RiG**.

This module is community-made and is **not** affiliated with RiG, Norkart, or Min Renovasjon.

## What it does

- Lets you use a normal address in `config.js`
- Looks up the address automatically with Geonorge
- Fetches pickup dates from the Min Renovasjon backend
- Shows upcoming collections in a simple list

## Installation

Go to your MagicMirror modules folder and copy the module in place:

```bash
cd ~/MagicMirror/modules
cp -r /path/to/MMM-RIG-WastePlan .
```

Or clone/copy the files from this folder into:

```bash
~/MagicMirror/modules/MMM-RIG-WastePlan
```

No extra `npm install` step is required.

## Basic config

Add this to `config/config.js`:

```js
{
  module: "MMM-RIG-WastePlan",
  position: "top_left",
  config: {
    address: "Kverndalsgata 10, 3717 Skien",
    maxEntries: 5,
    showIcon: true,
    showDaysLeft: true,
    dateFormat: "ddd D. MMM"
  }
},
```

## Alternative config without address lookup

If you already know the address details, you can skip Geonorge lookup:

```js
{
  module: "MMM-RIG-WastePlan",
  position: "top_left",
  config: {
    streetName: "Kverndalsgata",
    houseNumber: "10",
    addressCode: "12345",
    municipalityId: "4003"
  }
},
```

## Config options

| Option | Description | Default |
|---|---|---|
| `header` | Header text | `Tømmeplan` |
| `address` | Free-text address lookup, e.g. `Gate 1, 3717 Skien` | `""` |
| `streetName` | Street name, used if you want to skip lookup | `""` |
| `houseNumber` | House number | `""` |
| `addressCode` | Geonorge `adressekode` | `""` |
| `municipalityId` | Geonorge `kommunenummer` | `""` |
| `maxEntries` | How many future pickups to show | `6` |
| `showDate` | Show formatted date | `true` |
| `dateFormat` | Moment format for the date | `ddd D. MMM` |
| `showDaysLeft` | Show days left until pickup | `true` |
| `showFraction` | Show waste fraction name | `true` |
| `showIcon` | Show icon if available, otherwise emoji fallback | `false` |
| `minWidth` | Minimum width in px | `220` |
| `updateInterval` | Refresh interval in ms | `21600000` |
| `requestTimeout` | Request timeout in ms | `10000` |

## Notes

- This module depends on the public address lookup from Geonorge and the Min Renovasjon backend used by community integrations.
- If RiG or Min Renovasjon changes their backend/API behavior, the module may need updates.
- If your address returns multiple close matches, use the full address including postcode.

## License

MIT
