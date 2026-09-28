<?php
/**
 * Истая Кузница — обработчик формы «Обсудить проект».
 * Работает на любом хостинге с PHP 7.2+ и функцией mail().
 *
 * НАСТРОЙКА: укажите свой e-mail в $TO ниже.
 */

// ================== НАСТРОЙКИ ==================
$TO        = 'info@istaya-kuznica.ru';   // куда приходят заявки (можно несколько через запятую)
$SITE_NAME = 'Истая Кузница';
$SAVE_LOG  = true;                        // дублировать заявки в data/leads.csv (папка закрыта от доступа извне)
$MIN_FILL_SECONDS = 3;                    // защита от ботов: форма не может быть заполнена быстрее
$RATE_LIMIT_SECONDS = 30;                 // не чаще одной заявки с одного IP за N секунд

// Яндекс SmartCaptcha: «Ключ сервера» из console.yandex.cloud → SmartCaptcha.
// Пусто — проверка капчи выключена (ключ клиента тогда тоже оставьте пустым в js/config.js).
$SMARTCAPTCHA_SECRET = '';

// Уведомления о заявках в Telegram (необязательно):
// 1) создайте бота у @BotFather и вставьте токен; 2) напишите боту /start;
// 3) узнайте chat_id (например, через @userinfobot) и вставьте ниже.
$TG_BOT_TOKEN = '';
$TG_CHAT_ID   = '';
// ===============================================

/** Простой POST-запрос: cURL, если есть, иначе file_get_contents */
function http_post($url, $fields, $timeout = 5) {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true, CURLOPT_POSTFIELDS => http_build_query($fields),
            CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => $timeout,
        ]);
        $out = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return [$code, $out];
    }
    $ctx = stream_context_create(['http' => [
        'method' => 'POST', 'timeout' => $timeout, 'ignore_errors' => true,
        'header' => "Content-Type: application/x-www-form-urlencoded
",
        'content' => http_build_query($fields),
    ]]);
    $out = @file_get_contents($url, false, $ctx);
    $code = 0;
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) $code = (int)$m[1];
    return [$code, $out];
}

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function respond($ok, $error = '', $code = 200) {
    http_response_code($code);
    echo json_encode($ok ? ['ok' => true] : ['ok' => false, 'error' => $error], JSON_UNESCAPED_UNICODE);
    exit;
}

function field($key, $max) {
    $v = isset($_POST[$key]) ? (string)$_POST[$key] : '';
    $v = trim(strip_tags($v));
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v);
    if (function_exists('mb_substr')) $v = mb_substr($v, 0, $max, 'UTF-8'); else $v = substr($v, 0, $max);
    return $v;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'Метод не поддерживается.', 405);
}

// --- Антиспам: honeypot и время заполнения ---
if (!empty($_POST['website'])) {
    respond(true); // бот — делаем вид, что всё хорошо
}
$ts = isset($_POST['ts']) ? (int)$_POST['ts'] : 0;
if ($ts > 0 && (time() - $ts) < $MIN_FILL_SECONDS) {
    respond(true);
}

// --- Ограничение частоты по IP ---
$ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0.0.0.0';
$rateFile = rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'ik_rate_' . md5($ip);
if (is_file($rateFile) && (time() - (int)@file_get_contents($rateFile)) < $RATE_LIMIT_SECONDS) {
    respond(false, 'Заявка уже отправлена. Пожалуйста, подождите немного перед повторной отправкой.', 429);
}

// --- Яндекс SmartCaptcha ---
if ($SMARTCAPTCHA_SECRET !== '') {
    $token = isset($_POST['smart-token']) ? (string)$_POST['smart-token'] : '';
    if ($token === '') respond(false, 'Подтвердите, что вы не робот, и отправьте заявку ещё раз.', 422);
    list($code, $out) = http_post('https://smartcaptcha.yandexcloud.net/validate', [
        'secret' => $SMARTCAPTCHA_SECRET, 'token' => $token, 'ip' => $ip,
    ]);
    // Если сервис капчи недоступен (код не 200) — не теряем заявку, пропускаем
    if ($code === 200) {
        $res = json_decode($out, true);
        if (!is_array($res) || !isset($res['status']) || $res['status'] !== 'ok') {
            respond(false, 'Проверка «я не робот» не пройдена. Обновите страницу и попробуйте ещё раз.', 422);
        }
    }
}

// --- Данные ---
$name    = field('name', 80);
$phone   = field('phone', 20);
$email   = field('email', 120);
$type    = field('type', 60);
$message = field('message', 2000);
$agree   = !empty($_POST['agree']);

$digits = preg_replace('/\D/', '', $phone);
if (function_exists('mb_strlen') ? mb_strlen($name, 'UTF-8') < 2 : strlen($name) < 2) respond(false, 'Укажите, пожалуйста, имя.', 422);
if (strlen($digits) !== 11)  respond(false, 'Проверьте номер телефона.', 422);
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) respond(false, 'Проверьте адрес e-mail.', 422);
if (!$agree) respond(false, 'Необходимо согласие на обработку персональных данных.', 422);

// --- Письмо ---
$host = isset($_SERVER['HTTP_HOST']) ? preg_replace('/[^a-z0-9\.\-]/i', '', $_SERVER['HTTP_HOST']) : 'localhost';
$host = preg_replace('/^www\./i', '', $host);
$date = date('d.m.Y H:i');

$lines = [
    "Новая заявка с сайта {$SITE_NAME}",
    str_repeat('—', 32),
    "Имя:       {$name}",
    "Телефон:   {$phone}",
    "E-mail:    " . ($email !== '' ? $email : '—'),
    "Что нужно: " . ($type !== '' ? $type : '—'),
    '',
    "Сообщение:",
    ($message !== '' ? $message : '—'),
    '',
    str_repeat('—', 32),
    "Дата: {$date}",
    "IP:   {$ip}",
    "Согласие на обработку ПДн: получено",
];
$bodyText = implode("\r\n", $lines);

$subject = '=?UTF-8?B?' . base64_encode("Заявка с сайта: {$name}, {$phone}") . '?=';
$fromName = '=?UTF-8?B?' . base64_encode($SITE_NAME) . '?=';
$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    "From: {$fromName} <noreply@{$host}>",
    'X-Mailer: PHP/' . phpversion(),
];
if ($email !== '') {
    $headers[] = 'Reply-To: ' . $email;
}

$sent = @mail($TO, $subject, $bodyText, implode("\r\n", $headers), "-fnoreply@{$host}");
if (!$sent) {
    // некоторые хостинги не разрешают параметр -f
    $sent = @mail($TO, $subject, $bodyText, implode("\r\n", $headers));
}

// --- Telegram ---
$tgSent = false;
if ($TG_BOT_TOKEN !== '' && $TG_CHAT_ID !== '') {
    list($code, ) = http_post('https://api.telegram.org/bot' . $TG_BOT_TOKEN . '/sendMessage', [
        'chat_id' => $TG_CHAT_ID,
        'text' => $bodyText,
        'disable_web_page_preview' => 'true',
    ]);
    $tgSent = ($code === 200);
}
$sent = $sent || $tgSent;

// --- Резервная копия заявки ---
$saved = false;
if ($SAVE_LOG) {
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) @mkdir($dir, 0750, true);
    if (!is_file($dir . '/.htaccess')) @file_put_contents($dir . '/.htaccess', "Require all denied\nDeny from all\n");
    $row = [$date, $name, $phone, $email, $type, str_replace(["\r", "\n"], ' ', $message), $ip, $sent ? 'mail:ok' : 'mail:fail'];
    $fh = @fopen($dir . '/leads.csv', 'ab');
    if ($fh) {
        if (@filesize($dir . '/leads.csv') === 0) fwrite($fh, "\xEF\xBB\xBF");
        fputcsv($fh, $row, ';');
        fclose($fh);
        $saved = true;
    }
}

if ($sent || $saved) {
    @file_put_contents($rateFile, (string)time());
    respond(true);
}

respond(false, 'Не удалось отправить заявку. Пожалуйста, позвоните нам или напишите на почту.', 500);
