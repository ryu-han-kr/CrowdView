hues=["indigo","sky","emerald","amber","violet","red","rose","orange","teal","blue","green","yellow","pink","purple","lime","cyan","fuchsia"]
vars=["--surface: #111a2b;","--page: #0b1220;","color-scheme: dark;"]
gray={"50":"#151d2e","100":"#1c2639","200":"#28344a","300":"#3a475e","400":"#7b879b","500":"#97a3b6","600":"#b3bfce","700":"#cad4e1","800":"#e0e7f0","900":"#f1f5f9","950":"#f8fafc"}
for scale in ["gray","slate","zinc","neutral"]:
    for k,v in gray.items(): vars.append(f"--color-{scale}-{k}: {v};")
for h in hues:
    vars+= [f"--color-{h}-50: color-mix(in oklab, var(--color-{h}-500) 13%, #111a2b);",
            f"--color-{h}-100: color-mix(in oklab, var(--color-{h}-500) 22%, #111a2b);",
            f"--color-{h}-200: color-mix(in oklab, var(--color-{h}-500) 34%, #111a2b);",
            f"--color-{h}-700: var(--color-{h}-300);",
            f"--color-{h}-800: color-mix(in oklab, var(--color-{h}-300) 60%, white);",
            f"--color-{h}-900: color-mix(in oklab, var(--color-{h}-300) 35%, white);"]
def accent(P):
    return "\n".join(P + " :is(.text-" + h + "-600, .text-" + h + "-500) { color: var(--color-" + h + "-400) !important; }" for h in hues)
def rules(P):
    return f"""{P} {{
  {chr(10)+'  '.join(vars)}
  background: var(--page) !important;
}}
{P} body {{
  color: #e5e9f0;
}}
/* 흰 바탕 카드·바 → 어두운 면 (text-white는 색 버튼 위 글자라 그대로 흰색) */
{P} :is([class~="bg-white"], [class~="md:bg-white"]) {{
  background-color: var(--surface) !important;
}}
{P} [class*="bg-white/"] {{
  background-color: color-mix(in oklab, var(--surface) 92%, transparent) !important;
}}
{P} [class~="from-white"] {{
  --tw-gradient-from: var(--page) !important;
}}
{P} [class~="to-white"] {{
  --tw-gradient-to: var(--page) !important;
}}
/* 진한 회색 버튼·선택 칩(흰 글자)은 밝은 칩 + 어두운 글자로 */
{P} .bg-gray-900 {{
  background-color: #e2e8f0 !important;
  color: #0b1220 !important;
}}
{P} .bg-gray-900 :is(.text-white, span, svg) {{
  color: #0b1220 !important;
}}
/* 가운데 영역: 모바일은 앱 화면(어두운 면), 태블릿·PC는 배경이 비치게 그대로 투명 */
@media (min-width: 768px) {{
  {P} [class~="md:bg-transparent"] {{
    background-color: transparent !important;
  }}
}}
/* 진한 색 글자(-600·-500)는 어두운 바탕에서 흐려서 한 단계 밝게 (배경색 -600은 그대로) */
{accent(P)}
{P} main h1 {{
  color: #f8fafc;
}}
{P} .page-glow {{
  --glow-a: rgba(79, 70, 229, 0.22);
  --glow-b: rgba(14, 165, 233, 0.16);
  --glow-c: #10182a;
  /* 라이트용 그라데이션은 흰색을 섞어 회색 띠가 생겨서 다크 전용으로 */
  background:
    radial-gradient(60% 70% at 85% 0%, var(--glow-a), transparent 70%),
    radial-gradient(50% 60% at 10% 10%, var(--glow-b), transparent 70%),
    linear-gradient(to bottom, #131c33 0%, rgba(11, 18, 32, 0) 100%) !important;
}}
"""
css="""
/* ── 다크 모드: 시스템 설정을 따르고(자동), 마이페이지 설정에서 라이트·다크로 고정할 수 있다 (html[data-theme]).
   화면마다 클래스를 고치지 않고 Tailwind 색 변수(회색 눈금 뒤집기, 옅은 색 → 어두운 색조)와 흰 바탕만 바꾼다.
   (scripts/dark-css.py 로 만든 블록 — 고칠 때는 스크립트를 고쳐 다시 만든다) */
@media (prefers-color-scheme: dark) {
"""+rules(':root:not([data-theme="light"])')+"}\n"+rules(':root[data-theme="dark"]')
import sys
open(sys.argv[1],"w",encoding="utf8").write(css)
