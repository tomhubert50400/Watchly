import { RefObject, useCallback, useEffect, useRef } from 'react';
import { Keyboard, ScrollView, ScrollViewProps, TextInput } from 'react-native';
import { resolveFocusedFieldScrollOffset } from './bottomActionSheetKeyboard';

export function useFocusedFieldVisibility(scrollRef: RefObject<ScrollView | null>) {
  const focusedInput = useRef<ReturnType<typeof TextInput.State.currentlyFocusedInput> | null>(null);
  const scrollOffset = useRef(0);
  const scheduledFrame = useRef<number | null>(null);
  const measurementVersion = useRef(0);
  const revealFocusedInput = useCallback(() => {
    const version = ++measurementVersion.current;
    if (scheduledFrame.current !== null) cancelAnimationFrame(scheduledFrame.current);
    scheduledFrame.current = requestAnimationFrame(() => {
      scheduledFrame.current = null;
      const input = focusedInput.current;
      const scroll = scrollRef.current;
      if (!input || !scroll || TextInput.State.currentlyFocusedInput() !== input) return;
      scroll.getNativeScrollRef()?.measureInWindow((_x, viewportTop, _width, viewportHeight) => {
        input.measureInWindow((_inputX, fieldTop, _inputWidth, fieldHeight) => {
          if (version !== measurementVersion.current || focusedInput.current !== input || TextInput.State.currentlyFocusedInput() !== input) return;
          const y = resolveFocusedFieldScrollOffset({ scrollOffset: scrollOffset.current, viewportTop, viewportHeight, keyboardTop: Keyboard.metrics()?.screenY, fieldTop, fieldHeight });
          if (Math.abs(y - scrollOffset.current) > 1) scroll.scrollTo({ y, animated: false });
        });
      });
    });
  }, [scrollRef]);

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', revealFocusedInput);
    const changed = Keyboard.addListener('keyboardDidChangeFrame', revealFocusedInput);
    return () => {
      shown.remove();
      changed.remove();
      focusedInput.current = null;
      if (scheduledFrame.current !== null) cancelAnimationFrame(scheduledFrame.current);
    };
  }, [revealFocusedInput]);

  return {
    onFocus: () => {
      focusedInput.current = TextInput.State.currentlyFocusedInput();
      revealFocusedInput();
    },
    onBlur: () => { focusedInput.current = null; },
    onLayout: revealFocusedInput,
    onContentSizeChange: revealFocusedInput,
    onScroll: (event) => { scrollOffset.current = event.nativeEvent.contentOffset.y; },
    scrollEventThrottle: 16,
  } satisfies Pick<ScrollViewProps, 'onFocus' | 'onBlur' | 'onLayout' | 'onContentSizeChange' | 'onScroll' | 'scrollEventThrottle'>;
}
