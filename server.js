const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const DATA_DIR = path.join(__dirname, 'server-data');
const DATA_FILE = path.join(DATA_DIR, 'requests.json');
const MIME = {
    '.html': 'text/html;charset=utf-8',
    '.css': 'text/css;charset=utf-8',
    '.js': 'application/javascript;charset=utf-8',
    '.json': 'application/json;charset=utf-8',
    '.csv': 'text/csv;charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf-8');

function readData() {
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); }
    catch { return []; }
}

function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch { reject(new Error('Invalid JSON')); }
        });
        req.on('error', reject);
    });
}

function sendJSON(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json;charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(data));
}

function serveStatic(res, urlPath) {
    let filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);
    if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, 'index.html');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const method = req.method;

    // CORS preflight
    if (method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        return res.end();
    }

    // API routes
    if (url.pathname === '/api/requests' && method === 'GET') {
        return sendJSON(res, 200, readData());
    }

    if (url.pathname === '/api/requests' && method === 'PUT') {
        parseBody(req).then(body => {
            writeData(body);
            sendJSON(res, 200, { ok: true });
        }).catch(() => sendJSON(res, 400, { error: 'Invalid JSON' }));
        return;
    }

    if (url.pathname === '/api/requests' && method === 'POST') {
        parseBody(req).then(body => {
            const data = readData();
            body.id = Date.now().toString();
            data.unshift(body);
            writeData(data);
            sendJSON(res, 201, body);
        }).catch(() => sendJSON(res, 400, { error: 'Invalid JSON' }));
        return;
    }

    if (url.pathname.startsWith('/api/requests/') && method === 'PUT') {
        const id = url.pathname.split('/')[3];
        parseBody(req).then(body => {
            const data = readData();
            const idx = data.findIndex(r => r.id === id);
            if (idx === -1) return sendJSON(res, 404, { error: 'Not found' });
            data[idx] = { ...data[idx], ...body, id };
            writeData(data);
            sendJSON(res, 200, data[idx]);
        }).catch(() => sendJSON(res, 400, { error: 'Invalid JSON' }));
        return;
    }

    if (url.pathname.startsWith('/api/requests/') && method === 'DELETE') {
        const id = url.pathname.split('/')[3];
        const data = readData();
        const filtered = data.filter(r => r.id !== id);
        if (filtered.length === data.length) return sendJSON(res, 404, { error: 'Not found' });
        writeData(filtered);
        sendJSON(res, 200, { ok: true });
        return;
    }

    // Equipment DB API
    if (url.pathname === '/api/equipment' && method === 'GET') {
        const csvPath = path.join(__dirname, 'equipment_database.csv');
        if (!fs.existsSync(csvPath)) return sendJSON(res, 200, []);
        const csv = fs.readFileSync(csvPath, 'utf-8');
        const lines = csv.split('\n').filter(l => l.trim());
        const equipment = [];
        lines.forEach((line, idx) => {
            if (idx === 0 && line.toLowerCase().includes('участок')) return;
            const inner = line.startsWith('"') && line.endsWith('"') ? line.slice(1, -1) : line;
            const parts = [];
            let cur = '', inField = false;
            for (let i = 0; i < inner.length; i++) {
                const c = inner[i];
                if (c === '"') {
                    if (i + 1 < inner.length && inner[i + 1] === '"') { inField = !inField; i++; }
                } else if (c === ';' && !inField) { parts.push(cur.trim()); cur = ''; }
                else { cur += c; }
            }
            parts.push(cur.trim());
            if (parts.length >= 3) {
                equipment.push({
                    location: parts[0] || '',
                    invNumber: parts[1] || '',
                    name: parts[2] || '',
                    model: parts.length > 3 && parts[3] ? parts[3] : '-',
                    machineNumber: parts.length > 4 && parts[4] ? parts[4] : '-'
                });
            }
        });
        return sendJSON(res, 200, equipment);
    }

    // Static files
    serveStatic(res, url.pathname);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер запущен:`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`  http://<ваш-ip>:${PORT} (с других устройств)`);
    console.log(`Данные сохраняются в ${DATA_FILE}`);
});
