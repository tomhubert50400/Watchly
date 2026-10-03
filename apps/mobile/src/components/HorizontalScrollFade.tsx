import MaskedView from '@react-native-masked-view/masked-view';
import { cloneElement, type ReactElement, useRef, useState } from 'react';
import { type ScrollViewProps, StyleSheet, UIManager } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

const FADE_WIDTH = 24;

export function HorizontalScrollFade({ children }: { children: ReactElement<ScrollViewProps> }) {
  const metrics = useRef({ width: 0, contentWidth: 0, offset: 0 });
  const [edges, setEdges] = useState({ width: 0, left: 0, right: 0 });

  if (!UIManager.hasViewManagerConfig('RNCMaskedView')) return children;

  const updateEdges = () => {
    const { width, contentWidth, offset } = metrics.current;
    const maxOffset = Math.max(0, contentWidth - width);
    const clampedOffset = Math.max(0, Math.min(offset, maxOffset));
    const left = width > 0 ? Math.min(1, clampedOffset / FADE_WIDTH) : 0;
    const right = width > 0 ? Math.min(1, (maxOffset - clampedOffset) / FADE_WIDTH) : 0;
    setEdges(current => current.width === width && current.left === left && current.right === right ? current : { width, left, right });
  };

  return (
    <MaskedView
      androidRenderingMode="software"
      style={children.props.style}
      maskElement={
        <Svg height="100%" width="100%" pointerEvents="none">
          <Defs>
            <LinearGradient id="horizontalScrollFade" gradientUnits="userSpaceOnUse" x1="0" x2={edges.width || 1} y1="0" y2="0">
              <Stop offset="0" stopColor="black" stopOpacity={1 - edges.left} />
              <Stop offset={Math.min(0.5, FADE_WIDTH / (edges.width || 1))} stopColor="black" stopOpacity="1" />
              <Stop offset={Math.max(0.5, 1 - FADE_WIDTH / (edges.width || 1))} stopColor="black" stopOpacity="1" />
              <Stop offset="1" stopColor="black" stopOpacity={1 - edges.right} />
            </LinearGradient>
          </Defs>
          <Rect fill="url(#horizontalScrollFade)" height="100%" width="100%" />
        </Svg>
      }
    >
      {cloneElement(children, {
        style: styles.scroll,
        scrollEventThrottle: 16,
        onLayout: event => {
          metrics.current.width = event.nativeEvent.layout.width;
          updateEdges();
          children.props.onLayout?.(event);
        },
        onContentSizeChange: (width, height) => {
          metrics.current.contentWidth = width;
          updateEdges();
          children.props.onContentSizeChange?.(width, height);
        },
        onScroll: event => {
          metrics.current.offset = event.nativeEvent.contentOffset.x;
          updateEdges();
          children.props.onScroll?.(event);
        },
      })}
    </MaskedView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
});
