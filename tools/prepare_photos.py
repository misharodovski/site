# -*- coding: utf-8 -*-
"""
Истая Кузница — подготовка фотографий работ для сайта.

Берёт RAR-архивы (или уже распакованные папки) с фотографиями, для каждой категории:
  * поворачивает по EXIF, отбрасывает мелкие и почти одинаковые кадры;
  * сохраняет img/works/<slug>/NN.jpg   (до 1600 px, для просмотра)
            img/works/<slug>/NN-t.jpg (до 640 px, превью в сетке);
  * пишет js/works.js — данные для галереи (window.IK_WORKS).

Запуск (нужны Python 3 + Pillow, для RAR — 7-Zip):
  python tools/prepare_photos.py "C:\\Users\\DEFER\\Pictures\\Material"
  python tools/prepare_photos.py <папка> --only lestnitsy,balkony   # пересобрать выбранные категории

Новая категория: добавьте строку в CATS (имя архива без .rar, slug, заголовок, обложка, описание).
"""
import argparse, json, os, shutil, subprocess, sys, tempfile
from PIL import Image, ImageOps

SITE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_IMG = os.path.join(SITE, "img", "works")
OUT_JS = os.path.join(SITE, "js", "works.js")
SEVEN_ZIP = [r"C:\Program Files\7-Zip\7z.exe", r"C:\Program Files (x86)\7-Zip\7z.exe", "7z"]

# (архив, slug, заголовок, номер кадра-обложки, короткое описание)
CATS = [
    ("Ograzhdenia", "ograzhdeniya", "Ограждения и ворота", "48", "Заборы, ворота, калитки и ограждения крылец — от строгих пик до растительного орнамента."),
    ("Lestnitsy", "lestnitsy", "Лестницы и перила", "19", "Перила парадных и винтовых лестниц, поручни из дерева и латуни, кованые балясины."),
    ("Balkony", "balkony", "Балконы", "10", "Французские и выпуклые балконы, ограждения террас и лоджий."),
    ("Kozyrki_navesy_besedki", "navesy", "Козырьки, навесы, беседки", "29", "Козырьки над входом, навесы для авто, беседки и перголы."),
    ("Reshetki_dlya_okon_i_konditsionerov", "reshetki", "Решётки на окна", "12", "Декоративные оконные решётки и корзины для кондиционеров."),
    ("Kaminnye_reshyotki_nabory", "kaminy", "Каминные решётки и наборы", "04", "Экраны, дровницы и каминные наборы."),
    ("Mebel_elementy_dekora", "mebel", "Мебель и декор", "33", "Столы, стулья, кровати, консоли, кованые цветы и элементы интерьера."),
    ("Fonari_lyustry", "fonari", "Фонари и люстры", "02", "Люстры, уличные фонари и светильники с кованым каркасом."),
    ("Bra_svetilniki", "bra", "Бра и светильники", "01", "Настенные бра и светильники."),
    ("Lavochki", "lavochki", "Скамейки", "03", "Садовые и парковые скамейки с кованым основанием."),
    ("Dekorativnye_dveri_ruchki", "dveri", "Двери и ручки", "01", "Декоративные двери, накладки и кованые ручки."),
    ("Mangaly", "mangaly", "Мангалы", "01", "Мангалы и барбекю-комплексы."),
    ("Podsvechniki", "podsvechniki", "Подсвечники", "01", "Подсвечники и канделябры."),
    ("Frizy", "frizy", "Фризы", "01", "Кованые фризы и декоративные вставки."),
    ("Karnizy", "karnizy", "Карнизы", "01", "Кованые карнизы для штор."),
    ("Flyugery", "flyugery", "Флюгеры", "01", "Флюгеры и навершия."),
    ("Volyery", "volery", "Вольеры", "01", "Вольеры и клетки."),
]

BIG, THUMB, MIN_SIDE = 1600, 640, 380


def find_7z():
    for p in SEVEN_ZIP:
        if shutil.which(p) or os.path.isfile(p):
            return p
    sys.exit("7-Zip не найден — распакуйте архивы вручную в папки с именами архивов.")


def ahash(im):
    g = im.convert("L").resize((12, 12))
    px = list(g.getdata())
    m = sum(px) / len(px)
    return sum(1 << i for i, p in enumerate(px) if p > m)


def source_dir(src, name, tmp):
    folder = os.path.join(src, name)
    if os.path.isdir(folder):
        return folder
    rar = os.path.join(src, name + ".rar")
    if not os.path.isfile(rar):
        return None
    out = os.path.join(tmp, name)
    subprocess.run([find_7z(), "e", "-y", "-o" + out, rar, "-x!Thumbs.db"], check=True, stdout=subprocess.DEVNULL)
    return out


def process(folder, slug):
    od = os.path.join(OUT_IMG, slug)
    shutil.rmtree(od, ignore_errors=True)
    os.makedirs(od)
    items, hashes = [], []
    for fn in sorted(os.listdir(folder)):
        if not fn.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
            continue
        try:
            im = ImageOps.exif_transpose(Image.open(os.path.join(folder, fn))).convert("RGB")
        except Exception as e:
            print("  пропуск", fn, e)
            continue
        if min(im.size) < MIN_SIDE:
            continue
        h = ahash(im)
        if any(bin(h ^ x).count("1") < 8 for x in hashes):
            continue
        hashes.append(h)
        name = "%02d" % (len(items) + 1)
        big = im.copy(); big.thumbnail((BIG, BIG), Image.LANCZOS)
        big.save(os.path.join(od, name + ".jpg"), "JPEG", quality=80, optimize=True, progressive=True)
        th = im.copy(); th.thumbnail((THUMB, THUMB), Image.LANCZOS)
        th.save(os.path.join(od, name + "-t.jpg"), "JPEG", quality=76, optimize=True, progressive=True)
        items.append([name, big.size[0], big.size[1]])
    return items


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src", help="папка с RAR-архивами или распакованными папками")
    ap.add_argument("--only", default="", help="slug-и через запятую")
    a = ap.parse_args()
    only = set(filter(None, a.only.split(",")))

    old = {}
    if os.path.isfile(OUT_JS):
        txt = open(OUT_JS, encoding="utf-8").read()
        old = {c["slug"]: c for c in json.loads(txt[txt.index("["): txt.rindex("]") + 1])}

    data = []
    with tempfile.TemporaryDirectory() as tmp:
        for arch, slug, title, cover, text in CATS:
            if only and slug not in only and slug in old:
                items = old[slug]["items"]
            else:
                folder = source_dir(a.src, arch, tmp)
                if not folder:
                    print("нет исходников:", arch); continue
                items = process(folder, slug)
            print("%-14s %3d фото" % (slug, len(items)))
            data.append({"slug": slug, "title": title, "cover": cover, "text": text, "items": items})

    with open(OUT_JS, "w", encoding="utf-8") as f:
        f.write("/* Сгенерировано tools/prepare_photos.py — не редактируйте вручную.\n"
                "   items: [файл, ширина, высота]; файлы лежат в img/works/<slug>/ */\n")
        f.write("window.IK_WORKS = ")
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    print("готово:", OUT_JS)


if __name__ == "__main__":
    main()
