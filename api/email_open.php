<?php
declare(strict_types=1);
require __DIR__ . '/utils.php';

// 1x1 transparent PNG tracker to count opens per registration by id
$registrations = db_read('registrations.json');
$id = isset($_GET['id']) ? (string)$_GET['id'] : '';

if ($id !== '') {
    foreach ($registrations as &$r) {
        if (($r['id'] ?? '') === $id) {
            $r['emailOpenCount'] = (int)($r['emailOpenCount'] ?? 0) + 1;
            $r['lastEmailOpenAt'] = now_iso();
            break;
        }
    }
    unset($r);
    db_write('registrations.json', $registrations);
}

// Output a 1x1 PNG
header('Content-Type: image/png');
header('Cache-Control: no-cache, no-store, must-revalidate');
// Tiny transparent PNG
$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAOq9qFsAAAAASUVORK5CYII=');
echo $png;