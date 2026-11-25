import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import {
    BRIDGE,
    OFF_READING,
    MESSAGE_TYPE,
    SOURCE,
    pageMessage,
    readBridge,
    readingFromResponse,
} from '../extension/reading.mjs';

const READER = 'ACS ACR122U PICC Interface 00 00';

test('a uid is published as a tag and the bin text is unchanged', () => {
    const reading = readingFromResponse(200, {
        state: 'on',
        detail: READER,
        uid: '04a1b2',
        text: 'R-0653-B1',
    });
    assert.deepEqual(reading, {
        state: 'tag',
        detail: READER,
        uid: '04a1b2',
        text: 'R-0653-B1',
    });
    assert.equal(readingFromResponse(200, {
        state: 'error',
        detail: READER,
        uid: '04a1b2',
        text: 'R0653-B12',
    }).state, 'tag');
    assert.equal(readingFromResponse(200, {
        state: 'tag',
        detail: READER,
        uid: '04a1b2',
        text: 'R0653-B12',
    }).text, 'R0653-B12');
});

test('removing the card publishes on with empty uid and text', () => {
    assert.deepEqual(readingFromResponse(200, {
        state: 'on',
        detail: READER,
        uid: '',
        text: '',
    }), {
        state: 'on',
        detail: READER,
        uid: '',
        text: '',
    });
    assert.equal(readingFromResponse(200, {state: 'tag', detail: READER, uid: '', text: ''}).state, 'on');
});

test('a reader error without a uid is passed through', () => {
    assert.deepEqual(readingFromResponse(200, {
        state: 'error',
        detail: 'SCardEstablishContext: Access denied',
        uid: '',
        text: '',
    }), {
        state: 'error',
        detail: 'SCardEstablishContext: Access denied',
        uid: '',
        text: '',
    });
});

test('a failed request, bad JSON, or a non-200 status is off', () => {
    assert.deepEqual(readingFromResponse(200, null), OFF_READING);
    assert.deepEqual(readingFromResponse(500, {state: 'tag', uid: '04a1b2', text: 'R-0653-B1'}), OFF_READING);
    assert.equal(readingFromResponse(200, {state: 'waiting'}).state, 'on');
    assert.equal(readingFromResponse(200, {uid: 1234, text: 9, detail: 9}).uid, '');
    assert.equal(readingFromResponse(200, {uid: 1234}).state, 'tag');
});

test('the page message uses the inventory-day names', () => {
    const message = pageMessage(readingFromResponse(200, {
        state: 'tag',
        detail: READER,
        uid: '04a1b2',
        text: 'R-0653-B1',
    }));
    assert.deepEqual(message, {
        source: SOURCE,
        type: MESSAGE_TYPE,
        state: 'tag',
        detail: READER,
        uid: '04a1b2',
        text: 'R-0653-B1',
    });
});

test('readBridge follows a live status document, then reports off when it is gone', {timeout: 10000}, async () => {
    const states = [];
    let current = {state: 'tag', detail: READER, uid: '04a1b2', text: 'R-0653-B1'};
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
        response.end(JSON.stringify(current));
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const {port} = server.address();
    const url = `http://127.0.0.1:${port}/status`;
    try {
        states.push(await readBridge({url}));
        current = {state: 'on', detail: READER, uid: '', text: ''};
        states.push(await readBridge({url}));
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
    states.push(await readBridge({url, timeoutMs: 200}));
    assert.equal(states[0].state, 'tag');
    assert.equal(states[0].text, 'R-0653-B1');
    assert.deepEqual(states[1], {state: 'on', detail: READER, uid: '', text: ''});
    assert.deepEqual(states[2], OFF_READING);
    assert.equal(BRIDGE, 'http://127.0.0.1:17341/status');
});

test('a hung status request becomes off at the timeout', {timeout: 5000}, async () => {
    const started = Date.now();
    const reading = await readBridge({
        timeoutMs: 50,
        fetchImpl(_url, {signal}) {
            return new Promise((_resolve, reject) => {
                signal.addEventListener('abort', () => {
                    reject(new DOMException('The operation was aborted.', 'AbortError'));
                });
            });
        },
    });
    assert.deepEqual(reading, OFF_READING);
    assert.ok(Date.now() - started < 1000);
});
