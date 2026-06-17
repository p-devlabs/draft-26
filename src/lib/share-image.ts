/**
 * Pipeline de imagem dos share cards do outcome.
 *
 * Os cards são entregues pelo design como HTML/CSS self-contained em dimensões
 * fixas (ex.: 1080×1920 pra Stories). Este módulo rasteriza esse HTML num PNG
 * e entrega via Web Share API (mobile — anexa a imagem de verdade, então
 * Stories/IG/WhatsApp funcionam) ou via download (desktop / sem suporte).
 *
 * Render é zero-dep: embrulha o HTML num `<svg><foreignObject>` e desenha num
 * `<canvas>`. Escolha consciente pra respeitar o budget de bundle (sem
 * html2canvas ~50KB+).
 *
 * ⚠️ Fontes: pra Anton / Space Mono / Archivo aparecerem no PNG, o HTML do card
 * precisa trazer `@font-face` com as fontes embutidas como data URI — um
 * `<link>` pro Google Fonts NÃO carrega dentro do contexto isolado do
 * SVG-as-image. O helper de embed entra quando o template do design chegar e
 * soubermos os pesos exatos usados.
 *
 * Uso pretendido (quando o template existir):
 *
 *   const html = renderCardHtml(buildShareCardData(ctx, kind)) // template do design
 *   const blob = await htmlToPngBlob(html, { width: 1080, height: 1920 })
 *   const result = await deliverShareImage(blob, {
 *     filename: 'draft26-campeao.png',
 *     text: 'Meu XI é CAMPEÃO no Draft 26!',
 *     url: 'https://draft-26.pages.dev',
 *   })
 */

export interface RenderOptions {
  width: number
  height: number
  /** Multiplicador de resolução (2 = retina/nitidez em telas densas). Default 2. */
  scale?: number
}

/**
 * Rasteriza um HTML self-contained num PNG (`Blob`). O HTML deve ter dimensões
 * fixas iguais a `width`×`height` e ser auto-contido (sem recursos externos —
 * ver caveat de fontes no topo do módulo).
 */
export async function htmlToPngBlob(html: string, opts: RenderOptions): Promise<Blob> {
  const { width, height, scale = 2 } = opts

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<foreignObject x="0" y="0" width="100%" height="100%">` +
    `<div xmlns="http://www.w3.org/1999/xhtml">${html}</div>` +
    `</foreignObject></svg>`
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

  const img = new Image()
  img.decoding = 'async'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Falha ao rasterizar o card (SVG inválido?)'))
    img.src = svgUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D indisponível')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob retornou null'))),
      'image/png',
    )
  })
}

export type ShareImageResult = 'shared' | 'downloaded' | 'failed'

/**
 * Entrega o PNG: sheet nativo com a imagem anexada no mobile (Stories/IG/
 * WhatsApp de verdade); download do arquivo no desktop ou onde a Web Share API
 * de arquivos não existir. Cancelar o sheet conta como sucesso (não força
 * download surpresa); só erro real cai pro download.
 */
export async function deliverShareImage(
  blob: Blob,
  meta: { filename: string; text?: string; url?: string },
): Promise<ShareImageResult> {
  const file = new File([blob], meta.filename, { type: 'image/png' })

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    typeof navigator.share === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], text: meta.text, url: meta.url })
      return 'shared'
    } catch (e) {
      // Usuário cancelou o sheet — não é falha, não dispara download surpresa.
      if (e instanceof DOMException && e.name === 'AbortError') return 'shared'
      // Outro erro: cai pro download abaixo.
    }
  }

  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = meta.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    return 'downloaded'
  } catch {
    return 'failed'
  }
}
