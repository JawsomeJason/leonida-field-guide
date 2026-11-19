// The queries that must each find the right answer: [what the player types, the id, or the ids any of which may come first, the console chosen (default ps5)].
// FIXTURE_QUERIES run over tests/fixtures/answers (unit test and Playwright). The real answers are covered by questions.json.
export const FIXTURE_QUERIES = [
  ['how do i quicksave', 'find-save'],
  ['how do i save my game', 'find-save'],
  ['what are the controls', 'find-controls'],
  ['controls', 'find-controls'],
  ['how big is the instal on my playstaton', 'find-install'],
  ['will it fit on my Series S', 'find-install'],
  ['how much space on 512GB drive', 'find-install'],
  ['my code does not work', 'find-code'],
  ['how do i svae my game', 'find-save'], // two swapped letters are one typo
];
