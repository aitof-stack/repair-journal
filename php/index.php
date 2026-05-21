<?php
$root = dirname(__DIR__);
$dataDir = $root . DIRECTORY_SEPARATOR . 'server-data';
$dataFile = $dataDir . DIRECTORY_SEPARATOR . 'requests.json';

if (!is_dir($dataDir)) mkdir($dataDir, 0777, true);
if (!file_exists($dataFile)) file_put_contents($dataFile, '[]');

// CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

try {
    // === API: GET /api/requests ===
    if ($path === '/api/requests') {
        if ($method === 'GET') {
            header('Content-Type: application/json; charset=utf-8');
            readfile($dataFile);
            exit;
        }
        if ($method === 'PUT') {
            $body = file_get_contents('php://input');
            file_put_contents($dataFile, $body);
            echo '{"ok":true}';
            exit;
        }
        if ($method === 'POST') {
            $body = json_decode(file_get_contents('php://input'), true);
            $data = json_decode(file_get_contents($dataFile), true) ?: [];
            $body['id'] = (string) round(microtime(true) * 10000);
            array_unshift($data, $body);
            file_put_contents($dataFile, json_encode($data, JSON_UNESCAPED_UNICODE));
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode($body, JSON_UNESCAPED_UNICODE);
            exit;
        }
        http_response_code(405);
        exit;
    }

    // === API: DELETE /api/requests/{id} ===
    if (preg_match('#^/api/requests/(.+)$#', $path, $m)) {
        if ($method === 'DELETE') {
            $id = $m[1];
            $data = json_decode(file_get_contents($dataFile), true) ?: [];
            $data = array_values(array_filter($data, fn($r) => ($r['id'] ?? '') !== $id));
            file_put_contents($dataFile, json_encode($data, JSON_UNESCAPED_UNICODE));
            echo '{"ok":true}';
            exit;
        }
        http_response_code(405);
        exit;
    }

    // === API: GET /api/equipment ===
    if ($path === '/api/equipment' && $method === 'GET') {
        $csvPath = $root . DIRECTORY_SEPARATOR . 'equipment_database.csv';
        $equipment = [];
        if (file_exists($csvPath)) {
            $lines = file($csvPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $i => $line) {
                $line = trim($line);
                if ($line === '') continue;
                if ($i === 0 && mb_stripos($line, 'участок') !== false) continue;
                // Strip outer quotes if present
                if (strlen($line) > 1 && $line[0] === '"' && $line[-1] === '"') {
                    $line = substr($line, 1, -1);
                }
                $parts = str_getcsv($line, ';', '"');
                $parts = array_map('trim', $parts);
                if (count($parts) >= 3) {
                    $equipment[] = [
                        'location' => $parts[0],
                        'invNumber' => $parts[1],
                        'name' => $parts[2],
                        'model' => $parts[3] ?? '-',
                        'machineNumber' => $parts[4] ?? '-',
                    ];
                }
            }
        }
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($equipment, JSON_UNESCAPED_UNICODE);
        exit;
    }

    // === Static files ===
    $mime = [
        '.html' => 'text/html; charset=utf-8',
        '.css'  => 'text/css; charset=utf-8',
        '.js'   => 'application/javascript; charset=utf-8',
        '.json' => 'application/json; charset=utf-8',
        '.csv'  => 'text/csv; charset=utf-8',
        '.png'  => 'image/png',
        '.svg'  => 'image/svg+xml',
        '.ico'  => 'image/x-icon',
    ];

    $filePath = $path === '/' ? $root . DIRECTORY_SEPARATOR . 'index.html' : $root . str_replace('/', DIRECTORY_SEPARATOR, $path);

    if (file_exists($filePath) && is_file($filePath)) {
        $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
        if (isset($mime['.' . $ext])) {
            header('Content-Type: ' . $mime['.' . $ext]);
        }
        header('Cache-Control: no-cache');
        readfile($filePath);
        exit;
    }

    // SPA fallback
    $index = $root . DIRECTORY_SEPARATOR . 'index.html';
    if (file_exists($index)) {
        readfile($index);
        exit;
    }

    http_response_code(404);
    echo '404 Not Found';

} catch (Throwable $e) {
    http_response_code(500);
    echo 'Error: ' . $e->getMessage();
}
