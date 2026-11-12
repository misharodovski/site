<?php
/**
 * ИСТАЯ КУЗНИЦА — обработчик формы заявки.
 * Требуется PHP 7.2+ (на Timeweb есть по умолчанию).
 * Настройки (почта, Telegram) — в файле send-config.php. Этот файл менять не нужно.
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function respond($ok, $error = '', $code = 200) {
    http_response_code($code);
    echo json_encode($ok ? ['ok' => true] : ['ok' => false, 'error' => $error], JSON_UNESCAPED_UNICODE);
    exit;
}

$cfgFile = __DIR__ . '/send-config.php';
if (!is_file($cfgFile)) respond(false, 'Форма временно не настроена. Пожалуйста, позвоните нам.', 500);
$CFG = require $cfgFile;

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') respond(false, 'Метод не поддерживается.', 405);

function field($key, $max) {
    $v = isset($_POST[$key]) ? (string)$_POST[$key] : '';
    $v = trim(strip_tags($v));
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v);
    return function_exists('mb_substr') ? mb_substr($v, 0, $max, 'UTF-8') : substr($v, 0, $max);
}
function len($s) { return function_exists('mb_strlen') ? mb_strlen($s, 'UTF-8') : strlen($s); }

/* ---------- антиспам ---------- */
if (!empty($_POST['website'])) respond(true);                 // honeypot: бот — делаем вид, что всё хорошо
$ts = (int)($_POST['ts'] ?? 0);
if ($ts > 0 && (time() - $ts) < (int)$CFG['min_fill_seconds']) respond(true);

$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$rateFile = rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'ik_rate_' . md5($ip);
if (is_file($rateFile) && (time() - (int)@file_get_contents($rateFile)) < (int)$CFG['rate_limit_seconds']) {
    respond(false, 'Заявка уже отправлена. Подождите немного перед повторной отправкой.', 429);
}

/* ---------- данные ---------- */
$name    = field('name', 80);
$phone   = field('phone', 24);
$type    = field('type', 80);
$city    = field('city', 80);
$message = field('message', 2000);
$agree   = !empty($_POST['agree']);

$digits = preg_replace('/\D/', '', $phone);
if (len($name) < 2) respond(false, 'Укажите, пожалуйста, имя.', 422);
if (strlen($digits) < 11 || strlen($digits) > 15) respond(false, 'Проверьте номер телефона.', 422);
if (!$agree) respond(false, 'Необходимо согласие на обработку персональных данных.', 422);

$date = date('d.m.Y H:i');
$site = $CFG['site_name'];
$lines = [
    "🔥 Новая заявка с сайта «{$site}»",
    '',
    "Имя: {$name}",
    "Телефон: {$phone}",
    "Что нужно: " . ($type !== '' ? $type : '—'),
    "Город: " . ($city !== '' ? $city : '—'),
    '',
    "Комментарий:",
    ($message !== '' ? $message : '—'),
    '',
    "Дата: {$date}",
];
$text = implode("\n", $lines);

/* ---------- HTTP POST (для Telegram) ---------- */
function http_post($url, $fields, $timeout = 8) {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true, CURLOPT_POSTFIELDS => http_build_query($fields),
            CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => $timeout,
        ]);
        $out = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return [$code, $out];
    }
    $ctx = stream_context_create(['http' => [
        'method' => 'POST', 'timeout' => $timeout, 'ignore_errors' => true,
        'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
        'content' => http_build_query($fields),
    ]]);
    $out = @file_get_contents($url, false, $ctx);
    $code = 0;
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) $code = (int)$m[1];
    return [$code, $out];
}

/* ---------- HTTP POST с JSON и заголовками (для MAX) ---------- */
function http_post_json($url, $data, $headers, $timeout = 8) {
    $body = json_encode($data, JSON_UNESCAPED_UNICODE);
    $headers[] = 'Content-Type: application/json';
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => $timeout,
        ]);
        $out = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        return [$code, $out === false ? $err : $out];
    }
    $ctx = stream_context_create(['http' => [
        'method' => 'POST', 'timeout' => $timeout, 'ignore_errors' => true,
        'header' => implode("\r\n", $headers) . "\r\n", 'content' => $body,
    ]]);
    $out = @file_get_contents($url, false, $ctx);
    $code = 0;
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) $code = (int)$m[1];
    return [$code, $out];
}

/* отправка сообщения ботом MAX (dev.max.ru: POST /messages, токен в заголовке Authorization) */
function max_send($c, $param, $id, $text) {
    $hosts = [rtrim($c['api'], '/')];
    if (strpos($c['api'], 'platform-api.max.ru') !== false) $hosts[] = 'https://platform-api2.max.ru'; // запасной адрес
    $last = [0, ''];
    foreach ($hosts as $h) {
        $last = http_post_json($h . '/messages?' . $param . '=' . rawurlencode(trim($id)) . '&disable_link_preview=true',
            ['text' => $text], ['Authorization: ' . $c['token']]);
        if ($last[0] >= 200 && $last[0] < 300) return $last;
        if ($last[0] >= 400) break; // ошибка в токене/ID — второй адрес не поможет
    }
    return $last;
}

/* ---------- минимальный SMTP-клиент (SSL/TLS + AUTH LOGIN) ---------- */
function smtp_send($c, $subject, $body, &$err) {
    $host = $c['host']; $port = (int)$c['port']; $secure = $c['secure'];
    $remote = ($secure === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port;
    $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'SNI_enabled' => true, 'peer_name' => $host]]);
    $fp = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) { $err = "connect: $errstr"; return false; }
    stream_set_timeout($fp, 15);

    $read = function () use ($fp) {
        $data = '';
        while (($line = fgets($fp, 515)) !== false) {
            $data .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') break;
        }
        return $data;
    };
    $cmd = function ($line, $expect) use ($fp, $read, &$err) {
        if ($line !== null) fwrite($fp, $line . "\r\n");
        $resp = $read();
        if ((int)substr($resp, 0, 3) !== $expect) { $err = trim($resp); return false; }
        return true;
    };
    $ehlo = 'EHLO ' . preg_replace('/[^a-z0-9\.\-]/i', '', $_SERVER['SERVER_NAME'] ?? 'localhost');

    $ok = $cmd(null, 220) && $cmd($ehlo, 250);
    if ($ok && $secure === 'tls') {
        $ok = $cmd('STARTTLS', 220)
            && stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)
            && $cmd($ehlo, 250);
    }
    $ok = $ok && $cmd('AUTH LOGIN', 334) && $cmd(base64_encode($c['user']), 334) && $cmd(base64_encode($c['pass']), 235);
    $ok = $ok && $cmd('MAIL FROM:<' . $c['from'] . '>', 250);
    foreach ((array)$c['to'] as $to) { $ok = $ok && $cmd('RCPT TO:<' . trim($to) . '>', 250); }
    if ($ok && $cmd('DATA', 354)) {
        $headers = [
            'Date: ' . date('r'),
            'From: =?UTF-8?B?' . base64_encode($GLOBALS['site']) . '?= <' . $c['from'] . '>',
            'To: ' . implode(', ', array_map('trim', (array)$c['to'])),
            'Subject: =?UTF-8?B?' . base64_encode($subject) . '?=',
            'Message-ID: <' . bin2hex(random_bytes(8)) . '@' . substr(strrchr($c['from'], '@'), 1) . '>',
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
        ];
        $data = implode("\r\n", $headers) . "\r\n\r\n" . chunk_split(base64_encode($body), 76, "\r\n");
        fwrite($fp, $data . "\r\n.\r\n");
        $ok = $cmd(null, 250);
    } else { $ok = false; }
    @fwrite($fp, "QUIT\r\n");
    fclose($fp);
    return $ok;
}

$delivered = [];
$errors = [];

/* ---------- Telegram ---------- */
$tg = $CFG['telegram'];
if (!empty($tg['enabled']) && $tg['token'] !== '' && $tg['chat_id'] !== '') {
    foreach (explode(',', $tg['chat_id']) as $chat) {
        list($code, $out) = http_post('https://api.telegram.org/bot' . $tg['token'] . '/sendMessage', [
            'chat_id' => trim($chat), 'text' => $text, 'disable_web_page_preview' => 'true',
        ]);
        if ($code === 200) $delivered[] = 'tg'; else $errors[] = "tg:$code";
    }
}

/* ---------- MAX ---------- */
$mx = $CFG['max'] ?? [];
if (!empty($mx['enabled']) && ($mx['token'] ?? '') !== '') {
    $targets = [];
    foreach (array_filter(explode(',', (string)($mx['user_id'] ?? ''))) as $u) $targets[] = ['user_id', $u];
    foreach (array_filter(explode(',', (string)($mx['chat_id'] ?? ''))) as $c) $targets[] = ['chat_id', $c];
    foreach ($targets as $t) {
        list($code, $out) = max_send($mx, $t[0], $t[1], $text);
        if ($code >= 200 && $code < 300) $delivered[] = 'max';
        else $errors[] = "max:$code " . substr((string)$out, 0, 120);
    }
}

/* ---------- почта ---------- */
$smtp = $CFG['smtp'];
if (!empty($smtp['enabled']) && $smtp['pass'] !== '') {
    $err = '';
    if (smtp_send($smtp, "Заявка с сайта: {$name}, {$phone}", $text . "\n\nIP: {$ip}", $err)) $delivered[] = 'mail';
    else $errors[] = 'mail:' . $err;
}

/* ---------- резервная копия в CSV ---------- */
$saved = false;
if (!empty($CFG['save_csv'])) {
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) @mkdir($dir, 0750, true);
    if (!is_file($dir . '/.htaccess')) @file_put_contents($dir . '/.htaccess', "Require all denied\nDeny from all\n");
    $file = $dir . '/leads.csv';
    $isNew = !is_file($file) || filesize($file) === 0;
    $fh = @fopen($file, 'ab');
    if ($fh) {
        if ($isNew) { fwrite($fh, "\xEF\xBB\xBF"); fputcsv($fh, ['Дата', 'Имя', 'Телефон', 'Что нужно', 'Город', 'Комментарий', 'IP', 'Доставка'], ';'); }
        fputcsv($fh, [$date, $name, $phone, $type, $city, str_replace(["\r", "\n"], ' ', $message), $ip,
            $delivered ? implode('+', $delivered) : ('НЕ ДОСТАВЛЕНО ' . implode(' ', $errors))], ';');
        fclose($fh);
        $saved = true;
    }
}
if ($errors) @error_log('[ik-form] ' . implode(' | ', $errors));

if ($delivered || $saved) {
    @file_put_contents($rateFile, (string)time());
    respond(true);
}
respond(false, 'Не удалось отправить заявку. Пожалуйста, позвоните нам.', 500);
