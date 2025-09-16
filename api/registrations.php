<?php
declare(strict_types=1);
require __DIR__ . '/utils.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['error' => 'Method not allowed'], 405);
}

$registrations = db_read('registrations.json');

// Optional filtering: ?attended=true|false
if (isset($_GET['attended'])) {
    $val = strtolower((string)$_GET['attended']);
    if ($val === 'true' || $val === 'false') {
        $flag = $val === 'true';
        $registrations = array_values(array_filter($registrations, function ($r) use ($flag) {
            return (bool)($r['attended'] ?? false) === $flag;
        }));
    }
}

json_response($registrations);