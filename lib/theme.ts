export const THEME_STORAGE_KEY = 'contas-a-dois-theme';
export type ThemePreference = 'system' | 'light' | 'dark';
export function parseTheme(value: string | null | undefined): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

// Executado antes do conteúdo para aplicar a preferência sem um flash de outro tema.
export const themeScript = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:'system'}catch{document.documentElement.dataset.theme='system'}`;
