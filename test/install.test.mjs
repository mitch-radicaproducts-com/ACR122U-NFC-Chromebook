import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(command, args, env) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {env, cwd: root, stdio: ['ignore', 'pipe', 'pipe']});
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => {
            stdout += chunk;
        });
        child.stderr.on('data', (chunk) => {
            stderr += chunk;
        });
        child.on('error', reject);
        child.on('close', (code) => resolve({code, stdout, stderr}));
    });
}

function writeExecutable(file, body) {
    fs.writeFileSync(file, body);
    fs.chmodSync(file, 0o755);
}

test('shell scripts parse', async () => {
    for (const file of ['install.sh', 'start-bridge.sh', 'bridge/start-bridge.sh', 'bridge/setup.sh', 'scripts/pack-extension.sh']) {
        const result = await run('bash', ['-n', file], process.env);
        assert.equal(result.code, 0, result.stderr);
    }
});

test('the installer copies the bridge onto ~/nfc and installs npm there', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'nfc-home-'));
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'nfc-bin-'));
    const npmLog = path.join(home, 'npm.log');
    writeExecutable(path.join(bin, 'npm'), `#!/bin/bash
echo "$PWD" >> "${npmLog}"
exit 0
`);
    const env = {
        ...process.env,
        HOME: home,
        PATH: `${bin}:${process.env.PATH}`,
        SKIP_SYSTEM: '1',
    };
    const first = await run('bash', ['install.sh'], env);
    assert.equal(first.code, 0, first.stderr + first.stdout);
    const second = await run('bash', ['install.sh'], env);
    assert.equal(second.code, 0, second.stderr + second.stdout);

    const runtime = path.join(home, 'nfc');
    assert.equal(
        fs.readFileSync(path.join(runtime, 'bridge.mjs'), 'utf8'),
        fs.readFileSync(path.join(root, 'bridge/bridge.mjs'), 'utf8'),
    );
    assert.ok(fs.existsSync(path.join(runtime, 'ndef.mjs')));
    assert.ok(fs.existsSync(path.join(runtime, 'setup.sh')));
    assert.ok(fs.statSync(path.join(runtime, 'start-bridge.sh')).mode & 0o111);

    const dirs = fs.readFileSync(npmLog, 'utf8').trim().split('\n');
    assert.deepEqual(dirs, [runtime, runtime]);

    const desktop = fs.readFileSync(path.join(home, '.local/share/applications/inventory-day-nfc.desktop'), 'utf8');
    assert.match(desktop, /Name=Inventory Day NFC/);
    assert.match(desktop, new RegExp(`Exec=.*${runtime}/start-bridge.sh`));
    assert.equal(desktop.includes('/mnt/chromeos'), false);
    assert.equal(desktop.split('Name=').length, 2);
});

test('the pcscd polkit line is written once and the service is restarted only then', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'nfc-home-'));
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'nfc-bin-'));
    const etc = fs.mkdtempSync(path.join(os.tmpdir(), 'nfc-etc-'));
    const pcscdDefault = path.join(etc, 'pcscd');
    const sudoLog = path.join(home, 'sudo.log');
    const activeFlag = path.join(home, 'pcscd-active');
    writeExecutable(path.join(bin, 'npm'), '#!/bin/bash\nexit 0\n');
    writeExecutable(path.join(bin, 'sudo'), `#!/bin/bash
if [[ "$1" == "tee" && "$2" == "-a" ]]; then
    cat >> "$3"
    exit 0
fi
if [[ "$1" == "apt" ]]; then
    echo "apt \${*:2}" >> "${sudoLog}"
    exit 0
fi
if [[ "$1" == "systemctl" ]]; then
    echo "systemctl \${*:2}" >> "${sudoLog}"
    exit 0
fi
echo "unexpected sudo: \$*" >> "${sudoLog}"
exit 1
`);
    writeExecutable(path.join(bin, 'systemctl'), `#!/bin/bash
if [[ "$1" == "is-active" ]]; then
    if [[ -f "${activeFlag}" ]]; then exit 0; else exit 3; fi
fi
echo "direct systemctl \$*" >> "${sudoLog}"
exit 0
`);
    const env = {
        ...process.env,
        HOME: home,
        PATH: `${bin}:${process.env.PATH}`,
        PCSCD_DEFAULT: pcscdDefault,
        SKIP_NPM: '1',
    };
    delete env.SKIP_SYSTEM;

    const first = await run('bash', ['install.sh'], env);
    assert.equal(first.code, 0, first.stderr + first.stdout);
    assert.equal(fs.readFileSync(pcscdDefault, 'utf8'), 'PCSCD_ARGS=--disable-polkit\n');
    const firstLog = fs.readFileSync(sudoLog, 'utf8');
    assert.match(firstLog, /apt install -y pcscd libccid pcsc-tools libpcsclite-dev build-essential nodejs npm/);
    assert.match(firstLog, /systemctl restart pcscd/);
    assert.equal(firstLog.includes('systemctl start pcscd'), false);

    fs.writeFileSync(activeFlag, '1');
    fs.writeFileSync(sudoLog, '');
    const second = await run('bash', ['install.sh'], env);
    assert.equal(second.code, 0, second.stderr + second.stdout);
    assert.equal(fs.readFileSync(pcscdDefault, 'utf8'), 'PCSCD_ARGS=--disable-polkit\n');
    assert.equal(fs.readFileSync(sudoLog, 'utf8').includes('systemctl'), false);

    fs.rmSync(activeFlag);
    fs.writeFileSync(pcscdDefault, 'PCSCD_ARGS=--disable-polkit\n# already set\n');
    fs.writeFileSync(sudoLog, '');
    const third = await run('bash', ['install.sh'], env);
    assert.equal(third.code, 0, third.stderr + third.stdout);
    assert.equal(fs.readFileSync(pcscdDefault, 'utf8').match(/--disable-polkit/g).length, 1);
    const thirdLog = fs.readFileSync(sudoLog, 'utf8');
    assert.match(thirdLog, /systemctl start pcscd/);
    assert.equal(thirdLog.includes('systemctl restart pcscd'), false);
});
