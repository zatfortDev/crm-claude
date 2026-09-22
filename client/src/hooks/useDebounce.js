import { useEffect, useState } from 'react';

/** Devuelve el valor tras `delay` ms sin cambios (evita una petición por tecla). */
export function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
