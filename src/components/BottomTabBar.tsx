import React, { useCallback } from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withSequence,
} from 'react-native-reanimated';
import { Colors, Spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

interface TabConfig {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  isCenter?: boolean;
}

const TABS: TabConfig[] = [
  { name: 'index', icon: 'home-outline', activeIcon: 'home' },
  { name: 'explore', icon: 'search-outline', activeIcon: 'search' },
  { name: 'create', icon: 'add', activeIcon: 'add', isCenter: true },
  { name: 'reels', icon: 'play-outline', activeIcon: 'play' },
  { name: 'profile', icon: 'person-outline', activeIcon: 'person' },
];

const TAB_BAR_HEIGHT = 50;

function TabButton({
  tab,
  isActive,
  onPress,
  colors,
}: {
  tab: TabConfig;
  isActive: boolean;
  onPress: () => void;
  colors: any;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSequence(
      withSpring(0.85, { damping: 15, stiffness: 400 }),
      withSpring(1, { damping: 12, stiffness: 300 }),
    );
    onPress();
  };

  if (tab.isCenter) {
    return (
      <Pressable onPress={handlePress} style={styles.centerBtnWrapper}>
        <Animated.View style={animStyle}>
          <LinearGradient
            colors={[...Colors.gradientPrimary]}
            style={styles.centerBtn}
          >
            <Ionicons name="add" size={28} color={Colors.white} />
          </LinearGradient>
        </Animated.View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={handlePress} style={styles.tabBtn}>
      <Animated.View style={[styles.tabBtnInner, animStyle]}>
        <Ionicons
          name={isActive ? tab.activeIcon : tab.icon}
          size={26}
          color={isActive ? colors.text : colors.textTertiary}
        />
      </Animated.View>
    </Pressable>
  );
}

/**
 * Instagram-style bottom tab bar — flush to bottom with safe area,
 * no floating / absolute overlay so content scrolls naturally above it.
 */
export default function BottomTabBar(props: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const bottomPadding = Platform.OS === 'ios' ? insets.bottom : Spacing.sm;

  return (
    <View style={[styles.wrapper, { backgroundColor: isDark ? '#0A0A0F' : '#FFFFFF', borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', paddingBottom: bottomPadding }]}>
      <View style={styles.bar}>
        {TABS.map((tab) => {
          const routeIndex = props.state.routes.findIndex((r) => r.name === tab.name);
          const isActive = props.state.index === routeIndex;
          return (
            <TabButton
              key={tab.name}
              tab={tab}
              isActive={isActive}
              onPress={() => props.navigation.navigate(tab.name)}
              colors={colors}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: 0.5,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: TAB_BAR_HEIGHT,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: TAB_BAR_HEIGHT,
  },
  tabBtnInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerBtnWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: TAB_BAR_HEIGHT,
  },
  centerBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
});
