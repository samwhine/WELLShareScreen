const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { ExpressPeerServer } = require('peer');
const app = express();

app.use(express.json());

// ── Logger ─────────────────────────────────────────────
app.use((req, res, next) => {
    const now = new Date().toLocaleTimeString('id-ID');
    const ip = req.headers['cf-connecting-ip'] 
             || req.headers['x-forwarded-for'] 
             || req.socket.remoteAddress;
    res.on('finish', () => {
        console.log(`[${now}] ${req.method} ${req.path} ${res.statusCode} — ${ip}`);
    });
    next();
});
// ───────────────────────────────────────────────────────

app.use(express.static('public'));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/sender', (req, res) => res.sendFile(path.join(__dirname, 'public/sender.html')));
app.get('/receiver', (req, res) => res.sendFile(path.join(__dirname, 'public/receiver.html')));
app.get('/tv', (req, res) => res.redirect('/receiver'));

// ── EQ Presets API ──────────────────────────────────────
// Disimpan sebagai file JSON di server (bukan localStorage browser), jadi
// preset yang sama bisa diakses dari device manapun yang buka halaman sender.
const DATA_DIR = path.join(__dirname, 'data');
const EQ_PRESETS_FILE = path.join(DATA_DIR, 'eq-presets.json');

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadEQPresets() {
    ensureDataDir();
    try {
        const raw = fs.readFileSync(EQ_PRESETS_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (!data.mic) data.mic = {};
        if (!data.system) data.system = {};
        return data;
    } catch (e) {
        return { mic: {}, system: {} };
    }
}

function saveEQPresets(data) {
    ensureDataDir();
    fs.writeFileSync(EQ_PRESETS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

app.get('/api/eq-presets', (req, res) => {
    res.json(loadEQPresets());
});

app.post('/api/eq-presets', (req, res) => {
    const { which, name, bands } = req.body || {};
    if ((which !== 'mic' && which !== 'system') || !name || !Array.isArray(bands)) {
        return res.status(400).json({ error: 'Invalid request: "which" (mic/system), "name", and "bands" (array) are required.' });
    }
    const data = loadEQPresets();
    if (!data[which]) data[which] = {};
    data[which][name] = bands;
    saveEQPresets(data);
    console.log(`[EQ Preset] Saved "${name}" (${which})`);
    res.json({ ok: true });
});

app.delete('/api/eq-presets', (req, res) => {
    const { which, name } = req.body || {};
    if ((which !== 'mic' && which !== 'system') || !name) {
        return res.status(400).json({ error: 'Invalid request: "which" (mic/system) and "name" are required.' });
    }
    const data = loadEQPresets();
    if (data[which] && data[which][name] !== undefined) {
        delete data[which][name];
        saveEQPresets(data);
        console.log(`[EQ Preset] Deleted "${name}" (${which})`);
    }
    res.json({ ok: true });
});
// ───────────────────────────────────────────────────────

// ── Video Quality Presets API ───────────────────────────
// Sama kayak EQ presets di atas: disimpan sebagai file JSON di server,
// bukan localStorage, jadi preset (termasuk slot "__custom__" yang auto-save)
// bisa diakses dari device manapun yang buka halaman sender.
const VIDEO_PRESETS_FILE = path.join(DATA_DIR, 'video-presets.json');

function loadVideoPresets() {
    ensureDataDir();
    try {
        const raw = fs.readFileSync(VIDEO_PRESETS_FILE, 'utf8');
        const data = JSON.parse(raw);
        return (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
    } catch (e) {
        return {};
    }
}

function saveVideoPresets(data) {
    ensureDataDir();
    fs.writeFileSync(VIDEO_PRESETS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

app.get('/api/video-presets', (req, res) => {
    res.json(loadVideoPresets());
});

app.post('/api/video-presets', (req, res) => {
    const { name, settings } = req.body || {};
    if (!name || !settings || typeof settings !== 'object') {
        return res.status(400).json({ error: 'Invalid request: "name" and "settings" (object) are required.' });
    }
    const data = loadVideoPresets();
    data[name] = settings;
    saveVideoPresets(data);
    console.log(`[Video Preset] Saved "${name}"`);
    res.json({ ok: true });
});

app.delete('/api/video-presets', (req, res) => {
    const { name } = req.body || {};
    if (!name) {
        return res.status(400).json({ error: 'Invalid request: "name" is required.' });
    }
    const data = loadVideoPresets();
    if (data[name] !== undefined) {
        delete data[name];
        saveVideoPresets(data);
        console.log(`[Video Preset] Deleted "${name}"`);
    }
    res.json({ ok: true });
});
// ───────────────────────────────────────────────────────

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (let devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return 'localhost';
}

const PORT = 3000;
const IP = getLocalIP();
// Public-domain placeholder for the repository.
const DOMAIN = 'your-domain.example.com';

// ── PeerJS Self-Hosted Server ───────────────────────────────────
const http = require('http');
const server = http.createServer(app);
const peerServer = ExpressPeerServer(server, { path: '/' });
app.use('/peerjs', peerServer);

peerServer.on('connection', (client) => {
    console.log(`[PeerJS] Client connected: ${client.getId()}`);
});
peerServer.on('disconnect', (client) => {
    console.log(`[PeerJS] Client disconnected: ${client.getId()}`);
});
// ───────────────────────────────────────────────────────────────

function pad(str, len) {
    return str + ' '.repeat(Math.max(0, len - str.length));
}

const W = 57;

server.listen(PORT, '0.0.0.0', () => {
    const lines = [
        '',
        '  WELL Share Screen  ✓ RUNNING',
        '',
        '  LOCAL',
        '  Landing  : http://localhost:' + PORT + '/',
        '  Sender   : http://localhost:' + PORT + '/sender',
        '  Receiver : http://localhost:' + PORT + '/receiver',
        '',
        '  NETWORK (LAN)',
        '  Landing  : http://' + IP + ':' + PORT + '/',
        '  Sender   : http://' + IP + ':' + PORT + '/sender',
        '  Receiver : http://' + IP + ':' + PORT + '/receiver',
        '',
        '  DOMAIN',
        '  Landing  : https://' + DOMAIN + '/',
        '  Sender   : https://' + DOMAIN + '/sender',
        '  Receiver : https://' + DOMAIN + '/receiver',
        '',
    ];

    const border = '='.repeat(W);
    console.log('\n ' + border);
    lines.forEach(line => {
        console.log('  ' + pad(line, W - 2));
    });
    console.log(' ' + border + '\n');
});
