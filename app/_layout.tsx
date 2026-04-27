import React, { useCallback, useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';

import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { useAuthStore } from '../src/stores/authStore';
import { useNotificationStore } from '../src/stores/notificationStore';
import {
  addNotificationResponseListener,
  type NotificationRoutePayload,
  syncPushTokenWithBackend,
} from '../src/services/pushNotificationService';
import { socketService } from '../src/services/socketService';
import { navigateToContent } from '../src/utils/contentLinks';
import { useChatStore, subscribeChatSocket } from '../src/stores/chatStore';

SplashScreen.preventAutoHideAsync();

/**
 * Auth routing guard — redirects based on auth state.
 * Manages WebSocket lifecycle alongside auth transitions.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const segments = useSegments();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);
  const incrementUnread = useNotificationStore((s) => s.increment);
  const clearUnread = useNotificationStore((s) => s.clearCount);
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const user = useAuthStore((s) => s.user);
  const inAuthGroup = segments[0] === '(auth)';

  const handleNotificationNavigation = useCallback((payload: NotificationRoutePayload) => {
    if ((payload.contentType === 'post' || payload.contentType === 'reel') && payload.contentId) {
      navigateToContent(router, {
        contentType: payload.contentType,
        contentId: payload.contentId,
        commentId: payload.commentId,
        openComments: Boolean(payload.commentId),
      });
      return;
    }

    if ((payload.type === 'follow' || payload.type === 'follow_request') && payload.senderUsername) {
      router.push({ pathname: '/(screens)/user/[id]', params: { id: payload.senderUsername } });
      return;
    }

    router.push('/(screens)/notifications');
  }, [router]);

  // WebSocket lifecycle — connect when authenticated, disconnect on logout
  useEffect(() => {
    if (isAuthenticated) {
      socketService.connect();
      fetchUnreadCount();
      syncPushTokenWithBackend();

      const unsubscribe = socketService.on('new_notification', () => {
        incrementUnread();
      });

      const unsubscribePushResponse = addNotificationResponseListener((payload) => {
        fetchUnreadCount();
        handleNotificationNavigation(payload);
      });

      // Chat: fetch conversations and subscribe to incoming messages
      fetchConversations();
      const unsubscribeChat = user?._id ? subscribeChatSocket(user._id) : () => {};

      return () => {
        unsubscribe();
        unsubscribePushResponse();
        unsubscribeChat();
        socketService.disconnect();
      };
    } else {
      clearUnread();
      socketService.disconnect();
    }
  }, [clearUnread, fetchUnreadCount, handleNotificationNavigation, incrementUnread, isAuthenticated]);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, inAuthGroup, router]);

  // Prevent protected/auth screens from mounting during redirect transitions.
  if (isLoading) return null;
  if (!isAuthenticated && !inAuthGroup) return null;
  if (isAuthenticated && inAuthGroup) return null;

  return <>{children}</>;
}

function InnerLayout() {
  const { isDark } = useTheme();
  const hydrate = useAuthStore((s) => s.hydrate);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AuthGate>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="(screens)"
          options={{ animation: 'slide_from_right' }}
        />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </AuthGate>
  );
}

/**
 * Root layout — wraps entire app with ThemeProvider, loads fonts,
 * manages splash screen, routes based on auth state, and manages
 * the WebSocket connection lifecycle.
 */
export default function RootLayout() {
  return (
    <ThemeProvider>
      <InnerLayout />
    </ThemeProvider>
  );
}
