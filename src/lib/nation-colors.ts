/**
 * Gradientes das 48 seleções da Copa 2026 — aproximação visual das bandeiras
 * pra usar nos chips/badges de seleção (cor + código de 3 letras).
 *
 * Mantém o estilo "broadcast lower-third" do design: blocos sólidos de cor
 * da bandeira, sem tentar reproduzir cada detalhe (estrelas, brasões, faixas
 * complexas viram cor dominante). O código de 3 letras vem sobreposto.
 */

export const NATION_GRADIENTS: Record<string, string> = {
  // === Sul-Américas (CONMEBOL) ===
  BRA: 'linear-gradient(135deg, #009c3b 50%, #ffdf00 50%)',
  ARG: 'linear-gradient(180deg, #6cace4 33%, #fff 33%, #fff 66%, #6cace4 66%)',
  URU: 'linear-gradient(180deg, #5aa0ff 50%, #fff 50%)',
  COL: 'linear-gradient(180deg, #fcd116 0%, #fcd116 50%, #003893 50%, #003893 75%, #ce1126 75%)',
  ECU: 'linear-gradient(180deg, #ffd100 0%, #ffd100 50%, #034ea2 50%, #034ea2 75%, #ed1c24 75%)',
  PAR: 'linear-gradient(180deg, #d52b1e 33%, #fff 33%, #fff 66%, #0038a8 66%)',

  // === Europa (UEFA) ===
  FRA: 'linear-gradient(90deg, #002654 33%, #fff 33%, #fff 66%, #ed2939 66%)',
  ESP: 'linear-gradient(180deg, #aa151b 25%, #f1bf00 25%, #f1bf00 75%, #aa151b 75%)',
  POR: 'linear-gradient(90deg, #006600 40%, #ff0000 40%)',
  ENG: 'linear-gradient(180deg, #ce1124 calc(50% - 4px), #fff calc(50% - 4px), #fff calc(50% + 4px), #ce1124 calc(50% + 4px))',
  GER: 'linear-gradient(180deg, #000 33%, #dd0000 33%, #dd0000 66%, #ffce00 66%)',
  NED: 'linear-gradient(180deg, #ae1c28 33%, #fff 33%, #fff 66%, #21468b 66%)',
  BEL: 'linear-gradient(90deg, #000 33%, #ffd90c 33%, #ffd90c 66%, #ef3340 66%)',
  CRO: 'linear-gradient(180deg, #ff0000 33%, #fff 33%, #fff 66%, #171796 66%)',
  SUI: '#d52b1e',
  AUT: 'linear-gradient(180deg, #ed2939 33%, #fff 33%, #fff 66%, #ed2939 66%)',
  CZE: 'linear-gradient(180deg, #fff 50%, #d7141a 50%)',
  SWE: 'linear-gradient(180deg, #006aa7 calc(50% - 3px), #fecc00 calc(50% - 3px), #fecc00 calc(50% + 3px), #006aa7 calc(50% + 3px))',
  NOR: 'linear-gradient(180deg, #ba0c2f calc(50% - 3px), #002868 calc(50% - 3px), #002868 calc(50% + 3px), #ba0c2f calc(50% + 3px))',
  SCO: 'linear-gradient(135deg, #005eb8, #0067b0)',
  TUR: '#e30a17',
  BIH: 'linear-gradient(135deg, #002395, #fecb00)',

  // === África (CAF) ===
  MAR: '#c1272d',
  TUN: 'linear-gradient(90deg, #e70013 30%, #fff 30%, #fff 70%, #e70013 70%)',
  ALG: 'linear-gradient(90deg, #006633 50%, #fff 50%)',
  EGY: 'linear-gradient(180deg, #ce1126 33%, #fff 33%, #fff 66%, #000 66%)',
  SEN: 'linear-gradient(90deg, #00853f 33%, #fdef42 33%, #fdef42 66%, #e31b23 66%)',
  GHA: 'linear-gradient(180deg, #ce1126 33%, #fcd116 33%, #fcd116 66%, #006b3f 66%)',
  CIV: 'linear-gradient(90deg, #ff9900 33%, #fff 33%, #fff 66%, #009e60 66%)',
  RSA: 'linear-gradient(90deg, #007749 50%, #ffb612 50%)',
  COD: 'linear-gradient(135deg, #007fff, #f7d618)',
  CPV: 'linear-gradient(180deg, #003893 calc(60% - 2px), #fff calc(60% - 2px), #fff calc(60% + 2px), #003893 calc(60% + 2px))',

  // === Ásia (AFC) ===
  JPN: 'radial-gradient(circle at 50% 50%, #bc002d 22%, #fff 22%)',
  KOR: 'radial-gradient(circle at 50% 50%, #cd2e3a 18%, #fff 18%)',
  IRN: 'linear-gradient(180deg, #239f40 33%, #fff 33%, #fff 66%, #da0000 66%)',
  IRQ: 'linear-gradient(180deg, #ce1126 33%, #fff 33%, #fff 66%, #000 66%)',
  KSA: '#006c35',
  QAT: 'linear-gradient(90deg, #fff 20%, #8a1538 20%)',
  UZB: 'linear-gradient(180deg, #1eb53a 33%, #fff 33%, #fff 66%, #0099b5 66%)',
  JOR: 'linear-gradient(180deg, #000 33%, #fff 33%, #fff 66%, #007a3d 66%)',
  AUS: '#001489',

  // === América do Norte e Central (CONCACAF) ===
  USA: 'linear-gradient(180deg, #b22234, #fff 30%, #b22234 30%, #b22234 50%, #3c3b6e 50%)',
  MEX: 'linear-gradient(90deg, #006847 33%, #fff 33%, #fff 66%, #ce1126 66%)',
  CAN: 'linear-gradient(90deg, #d52b1e 25%, #fff 25%, #fff 75%, #d52b1e 75%)',
  HAI: 'linear-gradient(180deg, #00209f 50%, #d21034 50%)',
  PAN: 'linear-gradient(135deg, #fff 50%, #d21034 50%)',
  CUW: 'linear-gradient(180deg, #002b7f calc(60% - 2px), #f9e814 calc(60% - 2px), #f9e814 calc(60% + 2px), #002b7f calc(60% + 2px))',

  // === Oceania (OFC) ===
  NZL: '#00247d',
}

/**
 * Pega o gradiente da seleção pelo código ISO. Fallback: hash determinístico
 * a partir do código pra códigos não mapeados (mantém estável entre renders).
 */
export function nationGradient(code: string): string {
  const k = code.toUpperCase()
  const mapped = NATION_GRADIENTS[k]
  if (mapped) return mapped
  // Fallback hash-based (mantido pra códigos exóticos que escapam do mapa)
  let h = 0
  for (const c of k) h = (h * 31 + c.charCodeAt(0)) | 0
  const h1 = Math.abs(h) % 360
  const h2 = (h1 + 95) % 360
  return `linear-gradient(135deg, hsl(${h1} 65% 42%), hsl(${h2} 70% 52%))`
}
