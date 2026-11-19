import raw from './new.json';

export type NewEntry = {
  date: string;
  changed: string[];
  problems: { text: string; fix: string }[];
};

export const newEntries: NewEntry[] = raw;
