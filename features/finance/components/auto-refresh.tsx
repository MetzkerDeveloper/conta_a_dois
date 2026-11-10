'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/** Confere os valores atuais para preservar inclusive campos ainda não enviados. */
function hasUnsavedFields() {
  for (const field of document.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >('main form input, main form textarea, main form select')) {
    if (field.disabled) continue;
    if (field instanceof HTMLInputElement) {
      if (['hidden', 'submit', 'button', 'reset'].includes(field.type))
        continue;
      if (['checkbox', 'radio'].includes(field.type)) {
        if (field.checked !== field.defaultChecked) return true;
      } else if (field.value !== field.defaultValue) return true;
    } else if (field instanceof HTMLTextAreaElement) {
      if (field.value !== field.defaultValue) return true;
    } else {
      const defaults = Array.from(field.options)
        .filter((option) => option.defaultSelected)
        .map((option) => option.value);
      if (!defaults.length && !field.multiple && field.options[0])
        defaults.push(field.options[0].value);
      if (
        Array.from(field.selectedOptions)
          .map((option) => option.value)
          .join('\0') !== defaults.join('\0')
      )
        return true;
    }
  }
  return !!document.querySelector('main form[aria-busy="true"]');
}

export function AutoRefreshFinance() {
  const router = useRouter();
  const pathname = usePathname();
  const [paused, setPaused] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  useEffect(() => {
    let lastRefresh = -Infinity;
    const resume = () => {
      if (document.visibilityState !== 'visible') {
        lastRefresh = -Infinity;
        return;
      }
      if (!navigator.onLine) return;
      if (hasUnsavedFields()) {
        setPaused(pathname);
        return;
      }
      setPaused(null);
      // Focus e visibilitychange podem chegar juntos ao voltar à mesma aba.
      if (performance.now() - lastRefresh < 2000) return;
      lastRefresh = performance.now();
      startTransition(() => router.refresh());
    };
    const editing = () => setPaused(null);
    const away = () => {
      lastRefresh = -Infinity;
    };
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) resume();
    };
    window.addEventListener('blur', away);
    window.addEventListener('focus', resume);
    window.addEventListener('online', resume);
    window.addEventListener('pageshow', restored);
    document.addEventListener('visibilitychange', resume);
    document.addEventListener('input', editing);
    document.addEventListener('change', editing);
    document.addEventListener('submit', editing);
    return () => {
      window.removeEventListener('blur', away);
      window.removeEventListener('focus', resume);
      window.removeEventListener('online', resume);
      window.removeEventListener('pageshow', restored);
      document.removeEventListener('visibilitychange', resume);
      document.removeEventListener('input', editing);
      document.removeEventListener('change', editing);
      document.removeEventListener('submit', editing);
    };
  }, [router, pathname]);
  return paused === pathname ? (
    <p className="notice auto-refresh-note" role="status">
      Atualização automática pausada para preservar os campos que você está
      editando.
    </p>
  ) : null;
}
