// Help text for prompts, only for unusual words (common ones like "Devil Fruit" or "bounty" get none).
// Two kinds:
//   note    - a short line in brackets under the prompt, always shown ("letters only, spaces don't count")
//   explain - shown when the player taps the "?" next to the prompt ("What's an epithet?")
// A prompt in js/questions.js can also set its own `note` / `explain`; those win.
// Rules are checked in order and every match adds its text (at most one note and one explanation).
(function () {
  "use strict";
  const ZODIAC = {
    Aries: "Mar 21 – Apr 19", Taurus: "Apr 20 – May 20", Gemini: "May 21 – Jun 20", Cancer: "Jun 21 – Jul 22",
    Leo: "Jul 23 – Aug 22", Virgo: "Aug 23 – Sep 22", Libra: "Sep 23 – Oct 22", Scorpio: "Oct 23 – Nov 21",
    Sagittarius: "Nov 22 – Dec 21", Capricorn: "Dec 22 – Jan 19", Aquarius: "Jan 20 – Feb 18", Pisces: "Feb 19 – Mar 20"
  };
  window.PROMPT_HINTS = [
    { re: /epithet/i, explain: "An epithet is the nickname in front of a name, like “Pirate Hunter” Zoro or “Fire Fist” Ace." },
    { re: /initials/i, note: "first letter of each part of their full name; “D.” doesn't count",
      explain: "Initials are the first letters of each part of a name: Roronoa Zoro is R and Z. The “D.” in names like Monkey D. Luffy is skipped." },
    { re: /letters? in their (full )?name/i, note: "letters only; spaces, dots and numbers don't count" },
    { re: /the letter [A-Z] in their name/i, note: "anywhere in their full name" },
    { re: /Conqueror'?s/i, explain: "Conqueror's Haki (Supreme King Haki) is the rare kind: the user's willpower can knock weaker people out cold." },
    { re: /Armament/i, explain: "Armament Haki (Busoshoku) turns willpower into invisible armour, often blackening the skin or a weapon." },
    { re: /Observation/i, explain: "Observation Haki (Kenbunshoku) lets the user sense people around them, and at its best see a moment into the future." },
    { re: /Logia/i, explain: "Logia fruits turn the user into an element, like fire, smoke, sand or ice." },
    { re: /Mythical Zoan/i, explain: "Mythical Zoans let the user become a creature from legend, like a phoenix or a dragon." },
    { re: /Ancient Zoan/i, explain: "Ancient Zoans let the user become a prehistoric animal, like a dinosaur or mammoth." },
    { re: /Zoan/i, explain: "Zoan fruits let the user turn into an animal, or a half-animal form." },
    { re: /Paramecia/i, explain: "Paramecia is the biggest group of fruits: superhuman powers that aren't animals or elements, like rubber or slicing." },
    { re: /Will of D|Clan of D/i, explain: "Characters with “D.” in their full name, like Monkey D. Luffy or Portgas D. Ace." },
    { re: /Worst Generation|Supernova/i, explain: "The young pirates with 100,000,000+ bounties who reached Sabaody around the same time as Luffy, plus Blackbeard." },
    { re: /Four Emperors|Yonko/i, note: "any era counts", explain: "The Four Emperors (Yonko) are the four most powerful pirate captains ruling the New World." },
    { re: /Seven Warlords|Shichibukai/i, note: "former members count", explain: "The Seven Warlords (Shichibukai) were pirates allowed to act freely in exchange for working with the World Government." },
    { re: /Six Powers|Rokushiki/i, explain: "Six Powers (Rokushiki) are the government's superhuman body techniques, like Soru (speed) and Tekkai (iron body)." },
    { re: /Fish-?Man Karate/i, explain: "A martial art that uses the water in the air and in the body, practised by fish-men." }
  ];
  // q = prompt object -> { note, explain } (either may be empty)
  window.hintFor = function (q) {
    let note = q.note || "", explain = q.explain || "";
    for (const h of window.PROMPT_HINTS) {
      const m = h.re.exec(q.text || "");
      if (!m) continue;
      if (!note && h.note) note = typeof h.note === "function" ? h.note(m) : h.note;
      if (!explain && h.explain) explain = h.explain;
      if (note && explain) break;
    }
    return { note, explain };
  };
})();
