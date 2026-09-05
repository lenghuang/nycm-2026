import type { EffortLevel } from './types';

export type EffortTheme = { accent: string; deep: string; label: string };
const themes: Record<EffortLevel, EffortTheme> = {
  RECOVERY: { accent: '#63d6c0', deep: '#093941', label: 'RECOVERY' },
  CONTROLLED: { accent: '#69bae9', deep: '#10345a', label: 'CONTROLLED' },
  SURGE: { accent: '#f47e81', deep: '#56232e', label: 'SURGE' },
  FINISH: { accent: '#ffd45e', deep: '#594a1a', label: 'FINISH' },
  TEST: { accent: '#c9a6ff', deep: '#342855', label: 'TEST' },
};
export const themeFor = (effort: EffortLevel): EffortTheme => themes[effort];
