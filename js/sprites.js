// Pixel sprites. Each sprite is rows of characters; each character is one pixel,
// looked up in the palette ("." = transparent). Edit freely: rows can be any length.
//
// To use your own art instead, save a PNG (transparent background, pixel art at 1x scale,
// e.g. assets/sprites/ship.png) and put its path in "file". It replaces the drawn sprite.
window.SPRITES = {
  palette: {
    k: "#1a1020", // outline
    w: "#f4ecd8", // sail
    s: "#d8cbb0", // sail shade
    b: "#8a4b2a", // hull
    B: "#5e3018", // hull dark
    y: "#f1c04a", // straw / gold
    r: "#c4553a", // red
    m: "#6b3a1e", // mast
    K: "#141018", // jolly roger
    g: "#3fae6a", // sea king
    G: "#23744a", // sea king dark
    e: "#fff7d6", // eye white
    p: "#e88bb0", // pink
    W: "#f7f5ee", // white hull / railing
    n: "#9aa3ad", // grey metal
    h: "#9a6a3a", // Merry's horns
    t: "#ff9a2a", // tangerines
    R: "#c8402c", // red stripes
    O: "#f08a24", // lion mane
    o: "#ffc24a", // lion face
    r: "#b8322a", // Sunny's red hull
    c: "#8fd8ff"  // windows
  },

  ship: {
    file: "",
    rows: [
      "...............kyyk",
      "...............kyyyyk",
      "...............kyyk",
      "...............km",
      "........kkkkkkkkmkkkkkkkk",
      "........kwwwwwwwmwwwwwwwk",
      ".......kwwwwwwwwwwwwwwwwwk",
      ".......kwwwwwKKKKKwwwwwwwk",
      ".......kwwwwKKKKKKKwwwwwwk",
      ".......kwwwwKwwKwwKwwwwwwk",
      ".......kwwwwKKKKKKKwwwwwwk",
      ".......kwwwwwKKwKKwwwwwwwk",
      ".......kwwKwwwKKKwwwKwwwwk",
      "........kwwKKwwwwwKKwwwwk",
      "........kwwwwKKwKKwwwwwwk",
      "........kwwKKwwwwwKKwwwwk",
      "........kssssssmsssssssk",
      "...............m",
      "kk.............m.............kkk",
      "kbkkkkkkkkkkkkkmkkkkkkkkkkkkkbbk",
      ".kbbbbbbbbbbbbbbbbbbbbbbbbbbbbk",
      ".kbbyybbyybbyybbyybbyybbyybbbbk",
      "..kBBBBBBBBBBBBBBBBBBBBBBBBBBk",
      "...kBBBBBBBBBBBBBBBBBBBBBBBBk",
      "....kkkkkkkkkkkkkkkkkkkkkkkk"
    ]
  },

  // The player's two ships (original designs): a small two-masted caravel to start, and a bigger brigantine after
  // the first ship's last voyage (story episode 312). Players whose spoiler filter is before that keep
  // the first ship. To use your own art, set "file" to a PNG (see the note under the second ship).
  merry: {
    file: "",
    rows: [
      "...........................kmmkkkkkk",
      "...........................kmmcccccck",
      "...........................kmmccccck",
      "...........................kmmkkkkk",
      "...........................kmmk",
      ".........................kkkmmkkk",
      "........................kmmmmmmmmk",
      "........................kmyyyyyymk",
      ".................kkkkkkkkmmmmmmmmkkkkkkkkk",
      "................kmmmmmmmmmmmkkmmmmmmmmmmmmk",
      ".................kwwwwwwwwwkwkwwwwwwwwwssmkkkkkkkk",
      "................kwwwwwwwwwwkwwkwwmmmmmmmmmmmmmmmmmk",
      "................kwwwwwwwwwkwwwkwwwwwwwwwkkwwwwwssk",
      "................kwwwwwwwwwkwwwwkwwwwwwwwkkwwwwwwssk",
      "...............kwwswwwswwkswwwskwwwwwwwkwwkwwwwwssk",
      "....kkkkkk......kwwwwwwwwkwwwwwwkwswwwskwwkwwwswwssk",
      "...kmKKKKKk.....kwwwwwwwkwwwwwwwkwwwwwkwwwkwwwwwssk",
      "...kmKKWKKk.....ksssssssksssssssskssssksssskssssssk",
      ".k.kmKKKKKk....kkkssssskssssssssskssssksssskssssssk",
      "kOkkmKKKKKk...kmmmmmmmmkmmmmmmmmmmkmmkmmmmmkmmmmmmmk",
      "yykkmkkkkkkkkkkkwwwwwwkwwwwwwwwwwwkwwkwwwwwwkwwwsswsk.........k",
      "kkyymyyyyyyyyyywwwwwwwkwwwwwwwwwwwwkwkwwwwwwkwwwwsswsk......kkmk",
      "..kWWWWWWWWWWWWwwwwwwkwwwwwwKKKwwwwkkwwwwwwwkwwwwsswwsk....kmmmk",
      "..kbbbbbbbbbbbwwwwwwwkwwwwwwwKwwwswwkswwwswwwkwwwssswwsk.kkmmmk",
      "..kbbbbbbbbbbbwwswwwkwwwswwwKKKwwwwwkwwwwwwwwkwwwsswwwwskmmmkk",
      "..kbbccbbccbbccwwwwwkwwwwwwKwKwKssskskssssssskssssswwwwsmkmk",
      "..kbbccbbccbbccsssskssssssKsssssKssksksssssssskssswwwwwwsmk",
      "..kbbbbbbbbbbbbbssskssssssssssssssksssksssskWWkwwwwwwwwwwsk",
      "..kbBBBBBBBBBBBbmmkmmmmmmmmmmmmmmmkmmmkmmmmmbbwwwwwwwwwwwwsk",
      "..kbbbbbbbbbbbbbkmkkmkkmkkmkmmkkmkkmkkmkmmkkbbbbbbbbmkkOkkk",
      "..kbbbbbbbbbbbbbWWWWWWWWWWWWmmWWWWWWWWWWmmWWbbbbbbbbbyyyk",
      "...kkyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyykyyyyk",
      "....kBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBkyyyk",
      "....kbbbbBbbbbbBbbbbbBbbbbbBbbbbbBbbbbbBbbbbbBbbbbbk.kyk",
      ".....kbbbBbbbbbBKKKbbBbbbbKKKbbbbBbbKKKBbbbbbBbbbbbk..k",
      ".....kBBBBBBBBBBKKKBBBBBBBKKKBBBBBBBKKKBBBBBBBBBBBk",
      "......kbbBbbbbbBbbbbbBbbbbbBbbbbbBbbbbbBbbbbbBbbbk",
      ".......kbBbbbbbBbbbbbBbbbbbBbbbbbBbbbbbBbbbbbBbbk",
      ".......kBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk",
      "........kBbbbbbBbbbbbBbbbbbBbbbbbBbbbbbBbbbbbBbk",
      "........kBbbbbbBbbbbbBbbbbbBbbbbbBbbbbbBbbbbbBk",
      "........kBkBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk",
      ".........k.kBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBkk",
      "............kBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk",
      ".............kBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk",
      "..............kkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
      "",
      ""
    ]
  },

  sunny: {
    // To use your own art: set file to a PNG, plus height (pixels tall in the game) and cutout: true
    // to remove a plain white background.
    file: "",
    rows: [
      "....................kbbbbbKKKKKk",
      "....................kbccccccbkk",
      "....................kbbbbbbbbk",
      "...........kkkkkkkkkkbbbbbbbbkkkkkkkkkkk..kkkkk",
      "..........kbbbbbbbbbbbbbbbbbbbbbbbbbbbbbkkRRRRRk",
      "...........kwwwwwwwwwwwwwwwwwwwwwwwwwwwkkkRRRRRk",
      "...........kwwwwwwwwwwwwwwwwwwwwwwwwwwwkbbkkkkk",
      "..........kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwbbkkkkkkkkkkk",
      "..........kwwwwwwwwwwwwwwwwwwwbbbbbbbbbbbbbbbbbbbbbbbk",
      "..........kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk",
      "..........kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk",
      "..........kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk",
      "..........kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk",
      "...........ksssssssssssssssssswwwwwwwwwwwwwwwwwwwwwwwk",
      ".........kkksssssssssssssssssswwwwwwwwwwwwwwwwwwwwwwwk",
      "........kbbbbbbbbbbbbbbbbbbbbbsssssssssssssssssssssssk",
      ".........kwwwwwwwwwwwwwwwwwwwwwssssssssssssssssssssskk",
      ".........kwwwwwwwwwwwwwwwKwwwbbbbbbbbbbbbbbbbbbbbbbbbbk",
      "........kwwwwwwwwwwwwwwwKKKwwwwwwwwwwwwwwwwwwwwwwwwwwk",
      "........kwwwwwwwwwwwwwwKwKwKwwwwwwwwwwwwwwwwwwwwwwwwwwk",
      ".kkkkkkkkwwwwwwwwwwwwwwwKKKwwwwwwwwwwwwwwwwwwwwwwwwwwwk",
      "kyyyyyyyywwwwwwwwwwwwwwwKKKwwwwwwwwwwwwwwwwwwwwwwwwwwwk",
      ".kbbbbbbbwwwwwwwwwwwwwKwwwwwKwwwwwwwwwwwwwwwwwwwwwwwwwk",
      ".kbbbbbbbwwwwwwwwwwwwwKkkKkkKwwwwwwwwwwwwwwwwwwwwwwwwwk",
      ".kbccccccwwwwwwwwwwwwwKwwwwwKwwwwwwwwwwwwwwwwwwwwwwwwwk.....k",
      ".kbcccccccssssssssssssssssssssssssssssssssswwwwwssssssk...kkbk",
      ".kbbbbbbbbssssssssssssssssssssssssssssssssswwwwwwssssyk..kbbbk",
      ".kbbbbbbbbbbbbbkkkkkkkkkbbkkkkkkkkkkkkkkbbkwwwwwwwkkkkkkkbbbk",
      ".kbcccccccccccbkkkkkkkkkbbkkkkkkkkkkkkkkbbkwwwwwwwwkyyybbbkk",
      ".kbcccccccccccbbbbbbbbbbbbbbbbbbbbbbbbbbbbbwwwwwwwwwOyyybyk",
      ".kbbbbbbbbbbbbbkbkkbkkbkbbkkbkkbkkbkkbkkbbkbkkbkkbkyyOyykk",
      ".kbbbbbbbbbbbbbkbkkbkkbkkbkkbkkbkkbkkbkkbkkbkkbkkbkyyyyyk",
      ".kbbbbbbbbbbbbbyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyybyyyk",
      "..krrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrykkkyk",
      "...krrrrrrrrKKKrrrrrKKKrrrrrKKKrrrrrKKKrrrrrKKKrrrkk...k",
      "...krrrrrrrrKKKrrrrrKKKrrrrrKKKrrrrrKKKrrrrrKKKrrrk",
      "....krrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrk",
      "....kyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyk",
      ".....kbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbk",
      ".....kbbBbbbbbBbbbbbBbbbbbBbbbbbBbbbbbBbbbbbBbbk",
      "......kbBbbbbbBbbbbbBbbbbbBbbbbbBbbbbbBbbbbbBbbk",
      "......kbBbbbbbBbbbbbBbbbbbBbbbbbBbbbbbBbbbbbBbk",
      ".......kBbbbbbBbbbbbBbbbbbBbbbbbBbbbbbBbbbbbBk",
      ".......kBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk",
      "........kBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk",
      ".........kBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk",
      "..........kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
      ""
    ]
  },

  seaKing: {
    file: "",
    rows: [
      "....kkkkk",
      "...kgggggk",
      "..kgggeekgk",
      "..kgggekkgk",
      ".kggggggggkkk",
      ".kgggggggggggk",
      "kgGGGkkkkkkkk",
      "kgGGkrrrrrrk",
      "kgGGGkkkkkkk",
      "kggGGGGGgggk",
      ".kgggGGGGggk",
      ".kggggGGGGgk",
      "..kggggGGGgk",
      "..kgggggGGgk",
      "..kgggggggk"
    ]
  },

  gull: {
    file: "",
    frames: [
      ["k...k", ".k.k.", "..k.."],
      [".....", "kkkkk", "..k.."]
    ]
  }
};
