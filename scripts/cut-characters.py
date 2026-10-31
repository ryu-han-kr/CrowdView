"""캐릭터 시트(2줄 x 5칸, 아래 글자 이름표)를 한 컷씩 잘라 배경을 투명하게 만든다.
python scripts/cut-characters.py photo/charactor photo/char-out  → <캐릭터>-<포즈>.png (300x400, 발끝 기준 정렬)
"""
import sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SHEETS = {  # 파일 앞부분 → 캐릭터 이름
    "221b6b4c": "raccoon", "69115aea": "otter", "b16c03a5": "rabbit", "b2d18aaf": "hamster", "c70e1843": "fox",
}
POSES = ["base", "calm", "normal", "busy", "packed", "explore", "pick", "wait", "alert", "done"]
W, H, FOOT = 300, 400, 392
TOP, SIDE = 4, 4  # 칸 위·양옆 최소 여백
GROW = 3
PAD = 60  # 칸 양옆으로 더 잘라 보는 폭
NO_PAD = {"raccoon-alert"}  # 크게 막는 컷(GROW_MORE)은 넓히면 옆 칸 꼬리가 묻어 나온다
GROW_MORE = {"raccoon-alert": 25}  # 얼굴 윤곽선이 끊겨 배경이 새는 컷
CUT_BOTTOM = {"raccoon-alert": 380}  # 크게 막으면 이름표와 붙어서 미리 잘라 둠

def cut_mask(d, grow):
    """테두리에서 배경 채우기 → 배경 255 마스크 (윤곽선 안쪽 흰 털은 그대로)"""
    # 윤곽선 틈으로 새지 않게 경계를 grow px 두껍게 (copy: 배열을 빌린 이미지는 floodfill이 안 먹음)
    work = Image.fromarray(np.where(d < 16, 0, 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(grow)).copy()
    h, w = d.shape
    for x in range(0, w, 3):
        for y in (0, h - 1):
            if work.getpixel((x, y)) == 0: ImageDraw.floodfill(work, (x, y), 128)
    for y in range(0, h, 3):
        for x in (0, w - 1):
            if work.getpixel((x, y)) == 0: ImageDraw.floodfill(work, (x, y), 128)
    # 두껍게 막은 만큼 다시 넓혀 윤곽선 바로 앞까지 배경으로 (틈으로는 grow px만 들어감)
    out = Image.fromarray(((np.array(work) == 128) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(grow + 2))
    return Image.fromarray(((np.asarray(out) > 0) & (d < 16)).astype(np.uint8) * 255)

def cut(cell: Image.Image, grow: int = GROW, label: bool = True):
    a = np.asarray(cell).astype(np.int16)
    bg = np.median(np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]), axis=0)
    d = np.abs(a - bg).max(axis=2)
    h, w = d.shape
    bgm = np.asarray(cut_mask(d, grow)) > 0
    if grow > GROW:  # 크게 막아서 못 채운 바깥 여백(칸 테두리 40px 안)은 보통 방식 결과로 보충
        edge = np.zeros(d.shape, bool); edge[:40] = edge[-40:] = edge[:, :40] = edge[:, -40:] = True
        bgm |= edge & (np.asarray(cut_mask(d, GROW)) > 0)
    # 배경에 닿은 가장자리 2px은 배경과의 차이로 부드럽게
    band = np.asarray(Image.fromarray((bgm * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    alpha = np.full(d.shape, 255.0)
    soft = band & ~bgm
    alpha[soft] = np.clip((d[soft] - 8) / 40, 0, 1) * 255
    alpha[bgm] = 0
    rgba = np.dstack([a.astype(np.uint8), alpha.astype(np.uint8)])
    # 아래 이름표 지우기: 맨 아래 덩어리부터 위로 빈 줄 3개가 나올 때까지
    if not label: return Image.fromarray(rgba)
    rows = (alpha > 40).sum(axis=1) > 2
    y = h - 1
    while y > 0 and not rows[y]: y -= 1
    while y > 0:
        if not rows[y - 3:y].any(): break
        y -= 1
    if y > 6: rgba[y - 1:] = 0
    else: print("  이름표 못 찾음")
    # 10/28 경수님 '엉덩이가 잘려 있어': 발밑 그림자를 배경으로 지워 아래가 일자로 잘려 보였다 →
    # 몸 맨 아래 줄 위아래의 옅은 그림자를 배경과의 차이만큼 반투명으로 살린다 (이름표 줄 위까지만)
    body = np.where((rgba[..., 3] > 40).sum(axis=1) > 2)[0]
    if len(body):
        yb = int(body.max())
        lo, hi = max(0, yb - 40), min(y - 1 if y > 6 else h, yb + 45)
        zone = np.zeros(d.shape, bool); zone[lo:hi] = True
        shade = zone & (rgba[..., 3] < 255)
        rgba[..., 3][shade] = np.maximum(rgba[..., 3][shade], (np.clip((d[shade] - 3) / 30, 0, 1) * 230).astype(np.uint8))
    return Image.fromarray(rgba)

def drop_side_bits(pic: Image.Image, reach: int = 60) -> Image.Image:
    """칸 양옆 reach px 안에서 빈 세로줄로 몸통과 떨어진 조각(옆 칸에서 넘어온 그림)을 지운다"""
    a = np.array(pic)
    filled = (a[..., 3] > 40).sum(axis=0) > 0
    w = len(filled)
    gaps = [x for x in range(1, reach) if not filled[x] and filled[:x].any()]
    if gaps: a[:, : gaps[-1], 3] = 0
    gaps = [x for x in range(w - reach, w - 1) if not filled[x] and filled[x + 1 :].any()]
    if gaps: a[:, gaps[0] + 1 :, 3] = 0
    # 빈 세로줄 없이 옆에 붙은 조각: 발밑 그림자 줄(아래 30px)을 빼고 이어진 덩어리를 보고, 양끝에 닿았는데 몸통과 안 이어진 것을 지운다
    rows = np.where((a[..., 3] > 40).any(axis=1))[0]
    if not len(rows): return Image.fromarray(a)
    cut_y = int(rows.max()) - 30
    m = np.where(a[..., 3] > 40, 255, 0).astype(np.uint8)
    m[cut_y:] = 0
    mi = Image.fromarray(m).copy()
    ys = np.where(m[:, w // 2] > 0)[0]
    if len(ys): ImageDraw.floodfill(mi, (w // 2, int(ys.max())), 128)
    # 끝에서 40px 안에만 있는 좁은 조각만 (말풍선처럼 안쪽까지 들어온 자기 그림은 둔다)
    for x in (*range(4), *range(w - 4, w)):
        for y in range(cut_y):
            if mi.getpixel((x, y)) != 255: continue
            ImageDraw.floodfill(mi, (x, y), 60)
            part = np.array(mi) == 60
            cols = np.where(part.any(axis=0))[0]
            narrow = cols.max() < 40 if x < w // 2 else cols.min() > w - 40
            if narrow: a[part, 3] = 0
            ImageDraw.floodfill(mi, (x, y), 30)
    return Image.fromarray(a)

def keep_own(pic: Image.Image, x0: int, x1: int) -> Image.Image:
    """넓혀 자른 칸에서 내 그림만 남긴다: 칸 밖(넓힌 부분)에 걸친 덩어리마다 가로 중심이 원래 칸(x0~x1) 안이면 둔다.
    칸 경계를 넘어간 내 그림(지도·꼬리)은 몸통과 이어져 있어 살고, 옆 칸에서 넘어온 조각은 중심이 칸 밖이라 지워진다.
    이어짐은 진한 부분(알파 200 초과)으로만 본다 — 반투명 발밑 그림자로 보면 옆 칸 그림과 이어져 버린다"""
    a = np.array(pic)
    al = a[..., 3]
    work = Image.fromarray(np.where(al > 200, 255, 0).astype(np.uint8)).copy()  # copy: 배열을 빌린 이미지는 floodfill이 안 먹음
    outside = np.zeros(al.shape, bool)
    outside[:, :x0] = outside[:, x1:] = True
    while True:
        ys, xs = np.nonzero((np.asarray(work) == 255) & outside)
        if not len(ys): break
        ImageDraw.floodfill(work, (int(xs[0]), int(ys[0])), 100)
        part = np.asarray(work) == 100
        if not (x0 <= np.nonzero(part)[1].mean() < x1):
            a[part, 3] = 0
        ImageDraw.floodfill(work, (int(xs[0]), int(ys[0])), 1)
    # 칸 밖의 반투명 픽셀(그림자·가장자리)은 남은 진한 그림 바로 옆(4px)만 둔다
    solid = Image.fromarray(((a[..., 3] > 200) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))
    a[outside & (a[..., 3] <= 200) & (np.asarray(solid) == 0), 3] = 0
    return Image.fromarray(a)

def main(src, out):
    os.makedirs(out, exist_ok=True)
    for f in os.listdir(src):
        name = SHEETS.get(f[:8])
        if not name: continue
        im = Image.open(os.path.join(src, f)).convert("RGB")
        sw, sh = im.size
        cw = sw / 5
        pics = {}
        for r, (y0, y1) in enumerate([(0, int(sh * 0.512)), (int(sh * 0.512), sh)]):
            for c in range(5):
                # 10/31 경수님 '캐릭터 오른쪽 잘렸어': 지도·꼬리가 칸 경계를 넘는 컷이 있어 양옆 PAD만큼 넓혀 자르고 keep_own으로 옆 칸 조각을 지운다
                key = f"{name}-{POSES[r * 5 + c]}"
                pad = 0 if key in NO_PAD else PAD
                left = max(0, int(c * cw) + 2 - pad)
                cell = im.crop((left, y0, min(sw, int((c + 1) * cw) - 2 + pad), y1))
                if key in CUT_BOTTOM: cell = cell.crop((0, 0, cell.width, CUT_BOTTOM[key]))
                pic = cut(cell, GROW_MORE.get(key, GROW), key not in CUT_BOTTOM)
                if not pic.getchannel("A").getbbox(): print("  빈 칸", name, r, c); continue
                pic = keep_own(pic, int(c * cw) + 2 - left, int((c + 1) * cw) - 2 - left) if pad else drop_side_bits(pic)
                pics[key] = pic.crop(pic.getchannel("A").getbbox())
        # 10/26: 키 큰 포즈(귀·말풍선)가 400px 칸 위로 잘리던 것 → 그 캐릭터 포즈 전체를 같은 비율로 줄여 가장 큰 컷도 다 들어가게
        # (포즈끼리 크기가 같아 화면에서 바뀌어도 튀지 않는다)
        # 10/31: 폭은 같이 맞추지 않는다 — 지도를 다 살린 '탐색'처럼 넓은 컷 하나 때문에 모든 포즈가 20% 작아졌다. 폭이 넘치는 컷만 따로 줄인다
        k = min(1.0, min((FOOT - TOP) / p.height for p in pics.values()))
        for key, body in pics.items():
            kk = min(k, (W - 2 * SIDE) / body.width)
            if kk < 1: body = body.resize((round(body.width * kk), round(body.height * kk)), Image.LANCZOS)
            canvas = Image.new("RGBA", (W, H))
            canvas.paste(body, ((W - body.width) // 2, FOOT - body.height), body)
            canvas.save(os.path.join(out, f"{key}.png"))
        print(name, f"x{k:.2f}")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
