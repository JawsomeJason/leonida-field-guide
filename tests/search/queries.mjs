// The queries that must each find the right answer: [what the player types, the id that must come first].
// FIXTURE_QUERIES run over tests/fixtures/answers; REAL_QUERIES (added once the real keywords are merged) over src/content/answers.
export const FIXTURE_QUERIES = [
  ['how do i quicksave', 'find-save'],
  ['how do i save my game', 'find-save'],
  ['what are the controls', 'find-controls'],
  ['controls', 'find-controls'],
  ['how big is the instal on my playstaton', 'find-install'],
  ['will it fit on my Series S', 'find-install'],
  ['how much space on 512GB drive', 'find-install'],
  ['my code does not work', 'find-code'],
];
export const REAL_QUERIES = [];
