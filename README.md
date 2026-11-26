# ACR122U NFC for Chromebook

## Paste this to an agent that is building an Airtable interface

You are adding the factory ACR122U reader to an Airtable interface. The reader already exists. This repository is that reader: the Linux bridge on the Chromebook, and the Chrome extension named **Inventory Day NFC**. Curtail your interface so it speaks the contract below. Leave this repository, the extension, the bridge, the message names, the port, and the JSON fields as they are.

The extension is already installed for every Airtable page. It injects into the top frame of `https://airtable.com/*` and `https://*.airtable.com/*`. It does not look at a base id, a page id, or which interface is open. Your interface shows up inside an iframe on that top window. The iframe cannot see the reader. Chrome cannot open the ACR122U. Web NFC will not reach it.

Post a hello from the iframe to `window.top` every 2 seconds:

```json
{"source":"inventory-day-nfc","type":"inventory-day:nfc-hello"}
```

Accept a reply only when `event.source` is `window.top`. Ignore every other source, type, or state. The extension sends:

```json
{
  "source": "inventory-day-nfc",
  "type": "inventory-day:nfc",
  "state": "tag",
  "detail": "ACS ACR122U PICC Interface 00 00",
  "uid": "04A1B2",
  "text": "R-0653-B1"
}
```

`state` is one of `waiting`, `off`, `on`, `tag`, `error`. Treat `on` plus a uid as `tag`.

- `off`: the bridge process is not running.
- `on`: the bridge is up and no card is present. Clear the selected record.
- `tag`: a card is on the reader. Read `text`.
- `error`: show `detail`.
- `waiting`: the page uses this itself until an extension answers. The extension does not send `waiting`.

`text` is the NDEF text, already trimmed by the bridge. Bin codes look like `R-0653-B1` or `R0653-B12`. Pass `text` through and parse it in the interface. The uid alone does not select a product. Removing the card clears `uid` and `text` immediately. Clear the selection when the reader is empty.

Inventory Day already does this. Copy the hello and the listener from [airtable-custom-elements](https://github.com/mitch-radicaproducts-com/airtable-custom-elements): `inventory_day/frontend/nfcHost.mjs` and `inventory_day/frontend/NfcPanel.js`. Records, weights, pictures, and counts stay with the interface that owns them.

Leave these alone:

- This repository, `extension/`, and `bridge/`.
- The names `inventory-day-nfc`, `inventory-day:nfc-hello`, and `inventory-day:nfc`.
- `GET http://127.0.0.1:17341/status` on `127.0.0.1` only.
- The RS232 scale and its serial-port permission.

Test on an Airtable page. The extension runs on `airtable.com` and `*.airtable.com`. A localhost block dev server is outside it.

## For the factory

Two pieces run on the counting Chromebook:

1. A Linux bridge in the Chromebook's Linux container talks to the ACR122U over PC/SC and serves `http://127.0.0.1:17341/status`.
2. The Chrome extension polls that status and hands the reading to the Airtable tab.

The Airtable interface stays in [airtable-custom-elements](https://github.com/mitch-radicaproducts-com/airtable-custom-elements). This repository does not write Airtable records. The RS232 scale stays on its own userscript in that repository.

### Daily use

Open **Inventory Day NFC** from the Chromebook app list and leave the terminal window open while counting. Close the window when you are done. Closing it stops the reader, and the page reports that the bridge is not running.

### First-time setup

See [INSTALL.md](INSTALL.md). The installer is safe to run again.

The bridge body is smaller than the page message. `GET http://127.0.0.1:17341/status` returns `state`, `detail`, `uid`, and `text`.

## Layout

| Path | Role |
| --- | --- |
| `install.sh` | One-time Chromebook install |
| `bridge/` | PC/SC server copied to `~/nfc` |
| `extension/` | Manifest V3 extension that replaces the userscript |
| `userscript/acr122u.user.js` | Tampermonkey behavior the extension replaces |
| `docs/HANDOFF.md` | Notes from the first working bridge |

## Tests

```sh
node --test
```

The tests cover NDEF parsing, the status-to-message rules, the installer, and, when Chrome can load an unpacked extension, a page that accepts the reading the way Inventory Day does. A physical ACR122U is not part of this environment.
