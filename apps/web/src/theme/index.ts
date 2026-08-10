export const THEMES = {
  referenceDark: { id: 'reference-dark', label: 'KODA Reference Dark', dark: true },
  neutralLight: { id: 'neutral-light', label: 'KODA Neutral Light', dark: false },
  midnight: { id: 'midnight-blue', label: 'KODA Midnight Blue', dark: true },
} as const;

export type ThemeId = (typeof THEMES)[keyof typeof THEMES]['id'];

const STORAGE_KEY = 'koda:theme';
const available = new Set<ThemeId>(Object.values(THEMES).map(theme => theme.id));

export function setTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === 'neutral-light' ? 'light' : 'dark';
  localStorage.setItem(STORAGE_KEY, theme);
  window.dispatchEvent(new CustomEvent('koda:theme-change', { detail: theme }));
}

export function getTheme(): ThemeId {
  const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
  return saved && available.has(saved) ? saved : THEMES.referenceDark.id;
}

export function initializeTheme() {
  setTheme(getTheme());
}
