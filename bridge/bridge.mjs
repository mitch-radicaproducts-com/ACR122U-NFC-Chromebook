import http from 'node:http';
import {createRequire} from 'node:module';
import {parseNdefText} from './ndef.mjs';

const require = createRequire(import.meta.url);
const {NFC} = require('nfc-pcsc');

const port = 17341;
let reading = {state: 'on', detail: 'Reader ready.', uid: '', text: ''};

function setReading(next) {
    reading = next;
}

const nfc = new NFC();

nfc.on('reader', (reader) => {
    setReading({state: 'on', detail: reader.reader.name, uid: '', text: ''});

    reader.on('card', async (card) => {
        let text = '';
        try {
            const data = await reader.read(4, 64);
            text = parseNdefText(data);
        } catch {
            text = '';
        }
        setReading({
            state: 'tag',
            detail: reader.reader.name,
            uid: String(card.uid || ''),
            text,
        });
    });

    reader.on('card.off', () => {
        setReading({state: 'on', detail: reader.reader.name, uid: '', text: ''});
    });

    reader.on('error', (error) => {
        setReading({state: 'error', detail: error.message, uid: '', text: ''});
    });
});

nfc.on('error', (error) => {
    setReading({state: 'error', detail: error.message, uid: '', text: ''});
});

const server = http.createServer((request, response) => {
    if (request.url !== '/status') {
        response.writeHead(404);
        response.end();
        return;
    }
    response.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
    });
    response.end(JSON.stringify(reading));
});

server.listen(port, '127.0.0.1', () => {
    process.stdout.write(`ACR122U bridge listening on http://127.0.0.1:${port}/status\n`);
});
