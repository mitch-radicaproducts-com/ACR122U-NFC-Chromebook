// ==UserScript==
// @name         ACR122U NFC bridge
// @namespace    https://github.com/mitch-radicaproducts-com/smart-inventory-scale
// @version      1.0.0
// @description  Pass ACR122U bin tags to the Inventory Day page
// @match        https://airtable.com/*
// @match        https://*.airtable.com/*
// @match        http://localhost/*
// @match        http://127.0.0.1/*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    const SOURCE = 'inventory-day-nfc';
    const BRIDGE = 'http://127.0.0.1:17341/status';
    const pages = new Set();
    let reading = {state: 'off', detail: 'The reader bridge is not running.', uid: '', text: ''};

    function remember(page) {
        if (page && page !== window) pages.add(page);
    }

    function publish(message) {
        for (const page of pages) {
            try {
                page.postMessage(message, '*');
            } catch {
                pages.delete(page);
            }
        }
    }

    function publishReading() {
        publish({source: SOURCE, type: 'inventory-day:nfc', ...reading});
    }

    function poll() {
        GM_xmlhttpRequest({
            method: 'GET',
            url: BRIDGE,
            timeout: 800,
            onload(response) {
                let body = null;
                try {
                    body = JSON.parse(response.responseText);
                } catch {
                    body = null;
                }
                if (!body || response.status !== 200) {
                    reading = {state: 'off', detail: 'The reader bridge is not running.', uid: '', text: ''};
                } else {
                    reading = {
                        state: body.uid ? 'tag' : (body.state === 'error' ? 'error' : 'on'),
                        detail: typeof body.detail === 'string' ? body.detail : '',
                        uid: typeof body.uid === 'string' ? body.uid : '',
                        text: typeof body.text === 'string' ? body.text : '',
                    };
                }
                publishReading();
            },
            onerror() {
                reading = {state: 'off', detail: 'The reader bridge is not running.', uid: '', text: ''};
                publishReading();
            },
            ontimeout() {
                reading = {state: 'off', detail: 'The reader bridge is not running.', uid: '', text: ''};
                publishReading();
            },
        });
    }

    window.addEventListener('message', (event) => {
        const data = event.data;
        if (!data || data.source !== SOURCE || data.type !== 'inventory-day:nfc-hello') return;
        remember(event.source);
        publishReading();
    });

    poll();
    setInterval(poll, 400);
}());
