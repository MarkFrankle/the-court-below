// Round 2 prompts, verbatim from docs/game-plan.md. '[Name]' is filled in with a shade who isn't writing it.
import type { Prompt } from '../lib/game'

const CERBERUS = "Cerberus is Hades' three-headed guard dog."

export const PROMPTS: Prompt[] = [
  { text: 'Why should Hades release [Name] back to the living?' },
  { text: '[Name] has been made a minor god. They are the god of...' },
  { text: "[Name]'s eternal punishment: forever having to..." },
  { text: "[Name]'s ghost will haunt..." },
  { text: "What Charon says to passengers who don't tip.", note: 'Charon rows the dead across the river, for a coin.' },
  { text: "What Cerberus's third head is thinking.", note: CERBERUS },
  { text: "Persephone was trapped by six pomegranate seeds. What's the worst snack to be trapped by?" },
  { text: "The River Styx's one-star review." },
  { text: "The fine print on tonight's invitation." },
  { text: 'Rejected names for the Underworld.' },
  { text: 'What the dead complain about most.' },
  { text: "Hades' dating profile bio." },
  { text: 'The worst thing to bring to the Underworld as a hostess gift.' },
  { text: "Zeus has finally RSVP'd. His excuse for being late:" },
  { text: 'A new rule for the Court Below, starting tonight.' },
  // Spares, so up to 20 players work. Drafted by Claude, approved by Mark on 30 October.
  { text: "[Name]'s last words before crossing the river:" },
  { text: 'The one thing [Name] would smuggle past Cerberus.', note: CERBERUS },
  { text: 'A terrible name for a cocktail served in the Underworld.' },
  { text: 'What Sisyphus would do if he ever got the boulder to the top.', note: 'Sisyphus pushes a boulder uphill for eternity.' },
  { text: "Hades' least favourite party guest, and why." },
]
