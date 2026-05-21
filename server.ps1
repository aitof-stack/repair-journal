$port = 8080
$root = Split-Path -Parent $PSCommandPath
$dataDir = Join-Path $root "server-data"
$dataFile = Join-Path $dataDir "requests.json"
if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir -Force | Out-Null }
if (-not (Test-Path $dataFile)) { Set-Content -Path $dataFile -Value '[]' -Encoding UTF8 }

$mime = @{
    '.html' = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.csv'  = 'text/csv; charset=utf-8'
    '.png'  = 'image/png'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
}

try {
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$port/")
    $listener.Start()
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Server started!" -ForegroundColor Green
    Write-Host "  Open: http://localhost:$port" -ForegroundColor Cyan
    Write-Host "  Press Ctrl+C to stop" -ForegroundColor Gray
    Write-Host "========================================" -ForegroundColor Green

    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $req = $ctx.Request
        $res = $ctx.Response
        $path = $req.Url.AbsolutePath

        $res.Headers.Add('Access-Control-Allow-Origin', '*')
        $res.Headers.Add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        $res.Headers.Add('Access-Control-Allow-Headers', 'Content-Type')

        if ($req.HttpMethod -eq 'OPTIONS') {
            $res.StatusCode = 204
            $res.Close()
            continue
        }

        try {
            if ($path -eq '/api/requests' -and $req.HttpMethod -eq 'GET') {
                $data = Get-Content $dataFile -Encoding UTF8 -Raw
                $buffer = [Text.Encoding]::UTF8.GetBytes($data)
                $res.ContentType = 'application/json; charset=utf-8'
                $res.OutputStream.Write($buffer, 0, $buffer.Length)
                $res.Close()
                continue
            }

            if ($path -eq '/api/requests' -and $req.HttpMethod -eq 'PUT') {
                $reader = New-Object System.IO.StreamReader($req.InputStream)
                $body = $reader.ReadToEnd()
                $reader.Close()
                Set-Content $dataFile $body -Encoding UTF8
                $buffer = [Text.Encoding]::UTF8.GetBytes('{"ok":true}')
                $res.ContentType = 'application/json; charset=utf-8'
                $res.OutputStream.Write($buffer, 0, $buffer.Length)
                $res.Close()
                continue
            }

            if ($path -eq '/api/requests' -and $req.HttpMethod -eq 'POST') {
                $reader = New-Object System.IO.StreamReader($req.InputStream)
                $body = $reader.ReadToEnd()
                $reader.Close()
                $data = Get-Content $dataFile -Encoding UTF8 -Raw | ConvertFrom-Json
                $newItem = $body | ConvertFrom-Json
                $newItem | Add-Member -NotePropertyName 'id' -NotePropertyValue ([DateTime]::Now.Ticks.ToString())
                $data = @($newItem) + $data
                $data | ConvertTo-Json -Depth 10 | Set-Content $dataFile -Encoding UTF8
                $buffer = [Text.Encoding]::UTF8.GetBytes(($newItem | ConvertTo-Json -Depth 10))
                $res.ContentType = 'application/json; charset=utf-8'
                $res.OutputStream.Write($buffer, 0, $buffer.Length)
                $res.Close()
                continue
            }

            if ($path -match '^/api/requests/(.+)$') {
                $id = $matches[1]
                if ($req.HttpMethod -eq 'DELETE') {
                    $data = Get-Content $dataFile -Encoding UTF8 -Raw | ConvertFrom-Json
                    $newData = $data | Where-Object { $_.id -ne $id }
                    $newData | ConvertTo-Json -Depth 10 | Set-Content $dataFile -Encoding UTF8
                    $buffer = [Text.Encoding]::UTF8.GetBytes('{"ok":true}')
                    $res.ContentType = 'application/json; charset=utf-8'
                    $res.OutputStream.Write($buffer, 0, $buffer.Length)
                    $res.Close()
                    continue
                }
            }

            if ($path -eq '/api/equipment' -and $req.HttpMethod -eq 'GET') {
                $csvPath = Join-Path $root 'equipment_database.csv'
                $equipment = @()
                if (Test-Path $csvPath) {
                    $csv = Get-Content $csvPath -Encoding UTF8
                    for ($i = 0; $i -lt $csv.Length; $i++) {
                        $line = $csv[$i].Trim()
                        if (-not $line) { continue }
                        if ($i -eq 0 -and $line.ToLower().Contains([char]1091 + [char]1095 + [char]1072 + [char]1089 + [char]1090 + [char]1086 + [char]1082)) { continue }
                        if ($line.StartsWith('"') -and $line.EndsWith('"')) { $line = $line.Substring(1, $line.Length-2) }
                        $parts = @()
                        $cur = ''
                        $inField = $false
                        for ($j = 0; $j -lt $line.Length; $j++) {
                            $c = $line[$j]
                            if ($c -eq '"') {
                                if ($j + 1 -lt $line.Length -and $line[$j+1] -eq '"') { $inField = -not $inField; $j++ }
                            } elseif ($c -eq ';' -and -not $inField) { $parts += $cur.Trim(); $cur = '' }
                            else { $cur += $c }
                        }
                        $parts += $cur.Trim()
                        if ($parts.Length -ge 3) {
                            $equipment += [PSCustomObject]@{
                                location      = $parts[0]
                                invNumber     = $parts[1]
                                name          = $parts[2]
                                model         = if ($parts.Length -gt 3 -and $parts[3]) { $parts[3] } else { '-' }
                                machineNumber = if ($parts.Length -gt 4 -and $parts[4]) { $parts[4] } else { '-' }
                            }
                        }
                    }
                }
                $json = $equipment | ConvertTo-Json -Depth 5
                $buffer = [Text.Encoding]::UTF8.GetBytes($json)
                $res.ContentType = 'application/json; charset=utf-8'
                $res.OutputStream.Write($buffer, 0, $buffer.Length)
                $res.Close()
                continue
            }

            if ($path -eq '/') { $filePath = Join-Path $root 'index.html' }
            else { $filePath = Join-Path $root $path.TrimStart('/') }

            if (Test-Path $filePath -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $contentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
                $data = [System.IO.File]::ReadAllBytes($filePath)
                $res.ContentType = $contentType
                $res.Headers.Add('Cache-Control', 'no-cache')
                $res.OutputStream.Write($data, 0, $data.Length)
            } else {
                $res.StatusCode = 404
                $buffer = [Text.Encoding]::UTF8.GetBytes('404 Not Found')
                $res.OutputStream.Write($buffer, 0, $buffer.Length)
            }
        } catch {
            $res.StatusCode = 500
            $buffer = [Text.Encoding]::UTF8.GetBytes("Error: $_")
            $res.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        $res.Close()
    }
} finally {
    if ($listener -and $listener.IsListening) {
        $listener.Stop()
    }
}
