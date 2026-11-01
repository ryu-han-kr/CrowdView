"""캐릭터 컷을 움직임용 층으로 나눈다 (경수님 11/1: 효과는 건드리지 않아도 늘 움직이게).
python scripts/character-layers.py  → public/characters/<이름>/<포즈>.{body,fx,lid}[.sm].webp + src/data/characters-fx.json

- body: 몸통(이어진 지도·폰·말풍선 포함). 그대로 멈춰 있다
- fx:   몸통과 떨어진 작은 표시(땀·반짝임·느낌표)만. 맥박처럼 움직인다
- lid:  눈 뜬 포즈의 감은 눈. 잠깐씩 켜서 눈을 깜빡인다
- sleep: wait 컷에서 몸통만 다시 잘라 만든다 (옛 sleep 컷은 대기 그림을 지우다 오른쪽이 일자로 잘려 있었다)
"""
import glob, json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = "public/characters"
NAMES = ["fox", "hamster", "otter", "rabbit", "raccoon"]
W, H = 300, 400
# 말풍선처럼 큰 덩어리는 몸통 쪽에 둔다 (같이 흔들면 글자처럼 읽기 어렵다)
BIG = 2400
SPECK = 30  # 이보다 작은 조각은 자를 때 남은 티끌
NEAR = 5  # 몸통에서 이만큼 안이면 털끝으로 본다
ZZZ_DRAWN = {"hamster/wait", "otter/wait"}  # 그려진 zzz는 지우고 화면에서 움직이는 z를 쓴다


def labels(mask):
    """8방향 이어짐 번호 매기기 (scipy 없이)"""
    h, w = mask.shape
    out = np.zeros((h, w), np.int32)
    n = 0
    for y0, x0 in zip(*np.nonzero(mask)):
        if out[y0, x0]:
            continue
        n += 1
        out[y0, x0] = n
        stack = [(int(y0), int(x0))]
        while stack:
            y, x = stack.pop()
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not out[yy, xx]:
                        out[yy, xx] = n
                        stack.append((yy, xx))
    return out, n


def grow(mask, px):
    im = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(px * 2 + 1))
    return np.asarray(im) > 0


def split(a):
    """알파 배열 → (몸통 마스크, 표시 마스크, 티끌 마스크, 큰 덩어리 마스크)"""
    solid = a > 150
    lab, n = labels(solid)
    if not n:
        return solid, np.zeros_like(solid), np.zeros_like(solid), np.zeros_like(solid)
    areas = np.bincount(lab.ravel(), minlength=n + 1)
    areas[0] = 0
    main = lab == int(areas.argmax())
    # 털끝처럼 몸통 바로 옆 조각은 몸통으로 (번갈아 몇 번)
    for _ in range(3):
        near = grow(main, NEAR)
        for i in range(1, n + 1):
            part = lab == i
            if areas[i] and not main[part].any() and near[part].any():
                main |= part
    decor = np.zeros_like(solid)
    speck = np.zeros_like(solid)
    big = np.zeros_like(solid)
    for i in range(1, n + 1):
        part = lab == i
        if not areas[i] or main[part].any():
            continue
        if areas[i] < SPECK:
            speck |= part
        elif areas[i] >= BIG:
            big |= part
        else:
            decor |= part
    return main, decor, speck, big


def find_eyes(rgba, main):
    """어두운 눈동자 한 쌍. 감은 눈(가는 호)은 납작해서, 말풍선 속 사람 그림은 몸통 밖이라 걸리지 않는다"""
    rgb = rgba[..., :3].astype(float)
    luma = rgb @ np.array([0.299, 0.587, 0.114])
    # 빨간 그림(말풍선·배지·입)은 눈이 아니다
    dark = (luma < 100) & (rgba[..., 3] > 200) & (rgb[..., 0] - rgb[..., 1] < 70) & main
    # 눈동자 속 흰 반짝임을 메운다
    img = Image.fromarray((dark * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    closed = np.asarray(img) > 0
    lab, n = labels(closed)
    ys_main = np.nonzero(main)[0]
    top, bot = ys_main.min(), ys_main.max()
    blobs = []
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        bw, bh = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
        if not (10 <= bw <= 70 and 10 <= bh <= 70 and 0.55 <= bw / bh <= 1.6):
            continue
        if len(xs) / (bw * bh) < 0.5 or ys.mean() > top + (bot - top) * 0.75:
            continue
        blobs.append(dict(cx=(xs.min() + xs.max()) / 2, cy=(ys.min() + ys.max()) / 2, w=int(bw), h=int(bh), area=len(xs)))
    best = None
    for i, p in enumerate(blobs):
        for q in blobs[i + 1 :]:
            dx = abs(p["cx"] - q["cx"])
            if abs(p["cy"] - q["cy"]) > 28 or not 50 <= dx <= 140:
                continue
            if max(p["area"], q["area"]) / min(p["area"], q["area"]) > 2.2:
                continue
            if best is None or p["area"] + q["area"] > best[0]:
                best = (p["area"] + q["area"], p, q)
    return None if best is None else (best[1], best[2])


def draw_lids(rgba, eyes):
    SS = 4
    out = Image.new("RGBA", (W * SS, H * SS))
    d = ImageDraw.Draw(out)
    for e in eyes:
        rx, ry = e["w"] * 0.72, e["h"] * 0.72
        cx, cy = e["cx"], e["cy"]
        # 눈 둘레 바깥 털 색
        yy, xx = np.ogrid[: rgba.shape[0], : rgba.shape[1]]
        dist = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
        ring = (dist > 2.0) & (dist < 3.6) & (rgba[..., 3] > 220)
        fur = np.median(rgba[ring][:, :3], axis=0).astype(int) if ring.any() else np.array([250, 245, 240])
        box = [(cx - rx) * SS, (cy - ry) * SS, (cx + rx) * SS, (cy + ry) * SS]
        d.ellipse(box, fill=(*map(int, fur), 255))
        # 감은 눈: 아래로 둥근 선
        lw = max(3, round(e["h"] * 0.16)) * SS
        arc = [(cx - rx * 0.82) * SS, (cy - ry * 0.55) * SS, (cx + rx * 0.82) * SS, (cy + ry * 0.55) * SS]
        d.arc(arc, 20, 160, fill=(74, 46, 34, 255), width=lw)
    return out.resize((W, H), Image.LANCZOS)


def save(img, path):
    img.save(path, "WEBP", quality=88, method=6, exact=True)


def save_both(img, base, kind):
    save(img, f"{base}.{kind}.webp")
    save(img.resize((img.width // 2, img.height // 2), Image.LANCZOS), f"{base}.{kind}.sm.webp")


def layer(img, name, pose, fx):
    a = np.array(img.convert("RGBA"))
    al = a[..., 3]
    main, decor, speck, big = split(al)
    key = f"{name}/{pose}"
    base = f"{ROOT}/{name}/{pose}"
    entry = {}
    drop_decor = key in ZZZ_DRAWN or pose == "sleep"
    # 표시·티끌 둘레의 반투명 가장자리까지 함께 옮긴다
    decor_zone = grow(decor, 3) & ~grow(main | big, 2)
    speck_zone = grow(speck, 3) & ~grow(main | big | decor, 2)
    body = a.copy()
    body[decor_zone | speck_zone, 3] = 0
    save_both(Image.fromarray(body), base, "body")
    if decor.any() and not drop_decor:
        f = np.zeros_like(a)
        f[decor_zone] = a[decor_zone]
        save_both(Image.fromarray(f), base, "fx")
        entry["f"] = 1
    eyes = None if pose == "sleep" else find_eyes(a, main)
    if eyes:
        save_both(draw_lids(a, eyes), base, "lid")
        entry["l"] = 1
    if drop_decor:
        ys, xs = np.nonzero(main)
        # 머리 오른쪽 위에서 떠오른다 (칸 대비 %)
        entry["z"] = [round(float(xs.max() * 0.72 + xs.mean() * 0.28) / img.width * 100), round(float(ys.min()) / img.height * 100)]
    if entry:
        fx[key] = entry
    return bool(eyes)


def make_sleep(name):
    """wait 컷의 몸통만 잘라 정사각 칸에 (대기 화면은 160×160)"""
    a = np.array(Image.open(f"{ROOT}/{name}/wait.webp").convert("RGBA"))
    main, decor, speck, big = split(a[..., 3])
    keep = grow(main, 3)
    # 옅은 발밑 그림자는 몸통 아래쪽에 붙어 있어 살린다
    ys, xs = np.nonzero(main)
    shadow = np.zeros_like(main)
    shadow[max(0, ys.max() - 45) :, max(0, xs.min() - 30) : xs.max() + 30] = True
    keep |= shadow & ~grow(decor | speck | big, 2)
    out = a.copy()
    out[~keep, 3] = 0
    img = Image.fromarray(out)
    img = img.crop(img.getchannel("A").getbbox())
    k = min(1.0, 280 / img.width, 280 / img.height)
    if k < 1:
        img = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)
    canvas = Image.new("RGBA", (300, 300))
    canvas.paste(img, ((300 - img.width) // 2, 296 - img.height), img)
    save(canvas, f"{ROOT}/{name}/sleep.webp")
    save(canvas.resize((150, 150), Image.LANCZOS), f"{ROOT}/{name}/sleep.sm.webp")


def main():
    fx = {}
    for name in NAMES:
        make_sleep(name)
        files = sorted(glob.glob(f"{ROOT}/{name}/*.webp"))
        poses = [os.path.basename(f)[:-5] for f in files if os.path.basename(f).count(".") == 1]
        got = []
        for pose in poses:
            if layer(Image.open(f"{ROOT}/{name}/{pose}.webp"), name, pose, fx):
                got.append(pose)
        print(name, len(poses), "눈 깜빡임:", ",".join(got))
    with open("src/data/characters-fx.json", "w", encoding="utf-8") as f:
        json.dump(fx, f, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
