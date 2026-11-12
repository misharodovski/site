<?php
/**
 * ИСТАЯ КУЗНИЦА — помощник настройки MAX.
 * Показывает ID пользователей и чатов, которые недавно писали вашему боту.
 * Работает, только пока в send-config.php стоит 'setup' => true. После настройки верните false.
 */
header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex');
header('Cache-Control: no-store');

$CFG = is_file(__DIR__ . '/send-config.php') ? require __DIR__ . '/send-config.php' : [];
$mx = $CFG['max'] ?? [];

function page($html) {
    echo '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Настройка MAX</title>'
       . '<body style="font:16px/1.6 system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;background:#0e0c0b;color:#efe8df">'
       . '<h1 style="font-family:Georgia,serif">Настройка MAX</h1>' . $html . '</body>';
    exit;
}
function h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

if (empty($mx['setup'])) { http_response_code(404); page('<p>Страница отключена. Чтобы включить, поставьте <code>\'setup\' =&gt; true</code> в send-config.php.</p>'); }
if (($mx['token'] ?? '') === '') page('<p>Сначала вставьте токен бота в <code>send-config.php</code> → блок <code>max</code> → <code>token</code>.</p>');

function max_get($path, $token, $api) {
    $hosts = [rtrim($api, '/')];
    if (strpos($api, 'platform-api.max.ru') !== false) $hosts[] = 'https://platform-api2.max.ru';
    $res = [0, ''];
    foreach ($hosts as $h) {
        if (function_exists('curl_init')) {
            $ch = curl_init($h . $path);
            curl_setopt_array($ch, [CURLOPT_HTTPHEADER => ['Authorization: ' . $token], CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
            $out = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch); curl_close($ch);
            $res = [$code, $out === false ? $err : $out];
        } else {
            $ctx = stream_context_create(['http' => ['header' => 'Authorization: ' . $token . "\r\n", 'timeout' => 10, 'ignore_errors' => true]]);
            $out = @file_get_contents($h . $path, false, $ctx); $code = 0;
            if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) $code = (int)$m[1];
            $res = [$code, $out];
        }
        if ($res[0] === 200 || $res[0] >= 400) break;
    }
    return $res;
}

$api = $mx['api'] ?? 'https://platform-api.max.ru';
list($c1, $me) = max_get('/me', $mx['token'], $api);
if ($c1 !== 200) page('<p style="color:#ff7b6b">Не удалось подключиться к MAX (код ' . h($c1) . '). Проверьте токен.</p><pre style="white-space:pre-wrap;color:#a89e93">' . h(substr((string)$me, 0, 500)) . '</pre>');
$bot = json_decode($me, true);

list($c2, $up) = max_get('/updates?limit=100&timeout=0', $mx['token'], $api);
$data = json_decode((string)$up, true);
$rows = [];
foreach (($data['updates'] ?? []) as $u) {
    $m = $u['message'] ?? null;
    if (!$m) continue;
    $s = $m['sender'] ?? [];
    $r = $m['recipient'] ?? [];
    $key = ($s['user_id'] ?? '') . '|' . ($r['chat_id'] ?? '');
    $rows[$key] = [
        'name' => trim(($s['first_name'] ?? '') . ' ' . ($s['last_name'] ?? '')) ?: ($s['name'] ?? '—'),
        'user_id' => $s['user_id'] ?? '—',
        'chat_id' => $r['chat_id'] ?? '—',
        'type' => $r['chat_type'] ?? '',
        'text' => $m['body']['text'] ?? '',
    ];
}

$html = '<p>Бот: <b>' . h($bot['name'] ?? $bot['first_name'] ?? '—') . '</b> — токен работает ✅</p>';
if (!$rows) {
    $html .= '<p>Сообщений пока нет. Откройте бота в приложении MAX, напишите ему «привет» и обновите эту страницу.</p>';
} else {
    $html .= '<p>Кто писал боту:</p><table style="border-collapse:collapse;width:100%">'
           . '<tr><th align=left>Имя</th><th align=left>user_id</th><th align=left>chat_id</th><th align=left>Текст</th></tr>';
    foreach ($rows as $r) {
        $html .= '<tr style="border-top:1px solid #333"><td>' . h($r['name']) . '</td><td><b style="color:#ffb25b">' . h($r['user_id'])
               . '</b></td><td>' . h($r['chat_id']) . ' ' . h($r['type']) . '</td><td>' . h(mb_substr($r['text'], 0, 40)) . '</td></tr>';
    }
    $html .= '</table><p>Скопируйте свой <b>user_id</b> в <code>send-config.php</code> → <code>max</code> → <code>user_id</code>, '
           . 'поставьте <code>\'enabled\' =&gt; true</code> и <b>верните <code>\'setup\' =&gt; false</code></b>.</p>'
           . '<p>Для группового чата (если бот добавлен в группу) используйте <b>chat_id</b> группы в поле <code>chat_id</code>.</p>';
}
page($html);
