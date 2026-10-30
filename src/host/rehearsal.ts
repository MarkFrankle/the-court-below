import { supabase } from '../lib/supabase'

// Rehearsal helpers on the remote: test shades let two or three real phones run a full game.
// Reset game clears them along with everything else.

const TEST_SHADES: { name: string; guise: string; sin: string; talent: string; bargain: string }[] = [
  { name: 'Achilles', guise: 'A hero with one weak spot', sin: 'I sulk in my tent when I lose.', talent: 'I can outrun anyone, briefly.', bargain: 'Better shoes.' },
  { name: 'Medusa', guise: 'A gorgon', sin: 'I leave people on read. Permanently.', talent: 'I can hold eye contact forever.', bargain: 'A good conditioner.' },
  { name: 'Orpheus', guise: 'A musician', sin: 'I always look back.', talent: 'I can make anyone cry with a lute.', bargain: 'A second chance.' },
  { name: 'Eurydice', guise: 'A shade, mostly', sin: 'I let him walk ahead.', talent: 'I can wait a very long time.', bargain: 'A partner who listens.' },
  { name: 'Sisyphus', guise: 'A man with a boulder', sin: 'I cheated death twice.', talent: 'Excellent leg day.', bargain: 'A flat hill.' },
  { name: 'Icarus', guise: 'Feathers, wax', sin: 'I ignore safety briefings.', talent: 'I can fly, for a bit.', bargain: 'Sunscreen.' },
  { name: 'Pandora', guise: 'A curious woman', sin: 'I open other people’s post.', talent: 'I can find any box in the house.', bargain: 'A better lock.' },
  { name: 'Narcissus', guise: 'Himself', sin: 'I check my reflection in spoons.', talent: 'I know my best angle.', bargain: 'A bigger mirror.' },
  { name: 'Echo', guise: 'A nymph', sin: 'I repeat gossip.', talent: 'I always get the last word.', bargain: 'The first word, once.' },
  { name: 'Midas', guise: 'A king in gold', sin: 'I touched the buffet.', talent: 'I can turn a profit.', bargain: 'Gloves.' },
  { name: 'Penelope', guise: 'A weaver', sin: 'I undo my knitting at night.', talent: 'I can stall anyone for twenty years.', bargain: 'A faster husband.' },
  { name: 'Cassandra', guise: 'A prophet', sin: 'I say "I told you so".', talent: 'I know how this ends.', bargain: 'Someone who believes me.' },
]

export async function seedTestShades(n: number): Promise<void> {
  const picked = TEST_SHADES.slice(0, n).map((s) => ({ ...s, id: crypto.randomUUID() }))
  const shades = await supabase.from('shades').insert(picked.map((s) => ({ id: s.id, name: s.name, guise: s.guise, test: true })))
  if (shades.error) throw new Error(shades.error.message)
  const confessions = await supabase.from('confessions').insert(picked.map((s) => ({ shade_id: s.id, sin: s.sin, talent: s.talent, bargain: s.bargain })))
  if (confessions.error) throw new Error(confessions.error.message)
}
