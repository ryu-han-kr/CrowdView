/** 공유 미리보기 그림(ImageResponse)에 쓸 글자만 담은 Noto Sans KR (Google Fonts, UA 없이 받으면 TTF). 실패하면 null → 글꼴 없이 그린다 */
export async function loadOgFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text=${encodeURIComponent(text)}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}
