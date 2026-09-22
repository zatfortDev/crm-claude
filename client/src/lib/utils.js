import { clsx } from 'clsx';

/** Combina clases condicionalmente. */
export function cn(...inputs) {
  return clsx(inputs);
}
