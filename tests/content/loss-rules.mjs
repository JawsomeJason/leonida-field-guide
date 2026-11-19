// Shared by tests/content/loss.test.mjs and tests/leak/loss-leak.test.mjs (round 5, the loss-warning rule in docs/spec.md "The spoiler dial").
// Round 7: the warning is two sentences. The second sends the player to the button under it; neither states a game rule.
export const WARNING = 'You can lose in-game money.';
export const GENERIC = `${WARNING} There is a simple way to keep it safe.`;
export const LABEL = 'Show how to keep it safe';

// What makes a sentence a game rule rather than a generic warning: who carries what, the bank and ATM, dying, loot, deposits, drops of cash.
// (A frame-rate "drop" is not a rule, so "drop" counts only beside cash, money or loot.)
export const RULE_SIGNALS = [
  /\bcarr(y|ied|ying)\b[^.]{0,30}\b(cash|money)\b|\b(cash|money)\b[^.]{0,30}\bcarr(y|ied)/i,
  /\bbank(ed|ing|s)?\b/i, /\bATMs?\b/, /\b(die|dies|died|dying|death)\b/i, /\bloot\b/i, /\bdeposit(s|ed|ing)?\b/i,
  /\bdrops?\b[^.]{0,20}\b(cash|money|loot)\b|\b(cash|money|loot)\b[^.]{0,20}\bdrops?\b/i,
];
export const rulesIn = (texts) => texts.flatMap((t) => RULE_SIGNALS.filter((re) => re.test(t)).map((re) => `${re}: "${t.slice(0, 70)}"`));

