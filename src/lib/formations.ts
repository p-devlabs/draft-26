/**
 * Mapa formação → 11 slots posicionais com coordenadas no campo.
 *
 * Sistema de coordenadas:
 *   x: 0 (esquerda) → 100 (direita)
 *   y: 0 (linha de fundo defensiva) → 100 (linha de ataque adversária)
 *
 * Renderização: campo desenhado de baixo (defesa) pra cima (ataque). O componente
 * `Field` faz a inversão visual.
 */

export type SlotPosition =
  | 'GK'
  | 'CB'
  | 'LB'
  | 'RB'
  | 'LWB'
  | 'RWB'
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'LM'
  | 'RM'
  | 'LW'
  | 'RW'
  | 'CF'
  | 'ST'

export interface FormationSlot {
  pos: SlotPosition
  x: number
  y: number
}

export interface Formation {
  name: string
  description: string
  slots: FormationSlot[]
}

export const FORMATIONS: Record<string, Formation> = {
  '4-3-3': {
    name: '4-3-3',
    description: 'Pressão alta, ataque pelos lados',
    slots: [
      { pos: 'GK', x: 50, y: 5 },
      { pos: 'LB', x: 15, y: 25 },
      { pos: 'CB', x: 38, y: 22 },
      { pos: 'CB', x: 62, y: 22 },
      { pos: 'RB', x: 85, y: 25 },
      { pos: 'CDM', x: 50, y: 48 },
      { pos: 'CM', x: 28, y: 55 },
      { pos: 'CM', x: 72, y: 55 },
      { pos: 'LW', x: 18, y: 82 },
      { pos: 'ST', x: 50, y: 88 },
      { pos: 'RW', x: 82, y: 82 },
    ],
  },
  '4-2-3-1': {
    name: '4-2-3-1',
    description: 'Equilíbrio, com armador clássico',
    slots: [
      { pos: 'GK', x: 50, y: 5 },
      { pos: 'LB', x: 15, y: 25 },
      { pos: 'CB', x: 38, y: 22 },
      { pos: 'CB', x: 62, y: 22 },
      { pos: 'RB', x: 85, y: 25 },
      { pos: 'CDM', x: 35, y: 45 },
      { pos: 'CDM', x: 65, y: 45 },
      { pos: 'LM', x: 18, y: 72 },
      { pos: 'CAM', x: 50, y: 70 },
      { pos: 'RM', x: 82, y: 72 },
      { pos: 'ST', x: 50, y: 90 },
    ],
  },
  '4-4-2': {
    name: '4-4-2',
    description: 'Duas linhas de quatro, dupla de ataque',
    slots: [
      { pos: 'GK', x: 50, y: 5 },
      { pos: 'LB', x: 15, y: 25 },
      { pos: 'CB', x: 38, y: 22 },
      { pos: 'CB', x: 62, y: 22 },
      { pos: 'RB', x: 85, y: 25 },
      { pos: 'LM', x: 15, y: 55 },
      { pos: 'CM', x: 38, y: 52 },
      { pos: 'CM', x: 62, y: 52 },
      { pos: 'RM', x: 85, y: 55 },
      { pos: 'ST', x: 38, y: 85 },
      { pos: 'ST', x: 62, y: 85 },
    ],
  },
  '3-4-3': {
    name: '3-4-3',
    description: 'Três zagueiros, alas avançados',
    slots: [
      { pos: 'GK', x: 50, y: 5 },
      { pos: 'CB', x: 25, y: 22 },
      { pos: 'CB', x: 50, y: 20 },
      { pos: 'CB', x: 75, y: 22 },
      { pos: 'LWB', x: 12, y: 50 },
      { pos: 'CM', x: 38, y: 52 },
      { pos: 'CM', x: 62, y: 52 },
      { pos: 'RWB', x: 88, y: 50 },
      { pos: 'LW', x: 22, y: 82 },
      { pos: 'ST', x: 50, y: 88 },
      { pos: 'RW', x: 78, y: 82 },
    ],
  },
}

export const FORMATION_OPTIONS = Object.values(FORMATIONS)

export type Style = 'ofensivo' | 'equilibrado' | 'defensivo'

export const STYLES: { id: Style; label: string; description: string }[] = [
  {
    id: 'ofensivo',
    label: 'Ofensivo',
    description: 'Pressiona alto, busca o gol o tempo todo',
  },
  {
    id: 'equilibrado',
    label: 'Equilibrado',
    description: 'Defende junto, ataca junto',
  },
  {
    id: 'defensivo',
    label: 'Defensivo',
    description: 'Linha baixa, transição rápida',
  },
]

export type Difficulty = 'easy' | 'medium' | 'hard'

export const DIFFICULTIES: {
  id: Difficulty
  label: string
  skips: number
  description: string
}[] = [
  {
    id: 'easy',
    label: 'Easy',
    skips: 5,
    description: 'Cinco pulos. Pra quem quer um XI bonito.',
  },
  {
    id: 'medium',
    label: 'Medium',
    skips: 3,
    description: 'Três pulos. Equilibrado.',
  },
  {
    id: 'hard',
    label: 'Hard',
    skips: 1,
    description: 'Um pulo. Quase tudo que vier, você leva.',
  },
]

export const DIFFICULTY_SKIPS: Record<Difficulty, number> = {
  easy: 5,
  medium: 3,
  hard: 1,
}
