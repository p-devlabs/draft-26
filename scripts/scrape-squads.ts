/**
 * Scraper das 48 convocações da Copa do Mundo 2026.
 * Fonte: en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads
 *
 * Gera data/squads.json. Idempotente — rode quando quiser atualizar.
 *
 * Uso: pnpm scrape:squads
 */
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { load } from 'cheerio'

const URL = 'https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads'
const USER_AGENT = 'Draft26Scraper/0.1 (rlpereira@inf.ufpel.edu.br) - personal use'

type Position = 'GK' | 'DEF' | 'MID' | 'FWD'

interface ScrapedPlayer {
  shirt: number | null
  position: Position
  name: string
  isCaptain: boolean
  dateOfBirth: string | null
  age: number | null
  caps: number
  goals: number
  club: string
  clubCountry: string | null
}

interface ScrapedSquad {
  group: string
  country: string
  coach: string | null
  players: ScrapedPlayer[]
}

const POSITION_MAP: Record<string, Position> = {
  GK: 'GK',
  DF: 'DEF',
  MF: 'MID',
  FW: 'FWD',
}

async function main() {
  console.log(`▸ fetch ${URL}`)
  const res = await fetch(URL, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`)
  }
  const html = await res.text()
  const $ = load(html)

  const squads: ScrapedSquad[] = []
  let currentGroup: string | null = null

  $('div.mw-heading').each((_, el) => {
    const $el = $(el)
    const heading = $el.children('h2, h3').first()
    if (!heading.length) return

    const id = heading.attr('id') ?? ''
    const text = heading.text().trim()

    if (heading.is('h2')) {
      const groupMatch = text.match(/^Group\s+([A-L])$/i)
      currentGroup = groupMatch ? groupMatch[1].toUpperCase() : null
      return
    }

    if (!heading.is('h3') || !currentGroup) return

    const table = $el.nextAll('table.wikitable').first()
    if (!table.length) return

    // Sanity: o cabeçalho deve ter "Player" como coluna
    const headers = table
      .find('tr')
      .first()
      .find('th')
      .map((_, th) => $(th).text().trim())
      .get()
    if (!headers.includes('Player')) return

    const country = text
    const coachAnchor = $el.nextUntil('table').find('a').first()
    const coachP = $el.nextUntil('table').filter('p').first()
    const coachText =
      coachP
        .text()
        .match(/Coach:\s*(.+?)\s*(?:\.|$)/)?.[1]
        ?.trim() ?? null
    const coach = coachAnchor.text().trim() || coachText || null

    const players: ScrapedPlayer[] = []

    table.find('tr.nat-fs-player').each((_, row) => {
      const cells = $(row).find('td, th').toArray()
      if (cells.length < 7) return

      const shirtRaw = $(cells[0]).text().trim()
      const shirt = /^\d+$/.test(shirtRaw) ? parseInt(shirtRaw, 10) : null

      const posCell = $(cells[1])
      posCell.find('span[style*="display:none"]').remove()
      const posText = posCell.text().trim()
      const position = POSITION_MAP[posText]
      if (!position) return

      const nameCell = $(cells[2])
      const fullText = nameCell.text().trim()
      const isCaptain = /\bcaptain\b/i.test(fullText)
      const name =
        nameCell.find('a').first().text().trim() || fullText.replace(/\(captain\)/i, '').trim()

      const dobCell = $(cells[3])
      const dateOfBirth = dobCell.find('.bday').first().text().trim() || null
      const age = parseInt(dobCell.text().match(/aged\s+(\d+)/)?.[1] ?? '', 10) || null

      const caps = parseInt($(cells[4]).text().trim(), 10) || 0
      const goals = parseInt($(cells[5]).text().trim(), 10) || 0

      const clubCell = $(cells[6])
      const clubCountry = clubCell.find('.flagicon img').first().attr('alt') ?? null
      // O nome do clube é o último <a> dentro da célula (antes pode ter <a> da bandeira)
      const clubAnchors = clubCell.find('a')
      const club =
        clubAnchors.length > 0
          ? $(clubAnchors[clubAnchors.length - 1])
              .text()
              .trim()
          : clubCell.text().trim()

      players.push({
        shirt,
        position,
        name,
        isCaptain,
        dateOfBirth,
        age,
        caps,
        goals,
        club,
        clubCountry,
      })
    })

    if (players.length === 0) return

    squads.push({ group: currentGroup, country, coach, players })
  })

  const out = resolve(process.cwd(), 'data/squads.json')
  await writeFile(out, JSON.stringify(squads, null, 2))

  const totalPlayers = squads.reduce((s, q) => s + q.players.length, 0)
  const byGroup = squads.reduce<Record<string, number>>((acc, s) => {
    acc[s.group] = (acc[s.group] ?? 0) + 1
    return acc
  }, {})

  console.log(`▸ wrote ${out}`)
  console.log(`▸ ${squads.length} seleções, ${totalPlayers} jogadores`)
  console.log(`▸ grupos:`, byGroup)

  if (squads.length !== 48) {
    console.warn(`⚠ esperado 48 seleções, parsei ${squads.length}`)
  }
  const badSquads = squads.filter((s) => s.players.length < 23 || s.players.length > 26)
  if (badSquads.length > 0) {
    console.warn(`⚠ ${badSquads.length} seleções fora do range 23-26 jogadores:`)
    for (const s of badSquads) console.warn(`  · ${s.country}: ${s.players.length}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
