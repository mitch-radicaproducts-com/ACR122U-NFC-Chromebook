# ACR122U reader for Inventory Day

This packet is the starting context for a new repository and a new agent. The Inventory Day Airtable interface stays in its own repository. This project owns the reader: the Linux server on the Chromebook, and a Chrome extension that replaces Tampermonkey.

Snapshot date: 25 November 2026. The files in `source/` are the working copies from `inventory_day/nfc` on `main` of the interface repo at that date.

## Paste this to the new agent

You own a new repository for the Radica factory ACR122U NFC reader. Read `START-HERE.md` in this packet before changing anything. The working server, NDEF parser, launcher, and Tampermonkey script are in `source/`. Bring those into the new repo, then do two things: make the Linux server a repeatable install for other Chromebooks, and replace `source/acr122u.user.js` with a Chrome extension that speaks the same message contract. Do not modify the Airtable interface. Do not take over the scale. Keep the message names, the port, and the JSON fields stable.

## Who owns what

This project owns:

- The PC/SC bridge that reads the ACR122U and serves `http://127.0.0.1:17341/status`.
- The Chromebook Linux install: packages, pcscd, the copy onto the Linux disk, and the launcher app.
- The Chrome extension that polls that status and hands it to the Airtable tab.

The Inventory Day interface owns everything that happens after the tag text arrives: creating records, linking the product, choosing the weight field, the glow, the pictures, and the counts. It already listens for the message described below. Leave that code where it is.

The RS232 scale is also out of scope. It uses a separate Tampermonkey script, `inventory_day/scale/seaks3011d.user.js`, because the top-level Airtable tab can open a serial port. This project does not replace that script.

Current interface code, for reference only:

- Repository: https://github.com/mitch-radicaproducts-com/airtable-custom-elements
- Bridge on main: https://github.com/mitch-radicaproducts-com/airtable-custom-elements/tree/main/inventory_day/nfc
- Launcher pull request: https://github.com/mitch-radicaproducts-com/airtable-custom-elements/pull/17
- Extension block: `NONE/blkfRUIx6P343AmoZ`
- Base: `apptmE8EpK6ku4mjM`, "Assembly Line Matrix"

You do not need an Airtable token. You do not write records.

## The contract to keep

The interface iframe cannot see the reader. It posts a hello to the top Airtable window, and it accepts a reply only when `event.source` is `window.top`.

Hello, from the iframe to the top window, every 2 seconds:

```json
{"source":"inventory-day-nfc","type":"inventory-day:nfc-hello"}
```

Reply, from the top window back to that iframe:

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

`state` must be one of `waiting`, `off`, `on`, `tag`, `error`. Any other source, type, or state is ignored. The page treats `on` plus a uid as `tag`.

What each state means to the page:

- `off`: the bridge process is not running. The panel says the reader bridge is not running.
- `on`: the bridge is up and no card is present. The page clears the selected record.
- `tag`: a card is on the reader. The page reads `text`.
- `error`: pass `detail` through. The page shows a failure.
- `waiting`: the page uses this itself when no extension answers. The extension does not need to send it.

The bridge's own JSON is smaller. `GET http://127.0.0.1:17341/status` returns:

```json
{"state":"tag","detail":"ACS ACR122U PICC Interface 00 00","uid":"04a1b2","text":"R-0653-B1"}
```

Bind `127.0.0.1` only. The path is `/status`. Send `Cache-Control: no-store`. The current server also sends `Access-Control-Allow-Origin: *`. An extension with host permission does not need that header, but leave it so the current userscript keeps working during the switch.

The userscript polls every 400ms. On HTTP failure, timeout, or bad JSON it publishes `state: "off"`. If the body has a uid, it publishes `state: "tag"` even when the bridge said something else. Match that.

`text` is the NDEF text, unchanged except for the trim the parser already does. Bin codes look like `R-0653-B1` or `R0653-B12`. The interface parses that. Do not rewrite it.

Removing the card must clear `uid` and `text` immediately. The page deselects the record when the reader is empty.

## How the current pieces work

`source/bridge.mjs` is the server. It uses the `nfc-pcsc` package, loaded with `createRequire` because the package is CommonJS and the file is ESM. On a card it reads 64 bytes starting at page 4 (`reader.read(4, 64)`), which is the start of a Type 2 tag's user memory, and parses an NDEF text record with `source/ndef.mjs`. A failed read still publishes the uid with empty text. `card.off` returns to `state: "on"` with empty uid and text. The dependency is `nfc-pcsc` `^0.8.1`.

`source/acr122u.user.js` is the behavior the extension replaces. It runs only in the top frame (`@noframes`), listens for the hello, remembers `event.source` (the iframe), and `postMessage`s the reading back to those windows. A content script in the top Airtable frame can do the same `postMessage`. A background service worker cannot: the iframe rejects messages whose source is not `window.top`. Poll from the extension, then have the content script in the top frame deliver the message. Match `https://airtable.com/*` and `https://*.airtable.com/*`. Do not inject into every frame.

`source/start-bridge.sh` is the launcher Mitchell uses today. From the Linux terminal:

```sh
bash /mnt/chromeos/shared/MyFiles/NFC/start-bridge.sh
```

The filename is `start-bridge.sh` with a hyphen. `start_bridge.sh` does not exist, and that typo already cost a debugging round.

If the script is started from `/mnt/chromeos/...`, it copies the bridge into `~/nfc` and runs it from there. `npm install` of `nfc-pcsc` builds a native PC/SC addon. That build has to happen on the Linux disk. The ChromeOS shared-files mount is a poor place for it, and it is mounted `noexec`, so the script is started with `bash /path/start-bridge.sh` rather than executed directly.

The script installs a desktop file at `~/.local/share/applications/inventory-day-nfc.desktop`. ChromeOS shows it in the app list as **Inventory Day NFC**. Mitchell confirmed the icon is there. Clicking it opens a terminal and runs the bridge. Leave that window open while counting. Closing it stops the reader, and the page goes to "bridge is not running."

The script's desktop entry prefers `x-terminal-emulator` when that program exists, and otherwise sets `Terminal=true`. On his Chromebook the result is a terminal window. That is expected. A window of its own was discussed and left for later. A reliable install matters more than hiding the terminal.

## What we learned on his Chromebook

The machine is a Chromebook. The Linux container is Crostini, named `penguin`. The shell prompt is `mitch@penguin`. His current bridge folder, shared with Linux, is `/mnt/chromeos/shared/MyFiles/NFC/`. An earlier copy lived under Downloads as `airtable-custom-elements-main`.

Chrome cannot open this reader. Web NFC talks only to a phone's built-in radio. Chrome blocks USB class `0x0B`, the smart-card class the ACR122U uses, for pages and for userscripts. Something outside Chrome has to speak PC/SC.

On a Chromebook that something has to run in Linux. Crostini can see a USB device after it is shared, and Chrome on ChromeOS can reach `127.0.0.1` ports bound inside the container. An Android app from the Play Store does not share that localhost with Chrome, and it cannot register as a Chrome native-messaging host. A Play Store "native server" was considered and set aside for that reason. Do not rebuild this as an Android app.

The reader does not appear in Linux until it is shared. ChromeOS setting path: Settings, Developers, Linux, USB preferences, then the ACR122U. The script cannot do this. Every new Chromebook needs it once, and a newly plugged reader may need to be shared again.

`pcscd` from the Linux terminal returns `SCardEstablishContext: Access denied` until polkit is turned off for the daemon. The fix, which the launcher already applies when it starts `pcscd`, is a line in `/etc/default/pcscd`:

```
PCSCD_ARGS=--disable-polkit
```

Then restart `pcscd`. The terminal is not a local polkit session, so the default policy denies it.

Packages the container needs:

```sh
sudo apt update && sudo apt install -y pcscd libccid pcsc-tools libpcsclite-dev build-essential nodejs npm
```

A debit card was the hardware smoke test. Tapping it publishes a uid and removing it returns to waiting. That card is not a bin. Bin tags are NDEF text records whose text is the R# and the bin, such as `R-0653-B1`. The page keys off that text. The uid alone does not select a product.

The reader name reported by PC/SC on his machine was `ACS ACR122U PICC Interface 00 00`.

`reader.read(4, 64)` is enough for these short bin strings. A longer NDEF message would be cut off at 64 bytes. Do not change the read unless a real tag fails to parse.

Managed Chromebooks can have Linux disabled by admin policy. A factory rollout needs Linux allowed on those devices before the installer matters.

## What deployment should become

One package, two installs, then a daily open.

Once per Chromebook:

1. Turn on Linux.
2. Plug in the ACR122U and share it with Linux.
3. Run one installer. It should install the apt packages, write the pcscd polkit line, copy the server to `~/nfc`, run `npm install` there, and add the Inventory Day NFC launcher.
4. Install the Chrome extension. No Tampermonkey, and no separate userscript import.

Each counting session: open Inventory Day NFC and leave it running, then use the Inventory Day interface. The extension stays installed.

The installer should be safe to run again. It should not make the operator remember `~/nfc`, `pcscd`, or `npm`.

Keep the current userscript working until the extension is installed on a counting Chromebook and a real bin tag selects the record. Then the userscript can be dropped from the factory instructions. The interface repository can keep the file until Mitchell asks to remove it.

## Extension requirements

- A normal Chrome extension. Manifest V3 is appropriate.
- Host permission for `http://127.0.0.1:17341/*`.
- Content script on `https://airtable.com/*` and `https://*.airtable.com/*`, top frame only.
- Listen for `inventory-day:nfc-hello`, remember the iframe window that sent it, and `postMessage` the reading to that window from the top frame.
- Poll `/status` about every 400ms. Publish `off` when the request fails.
- Publish `tag` whenever a uid is present.
- Clear uid and text when the card is gone.
- Pass `text` through unchanged.
- Do not request serial-port permission. That belongs to the scale script.

Loading an unpacked extension in developer mode is a fine first factory step. A packed zip is a fine second step. The Chrome Web Store is optional and is not required for the first working deploy. If the company later manages the Chromebooks in the Google admin console, the same extension can be force-installed. The Linux server still cannot be force-installed that way.

## First work in the new repo

1. Create the repository and commit `source/` as the starting server.
2. Add a short install document that matches the four one-time steps above, using the paths and the polkit fix in this file.
3. Make the installer idempotent, and keep `npm install` on `~/nfc` rather than on `/mnt/chromeos`.
4. Build the extension against the contract. Verify with the bridge running that a tag on the reader produces a `postMessage` the interface will accept: source `inventory-day-nfc`, type `inventory-day:nfc`, state `tag`, and the bin text.
5. Verify card removal produces `on` with empty uid and text, and that stopping the server produces `off`.

## Files in this packet

| File | Role |
| --- | --- |
| `source/bridge.mjs` | PC/SC server on port 17341 |
| `source/ndef.mjs` | Type 2 NDEF text parser |
| `source/package.json` | `nfc-pcsc` dependency |
| `source/start-bridge.sh` | Chromebook launcher and app-list entry |
| `source/acr122u.user.js` | Tampermonkey behavior to replace |
