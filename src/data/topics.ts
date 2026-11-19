// Order is the order of the tiles on /topics/.
export const topics = [
  { id: 'setup', label: 'Setup' },
  { id: 'settings', label: 'Settings' },
  { id: 'controls', label: 'Controls' },
  { id: 'saving', label: 'Saving' },
  { id: 'money', label: 'Money' },
  { id: 'getting-around', label: 'Getting around' },
  { id: 'bonuses', label: 'Bonuses' },
  { id: 'fixes', label: 'Fixes' },
  { id: 'good-to-know', label: 'Good to know' },
  { id: 'places', label: 'Places' },
] as const;

export type Topic = (typeof topics)[number]['id'];
export const topicIds = topics.map((t) => t.id) as [Topic, ...Topic[]];
