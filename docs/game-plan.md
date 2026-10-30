# The Trial of the Shades: game plan

Guests create a "shade" on their phone when they arrive. At 23:00 everyone plays a 30-minute game on the TV, The Trial of the Shades, built from what they submitted. The rest of the night stays phone-free.

- **No mythology knowledge needed.** The game explains any lore in one line. The jokes come from the guests, not the myths.
- **Phones come out twice.** About 2 minutes on arrival, about 30 minutes at the Trial.
- **Sized for about 15 guests.** Anyone who arrives after 23:00 can still join mid-Trial with a quick shade (see [Late arrivals](#late-arrivals)).
- **Hades and Persephone host.** The screen gives you lines to read, so you can play along rather than run a show.
- **One background game with no phones.** Persephone's Seeds runs from 21:00 until the Trial.

How it's built: see the [technical spec](tech-spec.md).

## Arrival: create your shade

A QR code by the door opens a short form that takes about 2 minutes. The same QR code is on a card on the kitchen island and in a corner of the TV.

**Welcome screen**

> You have crossed the river Styx. Before the Court can receive you, tell us who you were.

**The form**

1. **Mortal name.** "What did the living call you?"
2. **Guise.** "Who or what have you come as?" Hint under the field: *Anything counts: a god, a ghost, or simply dark and elegant.*
3. **Portrait.** "The Court keeps a likeness of every soul." A photo of their costume, with retakes allowed.
4. **Three confessions.** These feed the game, and they stay anonymous until the Trial reveals them.
   - "What sin sent you to the Underworld?" Example: *I reply-all to company-wide emails.*
   - "What is your most suspicious talent?" Example: *I can name every IKEA product in my flat.*
   - "What would you bargain with Hades for?" Example: *One more hour of sleep, every night, forever.*

A line under the confessions keeps it light: *Keep it something you'd say at a party. The Court reads these aloud.*

**Closing screen**

> Your shade is recorded. Return to the living for now. The Court convenes at eleven.

After that the phone shows only the countdown, so there's no reason to keep looking at it.

### Late arrivals

Guests who scan the QR code after the Trial has started get a shorter form: mortal name and portrait only, no guise and no confessions.

> The Court is already in session. Give us your name and your likeness, and take your seat among the shades.

A late shade votes as soon as they join and can earn obols for correct guesses in Round 1. They have no confessions, so they aren't guessed in Round 1, don't write in Round 2 and aren't judged in Round 3. Their portrait joins the Hall of Shades afterwards.

## The Trial: how the shared game works

The Trial is a 30-minute, three-round game show on the TV, presided over by Hades and Persephone. Phones become controllers: guests reopen the same link and see only buttons and a text box, never the game itself.

| Round | What happens | Time | Points |
| --- | --- | --- | --- |
| 1. Whose Sin Is It? | Guess who wrote each anonymous confession | ~8 min | 1 obol per correct guess. The author gets 1 obol per person fooled |
| 2. Petitions to Hades | Write funny answers to prompts; the room votes | ~12 min | 1 obol per vote; 2 bonus for winning every vote |
| 3. The Judgment | The room sends each shade to Elysium, Asphodel or Tartarus | ~6 min | None; it's the finale verdict |

The shade with the most obols is named **Favored of Hades** at the end. Scores stay hidden until then: no running totals on phones or the TV, and the full leaderboard appears only at the finale.

**Host controls.** The hosts run the game from a remote on a phone: Next, extra time, and hiding any confession or answer you don't want on screen. The TV shows only the game. You never type during the game.

**Opening lines**

> **Hades:** Silence, shades. The Court is in session.
>
> **Persephone:** Tonight we decide where each of you spends eternity. Your phones are your voice in this court. Use them wisely.

The TV then explains obols in one line: *Obols are the coins the dead pay Charon, the ferryman. Earn the most and Hades will favor you.*

## Round 1: Whose Sin Is It?

Eight anonymous confessions go up one at a time, and the room guesses who wrote each. It works as an icebreaker because everyone learns something odd about each other.

1. The TV shows a confession, drawn from the sins and talents: *This shade confesses: "I can name every IKEA product in my flat."*
2. Phones show every other shade's name and portrait. Everyone picks one within 20 seconds. The author sees the same screen, titled "Frame a shade", and earns 1 obol for every guesser who lands on the person they framed. From across the room, everyone looks the same.
3. The TV reveals the author's portrait and how many guessed right.

**Reveal lines** (the game picks one based on how many guessed right)

- Most guessed right: *Your reputation precedes you, shade.*
- About half: *Guilty. The scales do not lie.*
- A few (under a quarter): *Only the sharpest eyes in the Court saw through you.*
- Nobody: *No one suspected. The Court is impressed, and slightly worried.*

**Round intro**

> **Persephone:** Every shade has confessed. Your task is to name the sinner.

## Round 2: Petitions to Hades

This is a Quiplash-style writing round. Each prompt goes to two guests, and everyone else votes for the funnier answer. With 15 guests that's 15 prompts, two per person, written in 90 seconds.

1. Each phone shows two prompts and a text box.
2. The TV shows each prompt with its two answers side by side, unsigned.
3. Everyone votes. The two authors see the same voting screen, but their tap is a bet on which answer will win, worth 1 obol if right. Then the TV reveals the authors and the vote split.

**Prompts** (names and portraits fill in automatically; a one-line lore note appears where needed)

- Why should Hades release [Name] back to the living?
- [Name] has been made a minor god. They are the god of...
- [Name]'s eternal punishment: forever having to...
- [Name]'s ghost will haunt...
- What Charon says to passengers who don't tip. *Charon rows the dead across the river, for a coin.*
- What Cerberus's third head is thinking. *Cerberus is Hades' three-headed guard dog.*
- Persephone was trapped by six pomegranate seeds. What's the worst snack to be trapped by?
- The River Styx's one-star review.
- The fine print on tonight's invitation.
- Rejected names for the Underworld.
- What the dead complain about most.
- Hades' dating profile bio.
- The worst thing to bring to the Underworld as a hostess gift.
- Zeus has finally RSVP'd. His excuse for being late:
- A new rule for the Court Below, starting tonight.

**Spare prompts** (used only with more than 15 players)

- [Name]'s last words before crossing the river:
- The one thing [Name] would smuggle past Cerberus. *Cerberus is Hades' three-headed guard dog.*
- A terrible name for a cocktail served in the Underworld.
- What Sisyphus would do if he ever got the boulder to the top. *Sisyphus pushes a boulder uphill for eternity.*
- Hades' least favourite party guest, and why.

**Round intro**

> **Hades:** Shades may petition the Court. The most persuasive will be remembered. The rest will be forgotten, as usual.

## Round 3: The Judgment

Each shade's portrait, guise and bargain appear for 12 seconds, and the room votes on where they spend eternity. Votes stay hidden until a grand reveal at the end. A majority decides. A tie, or no votes at all, leaves the shade in Asphodel, though Persephone can overrule out loud.

**Round intro**

> **Hades:** In the old world, every soul stood before three judges. Tonight, you are the judges. Choose wisely, or at least choose quickly.

**The three realms** (shown on the TV before voting; the same lines label the buttons on phones)

- **Elysium.** The Elysian Fields: endless golden afternoons, soft music and the good wine. Reserved for heroes, the virtuous, and anyone who truly committed to their costume.
- **Asphodel.** The Asphodel Meadows: a grey field of pale flowers where most souls drift forever. Not a punishment. Not a reward. For those who lived a perfectly pleasant, entirely forgettable life.
- **Tartarus.** The pit beneath the Underworld, where the gods send their worst. Sisyphus is down there pushing his boulder uphill for eternity. Reserved for villains, tricksters, and anyone caught double-dipping at the snack table.

**The reveal** (realm by realm, portraits filling the screen)

> **Hades:** First, those condemned to Tartarus.
>
> **Persephone:** Then those who will drift in Asphodel.
>
> **Hades:** And finally, the blessed of Elysium.

**Closing lines**

> **Persephone:** The judgment is spoken. Elysium, the good wine is yours. Asphodel, drift on. Tartarus, the bar is still open, but we are watching you.
>
> **Hades:** And the shade most favored by Hades tonight is... [Name]. The Court is adjourned. Revel on.

## Persephone's Seeds (background game, no phones)

Six red stickers circulate from 21:00, and anyone wearing one when the Trial starts is "bound to the Underworld." It needs no phones and almost no explaining.

**Setup.** Six guests get a small envelope with one red dot sticker (about 13 mm) and the rules. A card by the door tells everyone else that seeds are loose.

**Rules card**

> Persephone ate six pomegranate seeds and was bound to the Underworld forever. Tonight, six seeds are loose among you.
>
> If you hold a seed, place it on another shade without being seen. If you find a seed on yourself, it's now yours to pass on. Caught in the act? The seed stays on you.
>
> At eleven, the Court will see who is still bound.

**At the Trial.** Before Round 1, Hades asks the bound shades to step forward (in his own words; the TV shows only the toast). Their forfeit: each one raises a glass and says one line to the hosts, such as "To the Court Below, may we never leave." The room drinks with them.

## Run of show

The Trial sits at 23:00, three hours in. Most guests have arrived by then and there's still energy left.

| Time | What happens | On the TV |
| --- | --- | --- |
| 19:30 | Laptop casting, playlist on the speaker, QR cards out, seed envelopes ready | Hall of Shades: dark portrait gallery, small QR code in a corner |
| 20:00 | Doors open; guests create shades on arrival | Hall of Shades fills as guests arrive |
| 21:00 | Persephone's Seeds announced once | Hall of Shades |
| 22:45 | Last call to create a full shade (later arrivals get the quick form) | Hall of Shades |
| 23:00 | Music down; the Trial opens; bound shades step forward | Opening lines |
| 23:05 | Round 1: Whose Sin Is It? | Game |
| 23:13 | Round 2: Petitions to Hades | Game |
| 23:25 | Round 3: The Judgment, reveal, Favored of Hades | Game |
| 23:35 | Phones away; music back up; party continues | Hall of Shades, each portrait labeled with its realm |

## TV, music and photos

- **TV.** A laptop casts the `/tv` page to the Chromecast. Outside the Trial it shows the Hall of Shades: a slow, dark gallery of portraits with each shade's name and guise, and a small QR code in one corner. Brightness down, so it reads as decor rather than a screen to watch.
- **Music.** The Spotify playlist plays on the speaker all night. Turn it down for the Trial and back up afterwards.
- **Joining.** One link for both arrival and the Trial, on a QR code printed on 2–3 cards and shown on the TV.
- **Wi-Fi.** Print the guest Wi-Fi name and password on the QR cards, since phones need internet throughout.
- **Fallback.** If casting fails, turn the laptop screen toward the room. Rounds 1 and 3 still work that way.
- **Photos.** The photo booth and the shared Google Photos album stay separate from the game. Guests add booth photos through the album's own QR code. After the party, the game's portraits can be downloaded and added to the same album.

## Open decisions

- [ ] Is 23:00 the right time for the Trial?
- [ ] Is the portrait photo required or optional? If it's optional, Rounds 1 and 3 show the name and guise instead. (The app treats it as optional for now; screens show the name's initial.)
- [ ] What is the prize for Favored of Hades? Does Elysium get a perk too?
- [ ] Is the Tartarus copy the right roast level for this crowd?
- [ ] Which six guests start with seeds? Sociable early arrivals work best.
