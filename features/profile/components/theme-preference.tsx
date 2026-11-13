'use client';

import { useState, useSyncExternalStore } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import {
  parseTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from '@/lib/theme';
import { useHydrated } from '@/lib/use-hydrated';

function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      document.documentElement.dataset.theme = parseTheme(event.newValue);
      callback();
    }
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener('theme-preference-change', callback);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('theme-preference-change', callback);
  };
}
const options = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Seguir o dispositivo', icon: Monitor },
] as const;

export function ThemePreference() {
  const hydrated = useHydrated();
  const preference = useSyncExternalStore(
    subscribe,
    () => parseTheme(document.documentElement.dataset.theme),
    () => 'system' as ThemePreference,
  );
  const [error, setError] = useState('');
  return (
    <fieldset className="theme-preferences" disabled={!hydrated}>
      <legend className="sr-only">Aparência</legend>
      {options.map(({ value, label, icon: Icon }) => (
        <label key={value} className="theme-option">
          <input
            type="radio"
            name="appearance"
            value={value}
            checked={preference === value}
            onChange={() => {
              document.documentElement.dataset.theme = value;
              setError('');
              try {
                localStorage.setItem(THEME_STORAGE_KEY, value);
              } catch {
                setError(
                  'O tema foi aplicado, mas este navegador não permitiu salvar a preferência.',
                );
              }
              window.dispatchEvent(new Event('theme-preference-change'));
            }}
          />
          <Icon size={20} aria-hidden="true" />
          <span>{label}</span>
        </label>
      ))}
      {error && (
        <p className="field-error" role="status">
          {error}
        </p>
      )}
    </fieldset>
  );
}
