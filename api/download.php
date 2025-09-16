<?php
declare(strict_types=1);
require __DIR__ . '/utils.php';

// Example: /api/download.php?file=Tarif/Tarif_newsletter/public_materiel.pdf&id=<registrationId>

$file = isset($_GET['file']) ? (string)$_GET['file'] : '';
$id   = isset($_GET['id']) ? (string)$_GET['id'] : '';

if ($file === '') {
    json_response(['error' => 'file parameter required'], 400);
}

$fullPath = realpath(__DIR__ . '/../' . $file);
$repoRoot = realpath(__DIR__ . '/..');
if ($fullPath === false || strpos($fullPath, $repoRoot) !== 0 || !is_file($fullPath)) {
    json_response(['error' => 'Invalid file path'], 400);
}

if ($id !== '') {
    $registrations = db_read('registrations.json');
    foreach ($registrations as &$r) {
        if (($r['id'] ?? '') === $id) {
            $r['downloadCount'] = (int)($r['downloadCount'] ?? 0) + 1;
            $r['lastDownloadAt'] = now_iso();
            break;
        }
    }
    unset($r);
    db_write('registrations.json', $registrations);
}

// Stream download
$filename = basename($fullPath);
header('Content-Description: File Transfer');
header('Content-Type: application/octet-stream');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . filesize($fullPath));
readfile($fullPath);
exit;