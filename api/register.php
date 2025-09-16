<?php
declare(strict_types=1);
require __DIR__ . '/utils.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed'], 405);
}

$input = json_decode(file_get_contents('php://input') ?: '[]', true);
$firstName = trim((string)($input['firstName'] ?? ''));
$lastName  = trim((string)($input['lastName'] ?? ''));
$company   = trim((string)($input['company'] ?? ''));
$email     = trim((string)($input['email'] ?? ''));
$password  = (string)($input['password'] ?? '');
$optin     = (bool)($input['optin'] ?? false);

if ($firstName === '' || $lastName === '' || $email === '' || $password === '') {
    json_response(['error' => 'Missing required fields'], 400);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(['error' => 'Invalid email'], 400);
}

$registrations = db_read('registrations.json');
foreach ($registrations as $r) {
    if (strcasecmp($r['email'] ?? '', $email) === 0) {
        json_response(['error' => 'Email already registered'], 409);
    }
}

$id = uuid();
$record = [
    'id' => $id,
    'firstName' => $firstName,
    'lastName' => $lastName,
    'company' => $company,
    'email' => $email,
    // NOTE: For demo only — do not store plain text passwords in production
    // In real deployment, hash with password_hash($password, PASSWORD_DEFAULT)
    'passwordHash' => password_hash($password, PASSWORD_DEFAULT),
    'optin' => $optin,
    'attended' => false,
    'downloadCount' => 0,
    'emailOpenCount' => 0,
    'createdAt' => now_iso(),
];
$registrations[] = $record;
db_write('registrations.json', $registrations);

json_response($record, 201);