export const stages = [
  { id: 'before', label: 'Before you start' },
  { id: 'hour-1', label: 'First hour' },
  { id: 'day-1', label: 'First day' },
  { id: 'week-1', label: 'First week' },
] as const;

export type Stage = (typeof stages)[number]['id'];
export const stageIds = stages.map((s) => s.id) as [Stage, ...Stage[]];
