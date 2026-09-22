import { useCallback, useRef } from 'react';

export function useThrottle<T extends (...args: any[]) => any>(callback: T, delay: number): T {
  const isThrottled = useRef(false);
  const callbackRef = useRef(callback);

  // Keep the latest callback reference
  callbackRef.current = callback;

  return useCallback((...args: Parameters<T>) => {
    if (isThrottled.current) return;
    
    isThrottled.current = true;
    const result = callbackRef.current(...args);

    setTimeout(() => {
      isThrottled.current = false;
    }, delay);

    return result;
  }, [delay]) as T;
}
