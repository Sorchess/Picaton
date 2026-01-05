/**
 * Полноценный undo/redo стек с поддержкой Ctrl+Z/Ctrl+Y.
 *
 * Сохраняет историю изменений и позволяет перемещаться вперед/назад.
 * Поддерживает горячие клавиши и ограничение размера истории.
 */

import { useState, useCallback, useEffect } from "react";

interface UndoRedoState<T> {
  past: T[];
  present: T;
  future: T[];
}

interface UseUndoRedoOptions {
  /** Максимальный размер истории */
  maxHistoryLength?: number;
  /** Включить горячие клавиши */
  enableKeyboardShortcuts?: boolean;
}

interface UseUndoRedoReturn<T> {
  /** Текущее значение */
  value: T;
  /** Установить новое значение */
  setValue: (newValue: T, saveToHistory?: boolean) => void;
  /** Отменить последнее действие */
  undo: () => void;
  /** Повторить отмененное действие */
  redo: () => void;
  /** Можно ли отменить */
  canUndo: boolean;
  /** Можно ли повторить */
  canRedo: boolean;
  /** Сбросить историю с новым начальным значением */
  reset: (newPresent: T) => void;
  /** Размер истории (past + future) */
  historySize: number;
}

export function useUndoRedo<T>(
  initialValue: T,
  options: UseUndoRedoOptions = {}
): UseUndoRedoReturn<T> {
  const { maxHistoryLength = 50, enableKeyboardShortcuts = true } = options;

  const [state, setState] = useState<UndoRedoState<T>>({
    past: [],
    present: initialValue,
    future: [],
  });

  // Note: isInputFocusedRef was removed as it was unused
  void enableKeyboardShortcuts; // Mark as used to prevent TS error

  const setValue = useCallback(
    (newValue: T, saveToHistory = true) => {
      setState((prev) => {
        // Если значение не изменилось, ничего не делаем
        if (JSON.stringify(prev.present) === JSON.stringify(newValue)) {
          return prev;
        }

        if (!saveToHistory) {
          return { ...prev, present: newValue };
        }

        // Ограничиваем размер истории
        const newPast = [...prev.past, prev.present].slice(-maxHistoryLength);

        return {
          past: newPast,
          present: newValue,
          future: [], // Очищаем future при новом действии
        };
      });
    },
    [maxHistoryLength]
  );

  const undo = useCallback(() => {
    setState((prev) => {
      if (prev.past.length === 0) return prev;

      const newPast = prev.past.slice(0, -1);
      const newPresent = prev.past[prev.past.length - 1];

      return {
        past: newPast,
        present: newPresent,
        future: [prev.present, ...prev.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((prev) => {
      if (prev.future.length === 0) return prev;

      const newFuture = prev.future.slice(1);
      const newPresent = prev.future[0];

      return {
        past: [...prev.past, prev.present],
        present: newPresent,
        future: newFuture,
      };
    });
  }, []);

  const reset = useCallback((newPresent: T) => {
    setState({
      past: [],
      present: newPresent,
      future: [],
    });
  }, []);

  // Keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Проверяем, что фокус на нашем компоненте (textarea/input)
      const target = e.target as HTMLElement;
      const isTextInput =
        target.tagName === "TEXTAREA" ||
        (target.tagName === "INPUT" &&
          (target as HTMLInputElement).type === "text");

      // Если фокус не на текстовом поле, не перехватываем
      if (!isTextInput) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && e.key === "z") {
        if (e.shiftKey) {
          // Ctrl+Shift+Z = Redo
          e.preventDefault();
          redo();
        } else {
          // Ctrl+Z = Undo
          e.preventDefault();
          undo();
        }
      } else if (modKey && e.key === "y") {
        // Ctrl+Y = Redo
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableKeyboardShortcuts, undo, redo]);

  return {
    value: state.present,
    setValue,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    reset,
    historySize: state.past.length + state.future.length,
  };
}

export default useUndoRedo;
