// The developer journal shown by Settings > Developer Updates, newest day first. ONE ENTRY PER DAY, written for players in plain, friendly
// words: when more changes land on a day that already has an entry, edit that entry to describe where things ended up (never list the
// steps we took on the way, or things that were replaced the same day). After editing, run `node tools/gen-journal.js` to refresh the
// Windows app's copy (src/JournalData.cs) and bump the cache version in web/sw.js.
// This file is plain data (the generator reads it), so keep it to one object per day: { date: 'YYYY-MM-DD', title, notes: [...] }.
export const JOURNAL = [
  {
    date: '2026-10-17',
    title: 'New heroes, scrolls and Tavern Stamps',
    notes: [
      'Meet the Tavern Stamp! Finish a whole year and the tavern gives you a red stamp. You keep your stamps from adventure to adventure, and the count sits next to your gold while you play.',
      'Before each adventure you can visit the new Tavern Shop (the red stamp button at the top left). Ten stamps unlock a new hero for good: the Paladin or the Shadow Knight.',
      'The Paladin is dark-skinned, black-bearded and dressed in white and gold plate, with a shield in the hand that faces the monsters. Every minute he raises a Shield Wall over whoever is first in line, and for a while that hero\'s hits land on the Paladin instead. If the Paladin is the one in front, he takes only half damage. At the front he fights up close; from anywhere else in the line he sends out a beam of light that hurts monsters over a couple of seconds.',
      'The Shadow Knight is a pale, black-haired fighter in dark armour with a violet scarf and cape. He swings a scythe when he is first or second in line, and drains a little life from the monster to heal your weakest hero as his special skill.',
      'Scrolls have arrived! Tough monsters like the Gargogryph, Wickedgryph and Toucan sometimes drop one, and your party picks it up on its own. Paca\'s skill is now Scroll Storage +1, so with her you can carry two. There is a new Scroll button under the item button: tap it to use a scroll, or hold it to look at your slots. If you are full you choose what to throw away, and you can carry duplicates (each takes a slot).',
      'The first scroll is the Rereviver. Use it on a hero and for one year, if they faint, they jump straight back up on the spot with half their health.',
      'The Blue Potion is now the Revive Potion (10 coins at the Merchant, and you start every adventure with one). It wakes a fainted hero with half their health, at the back of the line. Healing Potions no longer work on a hero who has fainted: only a Revive Potion, a Rereviver or a night at the tavern can bring them back.',
      'You can now read this journal from the Settings menu. Hello!'
    ]
  },
  {
    date: '2026-10-16',
    title: 'Everyone learns to walk (properly)',
    notes: [
      'Every hero and every monster now has a proper walking animation, with arms swinging and feet taking turns. We tidied the legs on the Light Mage, Fire Mage, Fae and Druid so their feet stay nice and separate, and the Light Mage now looks straight ahead like everyone else.',
      'The Druid got a makeover: antlers, moss, pointed elf ears and a snug green leather top. Their Natural Toxin now falls to the ground and fades if the monster is too far away.',
      'A friendly Old Man now steps in the first time a hero gets badly hurt (below 25 HP). He pauses the game and shows you how to use a Healing Potion, then reminds you to collect gold coins for more. Healing Potion I is now selected from the start.',
      'New Quality setting in the Settings menu. Slide between Low, Medium and High, or tick Auto and let the game choose for you based on how smoothly it is running. It is there on both the web and Windows versions.',
      'On the web, if you come back to the page after it was hidden or minimized, a short note tells you that the adventure paused while you were away.',
      'The inn now tells you what each choice does: Rest fully heals the party, and Reorganize swaps the positions of two heroes.'
    ]
  },
  {
    date: '2026-10-15',
    title: 'Tougher monsters, stronger heroes',
    notes: [
      'Heroes now grow stronger when they level up, gaining extra health that depends on their class (the Warrior gains the most). A hero who is hurt when they level up gets the new health too.',
      'Monsters got sturdier, with more health, and Year 4 brings three brand-new top-tier monsters: the Magma Shellra, the Percussive Orc and the Shadecrow. The Magma Shellra\'s fireball is lobbed through the air and bursts into flames across your first two heroes when it lands.',
      'The Fire Mage\'s fireball now burns out into ash if it travels too far.',
      'The level-up screen is clearer: heroes you have not picked dim down, and the LEVEL UP button waits until you choose someone. Giving a crystal now shows your heroes in the scene, glowing crystal-blue.',
      'We zoomed the scene out a little so a full party and the monsters always fit on screen.',
      'The DEFEAT and NEW RECORD screens have nicer storybook lettering.',
      'Windows app: the Compendium cards no longer draw over the title bar or tabs while you scroll.'
    ]
  },
  {
    date: '2026-10-14',
    title: 'A new friend and a new foe',
    notes: [
      'The Druid joins the adventure! Their Natural Toxin poisons a monster for a few seconds, every ten seconds.',
      'Star Hats are more interesting now: each hero gets either a red hat (it heals a little over time) or a blue hat (it halves the damage they take). It is a coin flip, and the Fae can cast them again every three minutes.',
      'The Compendium now has two tabs, MONSTERS and PARTY, with how hard everyone hits, how often, and a few notes. There is an eye button to reveal everything at once.',
      'The Toucan has landed, and from Year 3 on! It slings sharp can tabs that slice through your whole party, so keep an eye on your health.'
    ]
  },
  {
    date: '2026-10-13',
    title: 'Tavern days and sharper tools',
    notes: [
      'The Thief now fires a crossbow when he cannot reach a monster in melee, and the Warrior\'s axe flies as soon as a monster is in range. Heroes at the front can now reach flying monsters that hover back.',
      'Every tavern visit now ends at the inn, where you can Rest or Reorganize. A tavern is waiting on the last day of each year, and from Year 2 there is another on the first day.',
      'The Merchant now visits only on the second day of each season, so stock up on potions when he arrives.',
      'The Blood Moon hits harder, and so do the monsters in general (we doubled their damage). The Nightmare has a taller scythe that cuts through the first two heroes in line.',
      'A borderless DEFEAT / NEW RECORD screen appears when the adventure ends, and fainted heroes no longer show a health bar while they ride in the cart.',
      'The start sign is now part of the scene, so your party walks in front of it. The Thief is the same height as the mages.',
      'Windows app: Play with nothing loaded opens the station picker, and the 1X-5X buttons show up in full screen.'
    ]
  },
  {
    date: '2026-10-12',
    title: 'A big day: items, health and smooth radio',
    notes: [
      'Heroes have health now! Monsters attack your party, hurt heroes show a health bar, and a hero who faints rides in a little pull cart at the back until they recover.',
      'Meet the Merchant. He sells Healing Potion I, which heals a chosen hero for 10 HP. Open your item disc (the item button) to use it in any view.',
      'Each adventure now begins at a campfire with a sign reading START THE RADIO, START YOUR ADVENTURE! Two random heroes are waiting there for you to choose from. The Thief, Fae, Light Mage and Fire Mage can now fight up close when they lead the party.',
      'Year 2 brings tougher monster variants: the Spiked Sheller, Bass Orc, Slasher and Wickedgryph.',
      'Paca got a whole new look as a tan llama with a colourful blanket, a pom-pom collar and a little black nose, and the Warrior is now orange and bearded.',
      'The radio got smoother: switching stations keeps the music flowing and cross-fades into the new one, and the scene shows the summoning effect while the next station loads. You can now add your own station by link, and every station has a SUPPORT link so you can tip the people who make it.',
      'Music and sound effects have separate volume sliders, and coins can only be collected while a radio station is playing. The web version also has a theme picker with eight colour themes.',
      'The tabs along the top are now Adventure, Radio and Local Music, with new rounded play-control icons.',
      'Windows app: the Radio tab has a Zone / Battle station picker, with a hotkey (Ctrl+Alt+B) and automatic switching between your zone music and battle music when the game says you are fighting.'
    ]
  },
  {
    date: '2026-10-11',
    title: 'Hello, Fantasy Radio Companion',
    notes: [
      'Fantasy Music Companion is now Fantasy Radio Companion!',
      'The adventure game came to life: monsters wander in, heroes have class traits, there are sound effects, a tuner for picking music and stations, a full-screen mode, and a Compendium of everything.',
      'The Warrior throws axes and the Gargogryph, a stone-skinned flying beast, makes its first appearance.',
      'The Merchant opened his shop with the Synergy Elixir, with an item bag and quick-use slots.',
      'There is now a web version you can play in your browser or add to your phone like an app.',
      'Spanish and Simplified Chinese are here, on both the web and Windows versions, and you can switch language on the fly.',
      'A settings cog with a Restart option, a full-screen now-playing pill, and a pop-up tuner that opens on whatever is playing.'
    ]
  },
  {
    date: '2026-10-09',
    title: 'The very first beta',
    notes: [
      'Fantasy Music Companion takes its first steps, with Folk Alley and DNBRadio as the starting radio stations. Thank you for being here at the beginning!'
    ]
  }
];
