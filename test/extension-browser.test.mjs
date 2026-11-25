import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const READER = 'ACS ACR122U PICC Interface 00 00';

function findChrome() {
    // Branded Chrome ignores --load-extension. Chrome for Testing still loads it.
    const candidates = [
        process.env.CHROME_PATH,
        '/tmp/chrome-for-testing/chrome-linux64/chrome',
    ];
    return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || '';
}

function listen(server, port = 0) {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => resolve(server.address().port));
    });
}

function close(server) {
    return new Promise((resolve) => server.close(() => resolve()));
}

async function waitFor(predicate, timeoutMs, label) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`timed out waiting for ${label}`);
}

test('Chrome delivers a tag, a removal, and a stopped bridge to the top window', {timeout: 90000}, async (t) => {
    const chromeBin = findChrome();
    if (!chromeBin) {
        t.skip('Set CHROME_PATH to Chrome for Testing. Branded Chrome ignores --load-extension.');
        return;
    }

    let current = {state: 'tag', detail: READER, uid: '04a1b2', text: 'R-0653-B1'};
    let seen = [];
    const status = http.createServer((request, response) => {
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
    const page = http.createServer((request, response) => {
        if (request.method === 'POST' && request.url === '/result') {
            const chunks = [];
            request.on('data', (chunk) => chunks.push(chunk));
            request.on('end', () => {
                try {
                    seen = JSON.parse(Buffer.concat(chunks).toString() || '[]');
                } catch {
                    seen = [];
                }
                response.writeHead(204);
                response.end();
            });
            return;
        }
        const name = request.url === '/iframe.html' ? 'iframe.html' : 'top.html';
        response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
        response.end(fs.readFileSync(path.join(root, 'test/fixtures', name)));
    });

    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'nfc-chrome-'));
    const extensionDir = path.join(work, 'extension');
    let chrome = null;
    let chromeLog = '';
    try {
        await listen(status, 17341);
        const pagePort = await listen(page);
        fs.cpSync(path.join(root, 'extension'), extensionDir, {recursive: true});
        const manifest = JSON.parse(fs.readFileSync(path.join(extensionDir, 'manifest.json'), 'utf8'));
        manifest.content_scripts[0].matches.push(`http://127.0.0.1:${pagePort}/*`);
        fs.writeFileSync(path.join(extensionDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

        chrome = spawn(chromeBin, [
            '--headless=new',
            '--no-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-sync',
            '--disable-background-networking',
            '--disable-component-update',
            '--disable-features=DisableLoadExtensionCommandLineSwitch',
            '--enable-logging=stderr',
            `--user-data-dir=${path.join(work, 'profile')}`,
            `--load-extension=${extensionDir}`,
            `http://127.0.0.1:${pagePort}/top.html`,
        ], {detached: true, stdio: ['ignore', 'pipe', 'pipe']});
        chrome.stdout.on('data', (chunk) => {
            chromeLog += chunk;
        });
        chrome.stderr.on('data', (chunk) => {
            chromeLog += chunk;
        });

        await waitFor(
            () => seen.some((item) => item.state === 'tag' && item.uid === '04a1b2' && item.text === 'R-0653-B1' && item.detail === READER),
            30000,
            `tag message\n${chromeLog.slice(-4000)}`,
        );
        current = {state: 'on', detail: READER, uid: '', text: ''};
        const tagAt = seen.findIndex((item) => item.state === 'tag' && item.text === 'R-0653-B1');
        await waitFor(
            () => seen.some((item, index) => index > tagAt && item.state === 'on' && item.uid === '' && item.text === '' && item.detail === READER),
            8000,
            'card removal',
        );
        await close(status);
        const onAt = seen.findIndex((item, index) => index > tagAt && item.state === 'on' && item.uid === '');
        await waitFor(
            () => seen.some((item, index) => index > onAt && item.state === 'off' && item.uid === '' && item.text === '' && item.detail === 'The reader bridge is not running.'),
            8000,
            'stopped bridge',
        );
    } finally {
        if (chrome) {
            try {
                process.kill(-chrome.pid, 'SIGKILL');
            } catch {
                chrome.kill('SIGKILL');
            }
        }
        await close(page);
        if (status.listening) await close(status);
    }
});
