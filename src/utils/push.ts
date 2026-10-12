import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { registerPushToken } from '../lib/api';

// Show banners while the app is open too, so a new doctor invitation is never missed.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Ask for notification permission (once) and send this device's Expo push token to the backend so
 * the therapist's invitation / transfer pushes reach it. Safe to call on every sign-in; failures are
 * silent because push is a convenience (the in-app invitation card is the source of truth).
 */
export async function registerForPush(): Promise<void> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await registerPushToken(token.data, Platform.OS);
  } catch {
    /* simulator, permission denied, or offline: nothing to do */
  }
}
