// Plain words, as a checked rule (docs/spec.md, "First content", Plain words). One object per term; add a term here and
// `npm run check:plain-words` holds every page, script string and record to it.
//   term:  the word as a player meets it (for the message)
//   forms: finds it in text (global, case-insensitive)
//   means: finds the plain words that explain it. The first use on a page must have its plain words in the same sentence,
//          before it or after it: "saves copied online (synced)" and "downloading before launch (pre-load)" both pass.
//   plain: the replacement or short definition to write
// A source's own title (an outside link's text) stays as written and is not read.
export const jargon = [
  { term: 'pre-load', forms: /\bpre-?load\w*/gi, means: /before (?:the )?(?:launch|release)|ahead of launch|before it (?:launches|comes out)/i, plain: 'downloading before launch' },
  { term: 'licence', forms: /\blicen[cs]e\w*/gi, means: /right to (?:play|use)|what you (?:bought|paid)|you (?:bought|own)/i, plain: 'your right to play' },
  { term: 'sync', forms: /\bsync(?:s|ed|ing|hron\w+)?\b/gi, means: /cop(?:y|ies|ied|ying) (?:\w+ )?(?:online|to|between)|saved online|kept online|online (?:copy|store)|updated everywhere|across (?:your )?devices/i, plain: 'copied online' },
  { term: 'cross-progression', forms: /\bcross-?progression\b/gi, means: /progress (?:shared|moving|that moves|carr\w+|moves)|between (?:consoles|console families)/i, plain: 'progress shared between consoles' },
  { term: 'Optimized for Series X|S', forms: /\bOptimized for Series X\|S/g, means: /\b(?:store )?label\b|\bbadge\b|\btag\b/i, plain: 'the store label for games made for the newer Xbox consoles' },
  { term: 'Storage Expansion Card', forms: /\bStorage Expansion Cards?\b/gi, means: /plug-?in|slots? in(?:to)?|extra storage|more storage|extra room|add-on/i, plain: 'the plug-in storage card' },
  { term: 'internal SSD', forms: /\binternal (?:SSD|drive)\b/gi, means: /built-?in|inside the console|the console's own/i, plain: "the console's built-in storage" },
  { term: 'hard save', forms: /\bhard saves?\b/gi, means: /save (?:you|it) (?:make|do)|by hand|on purpose|manual(?:ly)?|choose to save|save yourself/i, plain: 'a save you make yourself' },
  { term: 'PSSR', forms: /\bPSSR\b/g, means: /sharpen|upscal|sharper|clearer picture|boost/i, plain: 'a sharpening boost' },
  { term: 'power cycle', forms: /\bpower[- ]?cycl\w*/gi, means: /fully off and (?:back )?on|off and on again|unplug/i, plain: 'switch it fully off and on again' },
  { term: 'region-locked', forms: /\bregion-locked\b/gi, means: /one country|only (?:in|works in)|limited to/i, plain: 'limited to one country' },
  { term: 'cloud saves', forms: /\bcloud saves?\b/gi, means: /saves? (?:kept|stored|backed up|copied) online|online (?:copy|backup)|backed up online|kept online/i, plain: 'saves kept online' },
  { term: 'HDR', forms: /\bHDR\b/g, means: /bright/i, plain: 'extra-bright picture' },
  { term: 'ray tracing', forms: /\bray[- ]trac\w+/gi, means: /light(?:ing)?|reflections?|shadows?/i, plain: 'realistic reflections and lighting' },
  { term: 'temporal upscaling', forms: /\btemporal upscal\w+/gi, means: /sharpen|sharper|lower(?:-| )resolution|clearer/i, plain: 'a sharpening method' },
  { term: 'FSR', forms: /\bFSR(?: \d)?\b/g, means: /sharpen|upscal|sharper|clearer|boost/i, plain: 'a sharpening boost' },
  { term: 'infostealers', forms: /\binfostealers?\b/gi, means: /steal\w* (?:your )?(?:passwords|logins|details)|password[- ]stealing/i, plain: 'programs that steal passwords' },
  { term: 'reticle', forms: /\breticle\b/gi, means: /crosshair|aiming (?:dot|mark|point)|aim marker/i, plain: 'the aiming mark' },
  { term: 'haptic feedback', forms: /\bhaptic feedback\b/gi, means: /vibrat\w+|rumble|buzz/i, plain: 'controller vibration' },
];
