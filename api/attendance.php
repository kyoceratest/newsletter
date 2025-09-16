<?php
declare(strict_types=1);
require __DIR__ . '/utils.php';

if ($_SERVER['REQUEST_METHOD'] !== 'PATCH' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed'], 405);
}

$input = json_decode(file_get_contents('php://input') ?: '[]', true);
$id = (string)($input['id'] ?? '');
$attended = isset($input['attended']) ? (bool)$input['attended'] : null;

if ($id === '' || $attended === null) {
    json_response(['error' => 'id and attended (boolean) are required'], 400);
}

$registrations = db_read('registrations.json');
$found = false;
foreach ($registrations as &$r) {
    if (($r['id'] ?? '') === $id) {
        $r['attended'] = $attended;
        $r['attendedAt'] = $attended ? now_iso() : null;
        $found = true;
        break;
    }
}
unset($r);

if (!$found) {
    json_response(['error' => 'Not found'], 404);
}

db_write('registrations.json', $registrations);
json_response(['ok' => true]);