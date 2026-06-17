/**
 * Embute as fontes da marca (Anton / Archivo / Space Mono) como data URI pra
 * rasterização dos share cards.
 *
 * O render via `<svg><foreignObject>` roda num contexto isolado que NÃO carrega
 * o `<link>` do Google Fonts da página — então as fontes precisam estar inline
 * no HTML como `@font-face` com `src: url(data:font/woff2;base64,...)`. Aqui a
 * gente busca o CSS do Google Fonts (mesmas famílias/pesos usados nos cards),
 * baixa cada woff2 (já em cache do browser, porque a página carrega as mesmas
 * fontes) e troca as URLs por data URIs. Resultado cacheado em memória — o custo
 * só acontece no primeiro card gerado na sessão.
 */

// Só os pesos efetivamente usados nos templates — Anton (1 peso), Archivo
// 700/800/900, Space Mono 400/700. Menos peso pra baixar/embutir.
const FONTS_CSS_URL =
  'https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@700;800;900&family=Space+Mono:wght@400;700&display=swap'

let cachedCss: string | null = null
let inflight: Promise<string> | null = null

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000 // evita estourar o limite de args do String.fromCharCode
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/**
 * CSS `@font-face` com as fontes embutidas como data URI. Cacheado após a
 * primeira chamada. Lança se a rede/CORS falhar — o caller deve ter fallback
 * (ex.: share de texto).
 */
export async function loadEmbeddedFontCss(): Promise<string> {
  if (cachedCss) return cachedCss
  if (inflight) return inflight

  inflight = (async () => {
    const cssText = await (await fetch(FONTS_CSS_URL)).text()
    const urls = [...new Set([...cssText.matchAll(/url\((https:\/\/[^)]+)\)/g)].map((m) => m[1]))]
    const replacements = await Promise.all(
      urls.map(async (u) => {
        const buf = await (await fetch(u)).arrayBuffer()
        return [u, `data:font/woff2;base64,${arrayBufferToBase64(buf)}`] as const
      }),
    )
    let css = cssText
    for (const [u, dataUri] of replacements) css = css.split(u).join(dataUri)
    cachedCss = css
    return css
  })()

  try {
    return await inflight
  } finally {
    inflight = null
  }
}
