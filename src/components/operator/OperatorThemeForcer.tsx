import { useEffect } from 'react';

export const OperatorThemeForcer = () => {
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.classList.contains('dark') ? 'dark' : 'light';
    root.classList.remove('light', 'dark');
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
    root.style.colorScheme = 'dark';

    return () => {
      root.classList.remove('light', 'dark');
      root.classList.add(prev);
      root.setAttribute('data-theme', prev);
      root.style.colorScheme = prev;
    };
  }, []);

  return null;
};
