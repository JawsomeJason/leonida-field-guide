// The queries that must each find the right answer: [what the player types, the id, or the ids any of which may come first, the console chosen (default ps5)].
// FIXTURE_QUERIES run over tests/fixtures/answers; REAL_QUERIES over src/content/answers, as the page filters them by console.
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
export const REAL_QUERIES = [
  ['how do i quicksave', 'how-to-save'],
  ['how do i save my game', 'how-to-save'],
  ['what are the controls', 'control-schemes'],
  ['controls', 'control-schemes'],
  ['how big is the instal on my playstaton', 'install-size-and-preload'],
  ['will it fit on my Series S', 'series-s-space', 'xbox-s'], // the answer written for that console
  ['how much space on 512GB drive', 'series-s-space', 'xbox-s'],
  ['my code does not work', 'missing-or-rejected-code'],
  ['my game crashes', ['crash-steps-ps5', 'crashes-and-launch-problems']],
  ['game keeps crashing', ['crash-steps-ps5', 'crashes-and-launch-problems']],
  ['my game crashes', ['crash-steps-xbox', 'crashes-and-launch-problems'], 'xbox-x'],
  ['game keeps crashing', ['crash-steps-xbox', 'crashes-and-launch-problems'], 'xbox-s'],
  ['how do i free up space on my ps5', 'free-space-ps5'],
];
