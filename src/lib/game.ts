// Shared game types. Rows from Supabase are mapped to these in src/lib/api.ts.

export type Phase =
  | 'lobby' | 'intro'
  | 'r1_intro' | 'r1_vote' | 'r1_reveal'
  | 'r2_intro' | 'r2_write' | 'r2_vote' | 'r2_reveal'
  | 'r3_intro' | 'r3_vote' | 'r3_reveal'
  | 'finale' | 'after'

export type Realm = 'elysium' | 'asphodel' | 'tartarus'

// Reveal order: the condemned first, the blessed last.
export const REALMS: Realm[] = ['tartarus', 'asphodel', 'elysium']

export interface GameState { phase: Phase; step: number; deadlineAt: string | null }

export interface Shade {
  id: string; name: string; guise: string | null; portraitPath: string | null
  hidden: boolean; realm: Realm | null; late: boolean; test: boolean; createdAt: string
}

export interface Confession { shadeId: string; sin: string | null; talent: string | null; bargain: string | null }

export interface Vote { voterId: string; round: 1 | 2 | 3; item: number; choice: string }

export type Reason = 'guess' | 'fooled' | 'framed' | 'votes' | 'sweep' | 'bet'

export interface Award { shadeId: string; amount: number; round: 1 | 2 | 3; item: number; reason: Reason }

// text may contain '[Name]', filled in with a shade's name when Round 2 is built.
export interface Prompt { text: string; note?: string }

export interface R1Item { idx: number; text: string; authorId: string | null; correct: number | null; guessers: number | null }

export interface Matchup {
  idx: number; prompt: string; note: string | null; subjectId: string | null; opened: boolean
  answerA: string | null; answerB: string | null; writerA: string | null; writerB: string | null
  votesA: number | null; votesB: number | null
}

// Keys for hidden_items.ref.
export const confessionRef = (shadeId: string, field: 'sin' | 'talent' | 'bargain') => `${shadeId}:${field}`
export const answerRef = (matchup: number, writerId: string) => `${matchup}:${writerId}`
