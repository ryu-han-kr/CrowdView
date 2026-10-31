# 서울 열린데이터 파일(zip) 내려받기 → 메모리에서 풀어 행정동×날짜×시 총생활인구만 남김 (zip은 디스크에 안 남김)
# python -I seoul_file.py INF_ID SEQ OUTNAME
import sys, io, zipfile, csv, json, gzip, urllib.request, urllib.parse, os, time

HIST = os.path.join(os.environ.get("HIST_DIR", os.path.join(os.getcwd(), ".history-raw")), "dong")
os.makedirs(HIST, exist_ok=True)
inf, seq, outname = sys.argv[1], sys.argv[2], sys.argv[3]
infseq = sys.argv[4] if len(sys.argv) > 4 else "3"
out = f"{HIST}/{outname}.json.gz"
if os.path.exists(out):
    print("skip", outname); sys.exit(0)

body = urllib.parse.urlencode({"infId": inf, "seqNo": "", "seq": seq, "infSeq": infseq}).encode()
for attempt in range(4):
    try:
        req = urllib.request.Request("https://datafile.seoul.go.kr/bigfile/iot/inf/nio_download.do?&useCache=false", data=body,
                                     headers={"User-Agent": "Mozilla/5.0", "Referer": f"https://data.seoul.go.kr/dataList/{inf}/S/1/datasetView.do"})
        data = urllib.request.urlopen(req, timeout=600).read()
        break
    except Exception as e:
        print("retry", attempt, e); time.sleep(10)
else:
    sys.exit(1)
print(outname, "bytes", len(data))
res = {}  # date -> dong -> [24]
if data[:2] == b"PK":
    z = zipfile.ZipFile(io.BytesIO(data))
    blobs = [z.read(n) for n in z.namelist() if n.lower().endswith((".csv", ".txt"))]
else:
    blobs = [data]
for raw in blobs:
    for enc in ("utf-8-sig", "cp949"):
        try:
            text = raw.decode(enc); break
        except UnicodeDecodeError:
            continue
    rd = csv.reader(io.StringIO(text))
    header = next(rd)
    h = [c.strip().strip('"').lstrip("?") for c in header]
    def col(*keys):
        for i, c in enumerate(h):
            if any(k in c for k in keys): return i
        raise KeyError(f"{keys} not in {h}")
    if "사용일자" in "".join(h):  # 지하철 일별 역별 승하차
        iD, iL, iS, iOn, iOff = col("사용일자"), col("노선명"), col("역명"), col("승차"), col("하차")
        for r in rd:
            if len(r) <= iOff: continue
            try:
                res.setdefault(r[iD].strip('"'), {})[r[iL].strip('"') + "|" + r[iS].strip('"')] = [int(float(r[iOn].strip('"') or 0)), int(float(r[iOff].strip('"') or 0))]
            except ValueError:
                pass
        continue
    iD, iH, iC, iT = col("기준일"), col("시간대"), col("행정동코드"), col("총생활인구")
    for r in rd:
        if len(r) <= iT: continue
        try:
            d, hr, dong, tot = r[iD].strip('"'), int(r[iH].strip('"')), r[iC].strip('"'), float(r[iT].strip('"') or 0)
        except ValueError:
            continue
        row = res.setdefault(d, {}).setdefault(dong, [0] * 24)
        if 0 <= hr < 24: row[hr] = round(tot, 1)
with gzip.open(out, "wt", encoding="utf-8") as f:
    json.dump(res, f, separators=(",", ":"))
print(outname, "days", len(res), "keys", len(next(iter(res.values()))) if res else 0, min(res) if res else "", max(res) if res else "")
