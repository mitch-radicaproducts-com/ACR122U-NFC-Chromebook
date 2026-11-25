export const SOURCE = 'inventory-day-nfc';
export const HELLO_TYPE = 'inventory-day:nfc-hello';
export const MESSAGE_TYPE = 'inventory-day:nfc';
export const POLL_MESSAGE = 'inventory-day:nfc-poll';
export const BRIDGE = 'http://127.0.0.1:17341/status';

export const OFF_READING = Object.freeze({
    state: 'off',
    detail: 'The reader bridge is not running.',
    uid: '',
    text: '',
});

export function readingFromResponse(statusCode, body) {
    if (!body || statusCode !== 200) return {...OFF_READING};
    return {
        state: body.uid ? 'tag' : (body.state === 'error' ? 'error' : 'on'),
        detail: typeof body.detail === 'string' ? body.detail : '',
        uid: typeof body.uid === 'string' ? body.uid : '',
        text: typeof body.text === 'string' ? body.text : '',
    };
}

export function pageMessage(reading) {
    return {
        source: SOURCE,
        type: MESSAGE_TYPE,
        state: reading.state,
        detail: reading.detail,
        uid: reading.uid,
        text: reading.text,
    };
}

export function isHello(data) {
    return Boolean(data && data.source === SOURCE && data.type === HELLO_TYPE);
}

export async function readBridge(options = {}) {
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    const timeoutMs = options.timeoutMs ?? 800;
    const url = options.url ?? BRIDGE;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetchImpl(url, {cache: 'no-store', signal: controller.signal});
        let body = null;
        try {
            body = JSON.parse(await response.text());
        } catch {
            body = null;
        }
        return readingFromResponse(response.status, body);
    } catch {
        return {...OFF_READING};
    } finally {
        clearTimeout(timer);
    }
}
