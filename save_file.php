<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Get POST data
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data || !isset($data['fileName']) || !isset($data['content'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing fileName or content']);
    exit;
}

$fileName = $data['fileName'];
$content = $data['content'];

// Sanitize filename
$fileName = preg_replace('/[^a-zA-Z0-9_\-]/', '', $fileName);
if (empty($fileName)) {
    $fileName = 'newsletter_' . date('Y-m-d_H-i-s');
}

// Ensure .html extension
if (!str_ends_with($fileName, '.html')) {
    $fileName .= '.html';
}

// Define the target directory
$targetDir = 'C:\\Newsletter\\';

// Create directory if it doesn't exist
if (!is_dir($targetDir)) {
    if (!mkdir($targetDir, 0777, true)) {
        http_response_code(500);
        echo json_encode(['error' => 'Could not create directory']);
        exit;
    }
}

// Full file path
$filePath = $targetDir . $fileName;

// Save the file
if (file_put_contents($filePath, $content) !== false) {
    echo json_encode([
        'success' => true,
        'message' => 'File saved successfully',
        'fileName' => $fileName,
        'filePath' => $filePath
    ]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Could not save file']);
}
?>
