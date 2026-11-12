<#
  ИСТАЯ КУЗНИЦА — добавление фото работ на сайт.
  Запускается двойным щелчком по файлу «ДОБАВИТЬ ФОТО.cmd» в папке сайта.

  Что делает:
  1. Создаёт папку «_НОВЫЕ ФОТО» с подпапками по категориям сайта.
  2. Берёт фото из этих подпапок (JPG, PNG, BMP, GIF, TIFF), поворачивает по данным камеры,
     уменьшает до 1600 px (+ превью 640 px), убирает из файлов геолокацию и прочие метаданные.
  3. Добавляет фото в нужную категорию сайта (js/works.js).
     Новая подпапка с другим названием = новая категория на сайте.
  4. Обработанные оригиналы переносит в «_НОВЫЕ ФОТО\_готово».
  5. Собирает архив «_ОБНОВЛЕНИЕ ДЛЯ ХОСТИНГА.zip» — только новые и изменённые файлы.
#>
param([string]$Site = (Split-Path -Parent $PSScriptRoot), [switch]$Quiet)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$UTF8 = New-Object System.Text.UTF8Encoding $false
$InboxName = '_НОВЫЕ ФОТО'
$Inbox = Join-Path $Site $InboxName
$Done = Join-Path $Inbox '_готово'
$WorksJs = Join-Path $Site 'js\works.js'
$IndexHtml = Join-Path $Site 'index.html'
$HashFile = Join-Path $Site 'tools\added-photos.txt'
$UpdateZip = Join-Path $Site '_ОБНОВЛЕНИЕ ДЛЯ ХОСТИНГА.zip'
$SizeFull = 1600; $SizeThumb = 640
$exts = '.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tif', '.tiff', '.jfif'

function Say($t, $c = 'Gray') { Write-Host $t -ForegroundColor $c }

# ---------- чтение списка фото ----------
if (-not (Test-Path $WorksJs)) { Say "Не найден файл $WorksJs. Запускайте из папки сайта." Red; exit 1 }
$raw = [IO.File]::ReadAllText($WorksJs, $UTF8)
$start = $raw.IndexOf('IK_WORKS = [')
if ($start -lt 0) { Say 'Не удалось прочитать js/works.js' Red; exit 1 }
$header = $raw.Substring(0, $start)
$json = $raw.Substring($start + 11)
$json = $json.Substring(0, $json.LastIndexOf(']') + 1)
$cats = New-Object System.Collections.ArrayList
foreach ($c in ($json | ConvertFrom-Json)) {
  $items = New-Object System.Collections.ArrayList
  foreach ($it in $c.items) { [void]$items.Add(@([string]$it[0], [int]$it[1], [int]$it[2])) }
  [void]$cats.Add([ordered]@{ slug = $c.slug; title = $c.title; cover = [string]$c.cover; text = [string]$c.text; items = $items })
}

# ---------- папки для новых фото ----------
$created = $false
if (-not (Test-Path $Inbox)) { New-Item -ItemType Directory $Inbox | Out-Null; $created = $true }
foreach ($c in $cats) {
  $dir = Join-Path $Inbox ($c.title -replace '[\\/:*?"<>|]', '-')
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory $dir | Out-Null }
}
if ($created) {
  Say ''
  Say "Создана папка «$InboxName» с подпапками по категориям." Yellow
  Say 'Разложите фото по подпапкам и запустите «ДОБАВИТЬ ФОТО» ещё раз.' Yellow
  Say 'Для новой категории просто создайте подпапку с её названием.' Yellow
  if (-not $Quiet) { Start-Process explorer.exe $Inbox }
  exit 0
}

# ---------- вспомогательные функции ----------
$translit = @{ 'а'='a';'б'='b';'в'='v';'г'='g';'д'='d';'е'='e';'ё'='e';'ж'='zh';'з'='z';'и'='i';'й'='y';'к'='k';'л'='l';'м'='m';'н'='n';'о'='o';'п'='p';'р'='r';'с'='s';'т'='t';'у'='u';'ф'='f';'х'='h';'ц'='ts';'ч'='ch';'ш'='sh';'щ'='sch';'ъ'='';'ы'='y';'ь'='';'э'='e';'ю'='yu';'я'='ya' }
function To-Slug($s) {
  $o = ''
  foreach ($ch in $s.ToLower().ToCharArray()) { $k = [string]$ch; if ($translit.ContainsKey($k)) { $o += $translit[$k] } elseif ($k -match '[a-z0-9]') { $o += $k } else { $o += '-' } }
  $o = ($o -replace '-+', '-').Trim('-')
  if (-not $o) { $o = 'kategoriya' }
  return $o
}
function Get-Hash($path) { (Get-FileHash -Algorithm SHA1 -LiteralPath $path).Hash }
function Save-Jpeg($bmp, $path, $q) {
  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $ep = New-Object System.Drawing.Imaging.EncoderParameters 1
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]$q)
  $bmp.Save($path, $codec, $ep)
}
function Resize($img, $max) {
  $w = $img.Width; $h = $img.Height
  $k = [Math]::Min(1.0, $max / [double][Math]::Max($w, $h))
  $nw = [int][Math]::Round($w * $k); $nh = [int][Math]::Round($h * $k)
  $bmp = New-Object System.Drawing.Bitmap $nw, $nh   # новый файл без метаданных (GPS и т. п.)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.SmoothingMode = 'HighQuality'; $g.PixelOffsetMode = 'HighQuality'; $g.CompositingQuality = 'HighQuality'
  $g.Clear([System.Drawing.Color]::White)
  $attr = New-Object System.Drawing.Imaging.ImageAttributes
  $attr.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, $nw, $nh), 0, 0, $w, $h, [System.Drawing.GraphicsUnit]::Pixel, $attr)
  $g.Dispose()
  return $bmp
}
function Fix-Orientation($img) {
  if ($img.PropertyIdList -notcontains 0x0112) { return }
  $o = [int]$img.GetPropertyItem(0x0112).Value[0]
  switch ($o) {
    2 { $img.RotateFlip('RotateNoneFlipX') } 3 { $img.RotateFlip('Rotate180FlipNone') } 4 { $img.RotateFlip('Rotate180FlipX') }
    5 { $img.RotateFlip('Rotate90FlipX') } 6 { $img.RotateFlip('Rotate90FlipNone') } 7 { $img.RotateFlip('Rotate270FlipX') }
    8 { $img.RotateFlip('Rotate270FlipNone') }
  }
}

$known = @{}
if (Test-Path $HashFile) { foreach ($l in [IO.File]::ReadAllLines($HashFile)) { if ($l) { $known[$l.Split(' ')[0]] = 1 } } }

# ---------- обработка ----------
$changed = New-Object System.Collections.ArrayList
$added = 0; $skipped = 0; $dups = 0; $newHashes = New-Object System.Collections.ArrayList
$folders = Get-ChildItem -LiteralPath $Inbox -Directory | Where-Object { $_.Name -ne '_готово' }
foreach ($f in $folders) {
  $files = @(Get-ChildItem -LiteralPath $f.FullName -File | Sort-Object Name)
  if (-not $files.Count) { continue }

  $cat = $cats | Where-Object { ($_.title -replace '[\\/:*?"<>|]', '-') -eq $f.Name } | Select-Object -First 1
  if (-not $cat) {
    $slug = To-Slug $f.Name; $n = 2; $base = $slug
    while ($cats | Where-Object { $_.slug -eq $slug }) { $slug = "$base-$n"; $n++ }
    $cat = [ordered]@{ slug = $slug; title = $f.Name; cover = ''; text = ''; items = (New-Object System.Collections.ArrayList) }
    [void]$cats.Add($cat)
    Say "Новая категория: «$($f.Name)» (папка img/works/$slug)" Cyan
  }
  $outDir = Join-Path $Site "img\works\$($cat.slug)"
  if (-not (Test-Path $outDir)) { New-Item -ItemType Directory $outDir | Out-Null }

  $maxNum = 0
  foreach ($it in $cat.items) { $v = 0; if ([int]::TryParse($it[0], [ref]$v) -and $v -gt $maxNum) { $maxNum = $v } }

  $doneDir = Join-Path $Done $f.Name
  $pos = 0   # новые фото встают в начало категории — свежие работы видны первыми
  foreach ($file in $files) {
    if ($exts -notcontains $file.Extension.ToLower()) {
      Say "  пропущен «$($file.Name)» — формат не поддерживается (сохраните как JPG)" DarkYellow; $skipped++; continue
    }
    $hash = Get-Hash $file.FullName
    if ($known.ContainsKey($hash)) {
      Say "  «$($file.Name)» уже был добавлен раньше — пропускаю" DarkGray; $dups++
    } else {
      try { $img = [System.Drawing.Image]::FromFile($file.FullName) }
      catch { Say "  не удалось открыть «$($file.Name)» — пропущен" DarkYellow; $skipped++; continue }
      try {
        Fix-Orientation $img
        $numBefore = $maxNum
        $maxNum++
        $name = if ($maxNum -lt 100) { '{0:D2}' -f $maxNum } else { [string]$maxNum }
        $bmpFull = Resize $img $SizeFull; Save-Jpeg $bmpFull (Join-Path $outDir "$name.jpg") 84
        $fw = $bmpFull.Width; $fh = $bmpFull.Height; $bmpFull.Dispose()
        $bmpThumb = Resize $img $SizeThumb; Save-Jpeg $bmpThumb (Join-Path $outDir "$name-t.jpg") 80; $bmpThumb.Dispose()
      } catch {
        Say "  ошибка при обработке «$($file.Name)» — пропущен ($($_.Exception.Message))" DarkYellow
        $maxNum = $numBefore; $skipped++; $img.Dispose(); continue
      } finally { $img.Dispose() }
      $cat.items.Insert($pos, @($name, $fw, $fh)); $pos++
      if (-not $cat.cover) { $cat.cover = $name }
      [void]$changed.Add("img/works/$($cat.slug)/$name.jpg"); [void]$changed.Add("img/works/$($cat.slug)/$name-t.jpg")
      [void]$newHashes.Add("$hash $($cat.slug)/$name $($file.Name)")
      $known[$hash] = 1
      $added++
      Say "  + $($cat.title): $($file.Name) → $name.jpg" Green
    }
    if (-not (Test-Path $doneDir)) { New-Item -ItemType Directory $doneDir | Out-Null }
    $dest = Join-Path $doneDir $file.Name; $i = 1
    while (Test-Path $dest) { $dest = Join-Path $doneDir ("{0} ({1}){2}" -f $file.BaseName, $i, $file.Extension); $i++ }
    Move-Item -LiteralPath $file.FullName -Destination $dest
  }
}

if ($added -eq 0) {
  Say ''
  Say "Новых фото не найдено. Положите фото в подпапки «$InboxName» и запустите ещё раз." Yellow
  if ($skipped) { Say "Пропущено файлов: $skipped" DarkYellow }
  exit 0
}

# ---------- запись works.js ----------
function JStr($s) { '"' + ([string]$s).Replace('\', '\\').Replace('"', '\"') + '"' }
$parts = foreach ($c in $cats) {
  $its = ($c.items | ForEach-Object { '[' + (JStr $_[0]) + ',' + $_[1] + ',' + $_[2] + ']' }) -join ','
  '{"slug":' + (JStr $c.slug) + ',"title":' + (JStr $c.title) + ',"cover":' + (JStr $c.cover) + ',"text":' + (JStr $c.text) + ',"items":[' + $its + ']}'
}
[IO.File]::WriteAllText($WorksJs, $header + 'IK_WORKS = [' + ($parts -join ',') + "];`n", $UTF8)
[void]$changed.Add('js/works.js')
[IO.File]::AppendAllText($HashFile, (($newHashes -join "`r`n") + "`r`n"), $UTF8)

# ---------- версия works.js в index.html (чтобы браузеры увидели новые фото) ----------
$html = [IO.File]::ReadAllText($IndexHtml, $UTF8)
$m = [regex]::Match($html, 'js/works\.js\?v=(\d+)')
if ($m.Success) {
  $html = $html.Replace($m.Value, 'js/works.js?v=' + ([int]$m.Groups[1].Value + 1))
  [IO.File]::WriteAllText($IndexHtml, $html, $UTF8)
  [void]$changed.Add('index.html')
}

# ---------- архив обновления для хостинга ----------
if (Test-Path $UpdateZip) { Remove-Item $UpdateZip -Force }
$zip = [System.IO.Compression.ZipFile]::Open($UpdateZip, 'Create')
foreach ($rel in ($changed | Select-Object -Unique)) {
  [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $Site ($rel -replace '/', '\')), $rel, 'Optimal')
}
$zip.Dispose()

$total = ($cats | ForEach-Object { $_.items.Count } | Measure-Object -Sum).Sum
Say ''
Say "Готово! Добавлено фото: $added. Всего на сайте: $total." Green
if ($dups) { Say "Уже были на сайте (пропущены): $dups" DarkGray }
if ($skipped) { Say "Не удалось добавить: $skipped (см. сообщения выше)" DarkYellow }
Say ''
Say 'Чтобы фото появились на сайте:' Cyan
Say "  Timeweb → Файловый менеджер → public_html → загрузите «_ОБНОВЛЕНИЕ ДЛЯ ХОСТИНГА.zip»" Cyan
Say '  → правый клик → «Разархивировать» (с заменой файлов) → затем удалите этот архив с хостинга.' Cyan
if (-not $Quiet) { Start-Process explorer.exe "/select,`"$UpdateZip`"" }
