# Install the Inventory Day NFC reader

Do this once on each Chromebook. Running it again is safe.

## 1. Turn on Linux

Settings, Advanced, Developers, Linux, Turn on. The container is named `penguin`.

A managed Chromebook needs Linux allowed by admin policy before this installer can work.

## 2. Share the reader with Linux

Plug in the ACR122U. Then open Settings, Developers, Linux, USB preferences, and share the ACR122U.

The reader does not appear in Linux until it is shared. A reader that was unplugged may need to be shared again. The installer cannot do this step.

## 3. Put the project in My files and run the installer

Download the repository zip. It lands in Downloads. In the Files app, extract that zip directly into **My files** in the left sidebar. The extracted folder should sit in My files itself, beside Downloads, named `ACR122U-NFC-Chromebook-main`. Leave it out of Downloads and out of any other folder.

Share that folder with Linux. Right-click `ACR122U-NFC-Chromebook-main` and choose Share with Linux. Linux then sees it at `/mnt/chromeos/shared/MyFiles/ACR122U-NFC-Chromebook-main`.

In the Linux terminal:

```sh
bash /mnt/chromeos/shared/MyFiles/ACR122U-NFC-Chromebook-main/install.sh
```

The shared folder is mounted `noexec`, so start the installer with `bash`. The filename is `install.sh`.

If the project was cloned inside Linux instead, run `bash install.sh` from that clone.

The installer does all of the following:

- Installs `pcscd`, `libccid`, `pcsc-tools`, `libpcsclite-dev`, `build-essential`, `nodejs`, and `npm`.
- Writes `PCSCD_ARGS=--disable-polkit` into `/etc/default/pcscd`, then restarts the card service. Without that line, `pcscd` returns `SCardEstablishContext: Access denied` from the Linux terminal.
- Copies the bridge to `~/nfc` and runs `npm install` there. The reader library builds a native addon, and that build has to happen on the Linux disk.
- Adds **Inventory Day NFC** to the app list. The launcher opens a terminal and runs the bridge. Leave that window open while counting.

Linux may ask for your password.

## 4. Install the Chrome extension

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Choose Load unpacked.
4. Select the `extension` folder inside `ACR122U-NFC-Chromebook-main` in My files.

Leave the extension installed. It has permission for `http://127.0.0.1:17341/*` and for the Airtable pages it injects into. It has no serial-port permission. The scale script still owns the serial port.

Loading the unpacked folder is the factory step. `scripts/pack-extension.sh` writes `dist/inventory-day-nfc.zip` when a packed copy is useful. The Chrome Web Store is optional. A later Google admin install can force-install the same extension. The Linux bridge still has to be installed on each Chromebook.

The Tampermonkey script can stay until a real bin tag selects the record on a counting Chromebook. After that, remove the userscript so only the extension talks to the page.

## Each counting session

Open **Inventory Day NFC** and leave the window open. Then use Inventory Day. Close the window to stop the reader. The page then says the reader bridge is not running.

## Check

With the window open, open `http://127.0.0.1:17341/status` in Chrome on the Chromebook.

- A debit card shows a uid. Taking it off clears `uid` and `text`.
- A bin tag shows `text` such as `R-0653-B1` or `R0653-B12`. The page uses that text.
- Closing the bridge window makes the status page fail to load. The extension then publishes `off`.

On the Inventory Day page, a bin tag selects the record, and taking the tag off clears it.

## If the reader stays quiet

- Share the ACR122U with Linux again, then reopen Inventory Day NFC.
- Run the installer again. That rewrites the pcscd line and refreshes `~/nfc`:

  ```sh
  bash /mnt/chromeos/shared/MyFiles/ACR122U-NFC-Chromebook-main/install.sh
  ```

- The app-list name is **Inventory Day NFC**. The launcher file is `start-bridge.sh`.
