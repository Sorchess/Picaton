/**
 * Debounce хуки для отложенных действий.
 *
 * useDebounce - возвращает дебаунсированное значение
 * useDebouncedCallback - возвращает дебаунсированную функцию
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

/**
 * Хук для дебаунса значения.
 *
 * @param value - Значение для дебаунса
 * @param delay - Задержка в мс
 * @returns Дебаунсированное значение
 *
 * @example
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearch = useDebounce(searchTerm, 500);
 *
 * useEffect(() => {
 *   // Выполнится через 500мс после последнего изменения
 *   fetchResults(debouncedSearch);
 * }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Хук для дебаунса callback функции.
 *
 * @param callback - Функция для дебаунса
 * @param delay - Задержка в мс
 * @returns Дебаунсированная функция
 *
 * @example
 * const handleSearch = useDebouncedCallback((query: string) => {
 *   fetchResults(query);
 * }, 500);
 *
 * <input onChange={(e) => handleSearch(e.target.value)} />
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const callbackRef = useRef(callback);

  // Обновляем ref при изменении callback
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Очищаем таймер при размонтировании
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = useMemo(() => {
    const fn = (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    };
    return fn as T;
  }, [delay]);

  return debouncedCallback;
}

/**
 * Хук для дебаунса с возможностью отмены и немедленного выполнения.
 *
 * @param callback - Функция для дебаунса
 * @param delay - Задержка в мс
 * @returns Объект с дебаунсированной функцией и методами управления
 */
export function useDebouncedCallbackWithControl<
  T extends (...args: unknown[]) => unknown
>(
  callback: T,
  delay: number
): {
  debouncedCallback: T;
  cancel: () => void;
  flush: () => void;
  isPending: boolean;
} {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const callbackRef = useRef(callback);
  const argsRef = useRef<Parameters<T> | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
      setIsPending(false);
    }
  }, []);

  const flush = useCallback(() => {
    if (timeoutRef.current && argsRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
      callbackRef.current(...argsRef.current);
      setIsPending(false);
    }
  }, []);

  const debouncedCallback = useMemo(() => {
    const fn = (...args: Parameters<T>) => {
      argsRef.current = args;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setIsPending(true);

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
        setIsPending(false);
        timeoutRef.current = undefined;
      }, delay);
    };
    return fn as T;
  }, [delay]);

  return useMemo(
    () => ({
      debouncedCallback,
      cancel,
      flush,
      isPending,
    }),
    [debouncedCallback, cancel, flush, isPending]
  );
}

export default useDebounce;
