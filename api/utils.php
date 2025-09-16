<?php
// Common helpers for the PHP API

declare(strict_types=1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function json_response($data, int $status = 200): void {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function db_path(string $name): string {
    $base = realpath(__DIR__ . '/../data');
    if ($base === false) {
        mkdir(__DIR__ . '/../data', 0777, true);
        $base = realpath(__DIR__ . '/../data');
    }
    return $base . DIRECTORY_SEPARATOR . $name;
}

function db_read(string $file): array {
    $path = db_path($file);
    if (!file_exists($path)) {
        file_put_contents($path, json_encode([], JSON_PRETTY_PRINT));
    }
    $raw = file_get_contents($path);
    $json = json_decode($raw ?: '[]', true);
    return is_array($json) ? $json : [];
}

function db_write(string $file, array $data): void {
    $path = db_path($file);
    file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}

function uuid(): string {
    return bin2hex(random_bytes(8));
}

function now_iso(): string {
    return gmdate('c');
}