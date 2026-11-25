# ACR122U NFC for Chromebook

The factory reader for Inventory Day. Two pieces run on the counting Chromebook:

1. A Linux bridge in the Chromebook's Linux container talks to the ACR122U over PC/SC and serves `http://127.0.0.1:17341/status`.
2. A Chrome extension polls that status and hands the reading to the Inventory Day page.

The Airtable interface stays in [airtable-custom-elements](https://github.com/mitch-radicaproducts-com/airtable-custom-elements). This repository does not write Airtable records. The RS232 scale stays on its own userscript in that repository.

## Daily use

Open **Inventory Day NFC** from the Chromebook app list and leave the terminal window open while counting. Close the window when you are done. Closing it stops the reader, and the page reports that the bridge is not running.

## First-time setup

See [INSTALL.md](INSTALL.md). The installer is safe to run again.

## The message the page accepts

The interface iframe posts a hello to the top Airtable window every 2 seconds:

```json
{"source":"inventory-day-nfc","type":"inventory-day:nfc-hello"}
```

The extension answers from that top window:

```json
{
  "source": "inventory-day-nfc",
  "type": "inventory-day:nfc",
  "state": "on",
  "detail": "ACS ACR122U PICC Interface 00 00",
  "uid": "04A1B2",
  "text": "R-0653-B1"
}
```

`state` is `off`, `on`, `tag`, or `error`. A uid is published as `tag`. `text` is the NDEF text, unchanged. Removing the card clears `uid` and `text`. Stopping the bridge publishes `off`.

`GET http://127.0.0.1:17341/status` returns the smaller bridge body: `state`, `detail`, `uid`, and `text`. It is bound to `127.0.0.1` only.

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
