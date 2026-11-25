export function parseNdefText(bytes) {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    let index = 0;
    while (index < data.length) {
        const marker = data[index];
        if (marker === 0x00) {
            index += 1;
            continue;
        }
        if (marker === 0xFE || marker === undefined) break;
        if (marker !== 0x03) break;
        index += 1;
        if (index >= data.length) return '';
        let length = data[index];
        index += 1;
        if (length === 0xFF) {
            if (index + 1 >= data.length) return '';
            length = (data[index] << 8) | data[index + 1];
            index += 2;
        }
        const message = data.slice(index, index + length);
        const text = textFromNdefMessage(message);
        if (text) return text;
        index += length;
    }
    return textFromNdefMessage(data);
}

function textFromNdefMessage(message) {
    let index = 0;
    while (index < message.length) {
        const flags = message[index];
        if (flags === undefined) return '';
        const shortRecord = (flags & 0x10) !== 0;
        const hasId = (flags & 0x08) !== 0;
        const typeLength = message[index + 1] || 0;
        let payloadLength = 0;
        let cursor = index + 2;
        if (shortRecord) {
            payloadLength = message[cursor] || 0;
            cursor += 1;
        } else {
            if (cursor + 3 >= message.length) return '';
            payloadLength = (message[cursor] << 24) | (message[cursor + 1] << 16) | (message[cursor + 2] << 8) | message[cursor + 3];
            cursor += 4;
        }
        let idLength = 0;
        if (hasId) {
            idLength = message[cursor] || 0;
            cursor += 1;
        }
        const type = message.slice(cursor, cursor + typeLength);
        cursor += typeLength + idLength;
        const payload = message.slice(cursor, cursor + payloadLength);
        if (type.length === 1 && type[0] === 0x54 && payload.length) {
            const text = decodeTextPayload(payload);
            if (text) return text;
        }
        const recordLength = cursor + payloadLength - index;
        if (recordLength <= 0) return '';
        index += recordLength;
        if ((flags & 0x40) !== 0) break;
    }
    return '';
}

function decodeTextPayload(payload) {
    const status = payload[0];
    const languageLength = status & 0x3F;
    const utf16 = (status & 0x80) !== 0;
    const body = payload.slice(1 + languageLength);
    if (!body.length) return '';
    try {
        return new TextDecoder(utf16 ? 'utf-16' : 'utf-8').decode(body).replace(/\0/g, '').trim();
    } catch {
        return '';
    }
}
