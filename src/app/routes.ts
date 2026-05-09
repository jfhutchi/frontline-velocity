// Logical "routes" used to drive the AppShell. The app does not use a router;
// it uses Zustand store state to switch screens. This file documents the set
// of valid screens.

export type Screen =
  | 'menu'
  | 'briefing'
  | 'tactical'
  | 'directControl'
  | 'paused'
  | 'victory'
  | 'defeat';

export const SCREENS: Screen[] = [
  'menu',
  'briefing',
  'tactical',
  'directControl',
  'paused',
  'victory',
  'defeat',
];
