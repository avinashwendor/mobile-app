import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Modal, Pressable, StyleSheet, View, Dimensions, Animated, PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { Spacing, Radii } from '../../theme/tokens';
import CommentsPanel from './CommentsPanel';

interface CommentsSheetProps {
  visible: boolean;
  contentType: 'post' | 'reel';
  contentId: string;
  onClose: () => void;
  initialExpanded?: boolean;
  highlightCommentId?: string;
  onExpandedChange?: (expanded: boolean) => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function CommentsSheet({
  visible,
  contentType,
  contentId,
  onClose,
  initialExpanded = false,
  highlightCommentId,
  onExpandedChange,
}: CommentsSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const expandedHeight = useMemo(() => SCREEN_HEIGHT - insets.top - 12, [insets.top]);
  const collapsedHeight = useMemo(
    () => Math.min(Math.round(SCREEN_HEIGHT * 0.56), expandedHeight - 96),
    [expandedHeight],
  );
  const sheetHeight = useRef(new Animated.Value(initialExpanded ? expandedHeight : collapsedHeight)).current;
  const currentHeightRef = useRef(initialExpanded ? expandedHeight : collapsedHeight);
  const dragStartHeightRef = useRef(currentHeightRef.current);

  useEffect(() => {
    const listenerId = sheetHeight.addListener(({ value }) => {
      currentHeightRef.current = value;
    });
    return () => {
      sheetHeight.removeListener(listenerId);
    };
  }, [sheetHeight]);

  useEffect(() => {
    if (!visible) return;
    const startHeight = initialExpanded ? expandedHeight : collapsedHeight;
    sheetHeight.setValue(startHeight);
    currentHeightRef.current = startHeight;
    onExpandedChange?.(initialExpanded);
  }, [collapsedHeight, expandedHeight, initialExpanded, onExpandedChange, sheetHeight, visible]);

  const snapTo = useCallback((targetHeight: number) => {
    Animated.spring(sheetHeight, {
      toValue: targetHeight,
      useNativeDriver: false,
      bounciness: 0,
      speed: 22,
    }).start(() => {
      onExpandedChange?.(targetHeight === expandedHeight);
    });
  }, [expandedHeight, onExpandedChange, sheetHeight]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gestureState) => Math.abs(gestureState.dy) > 6,
    onPanResponderGrant: () => {
      dragStartHeightRef.current = currentHeightRef.current;
    },
    onPanResponderMove: (_event, gestureState) => {
      const nextHeight = Math.max(
        collapsedHeight,
        Math.min(expandedHeight, dragStartHeightRef.current - gestureState.dy),
      );
      sheetHeight.setValue(nextHeight);
    },
    onPanResponderRelease: (_event, gestureState) => {
      const projectedHeight = currentHeightRef.current - gestureState.vy * 24;
      const midpoint = (collapsedHeight + expandedHeight) / 2;
      snapTo(projectedHeight > midpoint ? expandedHeight : collapsedHeight);
    },
    onPanResponderTerminate: () => {
      const midpoint = (collapsedHeight + expandedHeight) / 2;
      snapTo(currentHeightRef.current > midpoint ? expandedHeight : collapsedHeight);
    },
  }), [collapsedHeight, expandedHeight, sheetHeight, snapTo]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              height: sheetHeight,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          <Pressable style={styles.dragHandleArea} onPress={(event) => event.stopPropagation()} {...panResponder.panHandlers}>
            <View style={[styles.handle, { backgroundColor: colors.textTertiary }]} />
          </Pressable>
          <Pressable style={styles.panelSurface} onPress={(event) => event.stopPropagation()}>
            <CommentsPanel
              contentType={contentType}
              contentId={contentId}
              onClose={onClose}
              headerMode="sheet"
              highlightCommentId={highlightCommentId}
            />
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.14)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radii.xl, borderTopRightRadius: Radii.xl, overflow: 'hidden' },
  dragHandleArea: { alignItems: 'center', paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  handle: { width: 40, height: 4, borderRadius: 999, opacity: 0.45 },
  panelSurface: { flex: 1 },
});