import { describe, expect, it } from 'vitest'
import {
  USER_TEAM_CODE,
  createGroupStage,
  nextRound,
  parallelMatches,
  standings,
  userMatches,
  type GroupMatch,
  type GroupStage,
  type GroupTeam,
} from './groups'
import { createDraft } from './draft'
import { seededRng } from './simulate'

function makeStage(): GroupStage {
  const draft = createDraft('4-3-3', 'equilibrado', 'easy')
  return createGroupStage(draft, seededRng(1))
}

describe('createGroupStage', () => {
  it('substitui o time mais fraco pelo XI', () => {
    const stage = makeStage()
    expect(stage.teams).toHaveLength(4)
    expect(stage.teams[0].code).toBe(USER_TEAM_CODE)
    expect(stage.teams[0].isUser).toBe(true)
    // outros 3 não-user
    expect(stage.teams.slice(1).every((t) => !t.isUser)).toBe(true)
  })

  it('gera 6 jogos distribuídos em 3 rodadas', () => {
    const stage = makeStage()
    expect(stage.matches).toHaveLength(6)
    expect(stage.matches.filter((m) => m.round === 1)).toHaveLength(2)
    expect(stage.matches.filter((m) => m.round === 2)).toHaveLength(2)
    expect(stage.matches.filter((m) => m.round === 3)).toHaveLength(2)
  })

  it('cada par só joga uma vez ao longo do grupo', () => {
    const stage = makeStage()
    const pairKeys = new Set<string>()
    for (const m of stage.matches) {
      const k = [m.homeCode, m.awayCode].sort().join('-')
      expect(pairKeys.has(k)).toBe(false)
      pairKeys.add(k)
    }
    expect(pairKeys.size).toBe(6)
  })

  it('user joga 3 jogos (um contra cada um dos outros)', () => {
    const stage = makeStage()
    expect(userMatches(stage)).toHaveLength(3)
  })

  it('parallelMatches são os 3 sem o user', () => {
    const stage = makeStage()
    expect(parallelMatches(stage)).toHaveLength(3)
  })
})

// ── Helpers pra montar standings de teste sem rodar a simulação ────
function team(code: string, overall = 75, isUser = false): GroupTeam {
  return { code, name: code, flag: '🏳️', averageOverall: overall, isUser }
}

function fakeStage(
  teams: [GroupTeam, GroupTeam, GroupTeam, GroupTeam],
  results: Array<{ home: string; away: string; hg: number; ag: number; round: 1 | 2 | 3 }>,
): GroupStage {
  const matches: GroupMatch[] = results.map((r) => ({
    round: r.round,
    homeCode: r.home,
    awayCode: r.away,
    result: { homeGoals: r.hg, awayGoals: r.ag },
  }))
  return {
    letter: 'X',
    teams,
    matches,
    replacedTeam: { code: 'XXX', name: 'X', flag: '🏳️' },
  }
}

describe('standings — tiebreakers (FIFA Article 13)', () => {
  it('ordena por pontos quando todos diferem', () => {
    const stage = fakeStage(
      [team('A'), team('B'), team('C'), team('D')],
      [
        { home: 'A', away: 'B', hg: 2, ag: 0, round: 1 }, // A 3pts
        { home: 'C', away: 'D', hg: 1, ag: 1, round: 1 }, // C/D 1pt cada
        { home: 'A', away: 'C', hg: 1, ag: 0, round: 2 }, // A 6, C 1
        { home: 'B', away: 'D', hg: 2, ag: 1, round: 2 }, // B 3, D 1
        { home: 'A', away: 'D', hg: 0, ag: 0, round: 3 }, // A 7, D 2
        { home: 'B', away: 'C', hg: 1, ag: 2, round: 3 }, // B 3, C 4
      ],
    )
    const std = standings(stage)
    expect(std.map((s) => s.team.code)).toEqual(['A', 'C', 'B', 'D'])
  })

  it('tiebreaker #1: pontos no confronto direto desempata times com mesma pontuação geral', () => {
    // A, B, C empatam com 4 pontos cada (1V 1E 1D). Mini-tabela do trio decide.
    // A bateu B; B bateu C; C bateu A → todos 1V 1D no mini → vai pra saldo no mini.
    // Pra forçar uma ordem clara, faço: A bateu B 1-0, B bateu C 2-0, C bateu A 1-0
    // mini-tabela: A 3pts(1-1), B 3pts(2-1), C 3pts(1-2). Empata em pts no mini → saldo:
    // A 0, B +1, C -1 → ordem B, A, C.
    const stage = fakeStage(
      [team('A'), team('B'), team('C'), team('D')],
      [
        { home: 'A', away: 'B', hg: 1, ag: 0, round: 1 },
        { home: 'B', away: 'C', hg: 2, ag: 0, round: 2 },
        { home: 'C', away: 'A', hg: 1, ag: 0, round: 3 },
        // D perde tudo
        { home: 'D', away: 'A', hg: 0, ag: 3, round: 1 },
        { home: 'D', away: 'B', hg: 0, ag: 3, round: 2 },
        { home: 'D', away: 'C', hg: 0, ag: 3, round: 3 },
      ],
    )
    const std = standings(stage)
    // A: 1+3+3 = 7? Não — vamos contar: A bateu D 3-0 (vit), perdeu pra C 0-1, bateu B 1-0. = 6 pts
    // B: bateu C 2-0, perdeu pra A 0-1, bateu D 3-0 = 6 pts
    // C: bateu A 1-0, perdeu pra B 0-2, bateu D 3-0 = 6 pts
    // D: 3 derrotas = 0 pts
    // Mini-tabela A-B-C: A bateu B (1-0), B bateu C (2-0), C bateu A (1-0)
    // Cada um 3 pts no mini → saldo mini: A 0, B +1, C -1 → B, A, C
    expect(std.map((s) => s.team.code)).toEqual(['B', 'A', 'C', 'D'])
  })

  it('tiebreaker fallback: averageOverall como proxy FIFA ranking', () => {
    // 2 times empatados em tudo (até saldo geral). averageOverall mais alto vence.
    const stage = fakeStage(
      [team('A', 80), team('B', 70), team('C', 75), team('D', 65)],
      // Todos terminam 0-0
      [
        { home: 'A', away: 'B', hg: 0, ag: 0, round: 1 },
        { home: 'C', away: 'D', hg: 0, ag: 0, round: 1 },
        { home: 'A', away: 'C', hg: 0, ag: 0, round: 2 },
        { home: 'B', away: 'D', hg: 0, ag: 0, round: 2 },
        { home: 'A', away: 'D', hg: 0, ag: 0, round: 3 },
        { home: 'B', away: 'C', hg: 0, ag: 0, round: 3 },
      ],
    )
    const std = standings(stage)
    // Todos 3 pts (3 empates), 0-0 em tudo. Ordena por averageOverall.
    expect(std.map((s) => s.team.code)).toEqual(['A', 'C', 'B', 'D'])
  })
})

describe('nextRound', () => {
  it('retorna 1 quando nada foi jogado', () => {
    const stage = makeStage()
    expect(nextRound(stage)).toBe(1)
  })

  it('retorna null quando tudo foi jogado', () => {
    const stage = fakeStage(
      [team('A'), team('B'), team('C'), team('D')],
      [
        { home: 'A', away: 'B', hg: 1, ag: 0, round: 1 },
        { home: 'C', away: 'D', hg: 1, ag: 0, round: 1 },
        { home: 'A', away: 'C', hg: 1, ag: 0, round: 2 },
        { home: 'B', away: 'D', hg: 1, ag: 0, round: 2 },
        { home: 'A', away: 'D', hg: 1, ag: 0, round: 3 },
        { home: 'B', away: 'C', hg: 1, ag: 0, round: 3 },
      ],
    )
    expect(nextRound(stage)).toBeNull()
  })
})
