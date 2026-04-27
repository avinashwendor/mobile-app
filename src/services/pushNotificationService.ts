import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as notificationApi from '../api/notification.api';
import { STORAGE_KEYS } from '../utils/constants';
import { getItem, removeItem, setItem } from '../utils/storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationRoutePayload {
  type?: string;
  contentType?: string;
  contentId?: string;
  commentId?: string;
  senderUsername?: string;
}

const resolveProjectId = (): string | undefined => (
  Constants.expoConfig?.extra?.eas?.projectId
  ?? (Constants as any).easConfig?.projectId
);

const normalizeRoutePayload = (input: Record<string, unknown> | null | undefined): NotificationRoutePayload => ({
  type: typeof input?.type === 'string' && input.type ? input.type : undefined,
  contentType: typeof input?.contentType === 'string' && input.contentType ? input.contentType : undefined,
  contentId: typeof input?.contentId === 'string' && input.contentId ? input.contentId : undefined,
  commentId: typeof input?.commentId === 'string' && input.commentId ? input.commentId : undefined,
  senderUsername: typeof input?.senderUsername === 'string' && input.senderUsername ? input.senderUsername : undefined,
});

const ensureAndroidChannel = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#6C5CE7',
  });
};

export async function syncPushTokenWithBackend(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    await ensureAndroidChannel();

    const permissionState = await Notifications.getPermissionsAsync();
    let finalStatus = permissionState.status;

    if (finalStatus !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const projectId = resolveProjectId();
    const pushToken = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();

    await notificationApi.registerPushToken(
      pushToken.data,
      Platform.OS === 'ios' ? 'ios' : 'android',
      Constants.deviceName ?? undefined,
    );
    await setItem(STORAGE_KEYS.PUSH_TOKEN, pushToken.data);
    return pushToken.data;
  } catch (error) {
    console.warn('[Push] Failed to sync push token:', error);
    return null;
  }
}

export async function unregisterStoredPushToken(): Promise<void> {
  const token = await getItem(STORAGE_KEYS.PUSH_TOKEN);
  if (!token) return;

  try {
    await notificationApi.unregisterPushToken(token);
  } catch (error) {
    console.warn('[Push] Failed to unregister push token:', error);
  }

  await removeItem(STORAGE_KEYS.PUSH_TOKEN);
}

export function addNotificationResponseListener(
  onNavigate: (payload: NotificationRoutePayload) => void,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response: Notifications.NotificationResponse) => {
    const payload = normalizeRoutePayload(
      (response.notification.request.content.data ?? {}) as Record<string, unknown>,
    );
    onNavigate(payload);
  });

  return () => {
    subscription.remove();
  };
}