import assert from 'node:assert/strict';
import test from 'node:test';
import {parseNdefText} from '../bridge/ndef.mjs';

function textRecord(text, {utf16 = false, language = 'en'} = {}) {
    const languageBytes = [...Buffer.from(language, 'ascii')];
    const body = utf16 ? utf16CodeUnits(text) : [...Buffer.from(text, 'utf8')];
    const status = (utf16 ? 0x80 : 0x00) | languageBytes.length;
    const payload = [status, ...languageBytes, ...body];
    const record = [0xD1, 0x01, payload.length, 0x54, ...payload];
    return [0x00, 0x03, record.length, ...record, 0xFE];
}

function utf16CodeUnits(text) {
    const bytes = [];
    for (const unit of Buffer.from(text, 'utf16le')) bytes.push(unit);
    return bytes;
}

test('a type 2 NDEF text record is the bin text', () => {
    const payload = new TextEncoder().encode('enR-0653');
    const record = [0xD1, 0x01, payload.length + 1, 0x54, 0x02, ...payload];
    const tlv = [0x00, 0x03, record.length, ...record, 0xFE];
    assert.equal(parseNdefText(tlv), 'R-0653');
    assert.equal(parseNdefText([0x00, 0xFE]), '');
});

test('bin codes pass through with the parser trim and null stripping', () => {
    assert.equal(parseNdefText(textRecord('R-0653-B1')), 'R-0653-B1');
    assert.equal(parseNdefText(textRecord('R0653-B12')), 'R0653-B12');
    assert.equal(parseNdefText(textRecord('  R-0653-B1  ')), 'R-0653-B1');
    assert.equal(parseNdefText(textRecord('R-0653\u0000-B1')), 'R-0653-B1');
});

test('a UTF-16 text record still returns the bin code', () => {
    assert.equal(parseNdefText(textRecord('R-0653-B1', {utf16: true})), 'R-0653-B1');
});
