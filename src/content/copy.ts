// Every on-screen line, verbatim from docs/game-plan.md. Change the game plan first, then this.
import type { Realm } from '../lib/game'

export type Speaker = 'Hades' | 'Persephone'
export interface Line { speaker: Speaker; text: string }

export const TRIAL_STARTS_AT = '2026-10-31T23:00:00+01:00'

export const arrival = {
  welcome: 'You have crossed the river Styx. Before the Court can receive you, tell us who you were.',
  lateWelcome: 'The Court is already in session. Give us your name and your likeness, and take your seat among the shades.',
  name: { label: 'Mortal name', question: 'What did the living call you?' },
  guise: { label: 'Guise', question: 'Who or what have you come as?', hint: 'Anything counts: a god, a ghost, or simply dark and elegant.' },
  portrait: { label: 'Portrait', question: 'The Court keeps a likeness of every soul.' },
  confessions: {
    sin: { question: 'What sin sent you to the Underworld?', example: 'I reply-all to company-wide emails.' },
    talent: { question: 'What is your most suspicious talent?', example: 'I can name every IKEA product in my flat.' },
    bargain: { question: 'What would you bargain with Hades for?', example: 'One more hour of sleep, every night, forever.' },
    note: "Keep it something you'd say at a party. The Court reads these aloud.",
  },
  closing: 'Your shade is recorded. Return to the living for now. The Court convenes at eleven.',
  recorded: 'Your shade is recorded',
}

export const opening: Line[] = [
  { speaker: 'Hades', text: 'Silence, shades. The Court is in session.' },
  { speaker: 'Persephone', text: 'Tonight we decide where each of you spends eternity. Your phones are your voice in this court. Use them wisely.' },
]

export const obolLine = 'Obols are the coins the dead pay Charon, the ferryman. Earn the most and Hades will favor you.'

// Persephone's Seeds. The plan has Hades call the bound shades forward but scripts no line for it,
// so the TV shows the toast they raise a glass to and Hades says the rest.
export const seeds = {
  title: "Persephone's Seeds",
  forfeit: 'To the Court Below, may we never leave.',
}

export const round1 = {
  title: 'Whose Sin Is It?',
  intro: { speaker: 'Persephone', text: 'Every shade has confessed. Your task is to name the sinner.' } as Line,
  confesses: 'This shade confesses:',
  frame: 'Frame a shade',
  reveal: {
    most: 'Your reputation precedes you, shade.',
    half: 'Guilty. The scales do not lie.',
    few: 'Only the sharpest eyes in the Court saw through you.',
    none: 'No one suspected. The Court is impressed, and slightly worried.',
  },
}

export const round2 = {
  title: 'Petitions to Hades',
  intro: { speaker: 'Hades', text: 'Shades may petition the Court. The most persuasive will be remembered. The rest will be forgotten, as usual.' } as Line,
  writing: 'The petitions are being written',
  // Shown to the two writers while the room votes; from the game plan's description of Round 2.
  bet: 'Your tap is a bet on which answer will win, worth 1 obol if right.',
  noPetition: 'The Court received no petition',
}

export const round3 = {
  title: 'The Judgment',
  intro: { speaker: 'Hades', text: 'In the old world, every soul stood before three judges. Tonight, you are the judges. Choose wisely, or at least choose quickly.' } as Line,
}

export const realms: Record<Realm, { name: string; description: string }> = {
  elysium: {
    name: 'Elysium',
    description: 'The Elysian Fields: endless golden afternoons, soft music and the good wine. Reserved for heroes, the virtuous, and anyone who truly committed to their costume.',
  },
  asphodel: {
    name: 'Asphodel',
    description: 'The Asphodel Meadows: a grey field of pale flowers where most souls drift forever. Not a punishment. Not a reward. For those who lived a perfectly pleasant, entirely forgettable life.',
  },
  tartarus: {
    name: 'Tartarus',
    description: 'The pit beneath the Underworld, where the gods send their worst. Sisyphus is down there pushing his boulder uphill for eternity. Reserved for villains, tricksters, and anyone caught double-dipping at the snack table.',
  },
}

// One line per reveal step, in REALMS order.
export const realmReveal: Record<Realm, Line> = {
  tartarus: { speaker: 'Hades', text: 'First, those condemned to Tartarus.' },
  asphodel: { speaker: 'Persephone', text: 'Then those who will drift in Asphodel.' },
  elysium: { speaker: 'Hades', text: 'And finally, the blessed of Elysium.' },
}

export const closing = {
  persephone: { speaker: 'Persephone', text: 'The judgment is spoken. Elysium, the good wine is yours. Asphodel, drift on. Tartarus, the bar is still open, but we are watching you.' } as Line,
  // [Name] is the Favored of Hades.
  hades: { speaker: 'Hades', text: 'And the shade most favored by Hades tonight is... [Name]. The Court is adjourned. Revel on.' } as Line,
  favored: 'Favored of Hades',
}

export const screens = {
  lookToTheCourt: 'Look to the Court',
  heardEnough: 'The Court has heard enough',
}
