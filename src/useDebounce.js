import { useState, useEffect } from "react";

/**
 * useDebounce
 * Delays updating the returned value until `delay` milliseconds have elapsed
 * after the last time `value` changed.
 */
export default function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
