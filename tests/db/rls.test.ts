import type { PGlite } from '@electric-sql/pglite'
import { beforeEach, expect, test } from 'vitest'
import { ANA, BEN, CAL, HOST, as, freshDb, setPhase } from './harness'

let db: PGlite

beforeEach(async () => {
  db = await freshDb()
  await as(db, ANA, `insert into shades (name) values ('Ana')`)
  await as(db, ANA, `insert into confessions (sin, talent, bargain) values ('sin', 'talent', 'bargain')`)
  await as(db, BEN, `insert into shades (name) values ('Ben')`)
}, 30_000)

const one = async (sql: string) => (await db.query(sql)).rows[0] as Record<string, unknown>

test('a guest cannot create a shade for someone else', async () => {
  await expect(as(db, ANA, `insert into shades (id, name) values ('${CAL}', 'Cal')`)).rejects.toThrow(/row-level security/)
})

test('a guest cannot set hidden, realm or test on their own shade', async () => {
  await as(db, ANA, `update shades set hidden = true, realm = 'elysium', test = true where id = '${ANA}'`)
  expect(await one(`select hidden, realm, test from shades where id = '${ANA}'`)).toEqual({ hidden: false, realm: null, test: false })
})

test('a shade created after the lobby is late', async () => {
  await setPhase(db, 'intro')
  await as(db, CAL, `insert into shades (name) values ('Cal')`)
  expect(await one(`select late from shades where id = '${CAL}'`)).toEqual({ late: true })
})

test('guests read only their own confessions', async () => {
  expect(await as(db, BEN, `select * from confessions`)).toEqual([])
  expect(await as(db, ANA, `select sin from confessions`)).toEqual([{ sin: 'sin' }])
  expect(await as(db, HOST, `select sin from confessions`)).toEqual([{ sin: 'sin' }])
})

test('confessions are locked after the lobby', async () => {
  await setPhase(db, 'intro')
  expect(await as(db, ANA, `update confessions set sin = 'changed' returning sin`)).toEqual([])
  await expect(as(db, BEN, `insert into confessions (sin) values ('late')`)).rejects.toThrow(/row-level security/)
})

test('only hosts change the phase', async () => {
  await expect(as(db, ANA, `select set_phase('intro', 0)`)).rejects.toThrow(/not host/)
  expect(await as(db, ANA, `update game set phase = 'intro' returning phase`)).toEqual([])
  await as(db, HOST, `select set_phase('intro', 0)`)
  expect(await one(`select phase from game`)).toEqual({ phase: 'intro' })
})

test('votes are accepted only for the open item', async () => {
  await expect(as(db, ANA, `insert into votes (round, item, choice) values (1, 0, '${BEN}')`)).rejects.toThrow(/row-level security/)
  await setPhase(db, 'r1_vote', 0, 20)
  await as(db, ANA, `insert into votes (round, item, choice) values (1, 0, '${BEN}')`)
  await expect(as(db, ANA, `insert into votes (round, item, choice) values (1, 1, '${BEN}')`)).rejects.toThrow(/row-level security/)
})

test('votes close three seconds after the deadline', async () => {
  await setPhase(db, 'r1_vote', 0, -5)
  await expect(as(db, ANA, `insert into votes (round, item, choice) values (1, 0, '${BEN}')`)).rejects.toThrow(/row-level security/)
})

test('a guest can change their vote while it is open', async () => {
  await setPhase(db, 'r1_vote', 0, 20)
  await as(db, ANA, `insert into votes (round, item, choice) values (1, 0, '${BEN}')`)
  await as(db, ANA, `insert into votes (round, item, choice) values (1, 0, '${CAL}')
    on conflict (voter_id, round, item) do update set choice = excluded.choice`)
  expect(await as(db, ANA, `select choice from votes`)).toEqual([{ choice: CAL }])
})

test('guests cannot read or forge each other’s votes', async () => {
  await setPhase(db, 'r1_vote', 0, 20)
  await as(db, ANA, `insert into votes (round, item, choice) values (1, 0, '${BEN}')`)
  expect(await as(db, BEN, `select * from votes`)).toEqual([])
  await expect(as(db, BEN, `insert into votes (voter_id, round, item, choice) values ('${CAL}', 1, 0, '${ANA}')`)).rejects.toThrow(/row-level security/)
})

test('vote_count tells anyone how many have voted, not who', async () => {
  await setPhase(db, 'r1_vote', 0, 20)
  await as(db, ANA, `insert into votes (round, item, choice) values (1, 0, '${BEN}')`)
  expect(await as(db, CAL, `select vote_count(1::smallint, 0) as n`)).toEqual([{ n: 1 }])
})

test('only assigned writers answer, and only during r2_write', async () => {
  await db.exec(`insert into r2_assignments values (0, 'a', '${ANA}')`)
  await expect(as(db, ANA, `insert into r2_answers (matchup, text) values (0, 'too early')`)).rejects.toThrow(/row-level security/)
  await setPhase(db, 'r2_write', 0, 90)
  await expect(as(db, BEN, `insert into r2_answers (matchup, text) values (0, 'not mine')`)).rejects.toThrow(/row-level security/)
  await as(db, ANA, `insert into r2_answers (matchup, text) values (0, 'mine')`)
  expect(await as(db, BEN, `select * from r2_answers`)).toEqual([])
  expect(await as(db, BEN, `select answer_count() as n`)).toEqual([{ n: 1 }])
})

test('round 1 authors stay hidden from guests', async () => {
  await db.exec(`insert into r1_items (idx, text) values (0, 'sin'); insert into r1_authors values (0, '${ANA}')`)
  expect(await as(db, BEN, `select * from r1_authors`)).toEqual([])
  expect(await as(db, HOST, `select author_id from r1_authors`)).toEqual([{ author_id: ANA }])
})

test('only hosts reset the game', async () => {
  await setPhase(db, 'r2_write')
  await expect(as(db, ANA, `select reset_game()`)).rejects.toThrow(/not host/)
  await as(db, HOST, `select reset_game()`)
  expect(await one(`select count(*)::int as n from shades`)).toEqual({ n: 0 })
  expect(await one(`select phase from game`)).toEqual({ phase: 'lobby' })
})

test('guests upload only their own portrait', async () => {
  await as(db, ANA, `insert into storage.objects (bucket_id, name) values ('portraits', '${ANA}.jpg')`)
  await expect(as(db, ANA, `insert into storage.objects (bucket_id, name) values ('portraits', '${BEN}.jpg')`)).rejects.toThrow(/row-level security/)
})

test('round 3 bargains are public only once copied in by a host', async () => {
  await as(db, HOST, `insert into r3_items (idx, shade_id) values (0, '${ANA}')`)
  expect(await as(db, BEN, `select bargain from r3_items`)).toEqual([{ bargain: null }])
  expect(await as(db, BEN, `update r3_items set bargain = 'forged' returning bargain`)).toEqual([])
  await as(db, HOST, `update r3_items set opened = true, bargain = 'bargain' where idx = 0`)
  expect(await as(db, BEN, `select bargain from r3_items`)).toEqual([{ bargain: 'bargain' }])
})
