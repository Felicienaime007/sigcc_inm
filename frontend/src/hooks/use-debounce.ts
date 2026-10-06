import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delai = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delai);
    return () => clearTimeout(t);
  }, [value, delai]);
  return debounced;
}