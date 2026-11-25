import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {pageMessage, readingFromResponse} from '../extension/reading.mjs';

const READER = 'ACS ACR122U PICC Interface 00 00';

// Mirrors inventory_day/frontend/nfcHost.mjs nfcFromMessage, which accepts a
// reading only from this source and only for these states. The iframe also
// requires event.source === window.top; the browser test covers that check.
function acceptedByInterface(data) {
    const states = new Set(['waiting', 'off', 'on', 'tag', 'error']);
    if (!data || data.source !== 'inventory-day-nfc' || data.type !== 'inventory-day:nfc') return null;
    if (!states.has(data.state)) return null;
    const uid = String(data.uid ?? '').toUpperCase().replace(/[^0-9A-F]/g, '');
    return {
        state: data.state === 'on' && uid ? 'tag' : data.state,
        detail: typeof data.detail === 'string' ? data.detail : '',
        uid,
        text: typeof data.text === 'string' ? data.text : '',
    };
}

test('a tag, a removal, and a stopped bridge are messages the interface accepts', () => {
    const tag = pageMessage(readingFromResponse(200, {
        state: 'tag',
        detail: READER,
        uid: '04a1b2',
        text: 'R-0653-B1',
    }));
    const removed = pageMessage(readingFromResponse(200, {
        state: 'on',
        detail: READER,
        uid: '',
        text: '',
    }));
    const stopped = pageMessage(readingFromResponse(0, null));

    assert.deepEqual(acceptedByInterface(tag), {
        state: 'tag',
        detail: READER,
        uid: '04A1B2',
        text: 'R-0653-B1',
    });
    assert.deepEqual(acceptedByInterface(removed), {
        state: 'on',
        detail: READER,
        uid: '',
        text: '',
    });
    assert.equal(acceptedByInterface(stopped).state, 'off');
    assert.equal(stopped.detail, 'The reader bridge is not running.');
    assert.equal(acceptedByInterface({source: 'other', type: 'inventory-day:nfc', state: 'tag'}), null);
    assert.equal(acceptedByInterface({...tag, state: 'asleep'}), null);
});

test('the bridge file keeps the port, the loopback bind, and the short read', () => {
    const source = fs.readFileSync(new URL('../bridge/bridge.mjs', import.meta.url), 'utf8');
    assert.match(source, /const port = 17341/);
    assert.match(source, /server\.listen\(port, '127\.0\.0\.1'/);
    assert.match(source, /request\.url !== '\/status'/);
    assert.match(source, /'Cache-Control': 'no-store'/);
    assert.match(source, /'Access-Control-Allow-Origin': '\*'/);
    assert.match(source, /reader\.read\(4, 64\)/);
    assert.match(source, /reader\.on\('card\.off'/);
});

test('the extension manifest stays on the Airtable top frame and the loopback status port', () => {
    const manifest = JSON.parse(fs.readFileSync(new URL('../extension/manifest.json', import.meta.url), 'utf8'));
    const content = fs.readFileSync(new URL('../extension/content.js', import.meta.url), 'utf8');
    const background = fs.readFileSync(new URL('../extension/background.js', import.meta.url), 'utf8');
    const userscript = fs.readFileSync(new URL('../userscript/acr122u.user.js', import.meta.url), 'utf8');
    assert.equal(manifest.manifest_version, 3);
    assert.deepEqual(manifest.host_permissions, ['http://127.0.0.1:17341/*']);
    assert.equal(manifest.background.service_worker, 'background.js');
    assert.equal(manifest.background.type, 'module');
    assert.equal(manifest.content_scripts.length, 1);
    assert.deepEqual(manifest.content_scripts[0].matches, [
        'https://airtable.com/*',
        'https://*.airtable.com/*',
    ]);
    assert.equal(manifest.content_scripts[0].all_frames, false);
    assert.deepEqual(manifest.content_scripts[0].js, ['content.js']);
    assert.equal(JSON.stringify(manifest).includes('serial'), false);
    assert.match(content, /inventory-day:nfc-hello/);
    assert.match(content, /inventory-day:nfc-poll/);
    assert.match(content, /postMessage\(message, '\*'\)/);
    assert.equal(content.includes('17341'), false);
    assert.match(background, /readBridge/);
    assert.match(userscript, /The reader bridge is not running\./);
    assert.match(userscript, /setInterval\(poll, 400\)/);
    assert.match(content, /setInterval\(poll, 400\)/);
});
