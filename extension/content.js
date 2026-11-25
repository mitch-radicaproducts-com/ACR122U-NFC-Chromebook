const SOURCE = 'inventory-day-nfc';
const HELLO = 'inventory-day:nfc-hello';
const READING = 'inventory-day:nfc';
const POLL = 'inventory-day:nfc-poll';

const pages = new Set();
let reading = offMessage();
let pollGeneration = 0;

function offMessage() {
    return {
        source: SOURCE,
        type: READING,
        state: 'off',
        detail: 'The reader bridge is not running.',
        uid: '',
        text: '',
    };
}

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

function isHello(data) {
    return Boolean(data && data.source === SOURCE && data.type === HELLO);
}

function isReading(message) {
    return Boolean(message && message.source === SOURCE && message.type === READING);
}

async function poll() {
    const generation = ++pollGeneration;
    let message = null;
    try {
        message = await chrome.runtime.sendMessage({type: POLL});
    } catch {
        message = null;
    }
    if (generation !== pollGeneration) return;
    reading = isReading(message) ? message : offMessage();
    publish(reading);
}

// The Inventory Day iframe accepts a reading only when event.source is the
// top window. This script runs in that top frame and answers the hello.
window.addEventListener('message', (event) => {
    if (!isHello(event.data)) return;
    remember(event.source);
    publish(reading);
});

poll();
setInterval(poll, 400);
