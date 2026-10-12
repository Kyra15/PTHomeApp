import React, { useEffect } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import type { LinkingOptions } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import type { RootStackParamList } from './src/navigation/types';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { preloadSounds, unloadSounds } from './src/utils/sound';
import { registerForPush } from './src/utils/push';

const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Invite links from the email open the app at kinetic://invite/<code> -> Connect screen with the code filled in.
// (Only applies while signed in; signed-out users sign in first, then tap the link or type the code.)
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['kinetic://'],
  config: { screens: { Connect: 'invite/:code?' } },
};

/** Registers this phone for push once signed in, and routes a tapped invite/transfer push to the right screen. */
function PushSetup() {
  const { session } = useAuth();
  const userId = session?.user.id;

  useEffect(() => {
    if (userId) registerForPush();
  }, [userId]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const type = resp.notification.request.content.data?.type;
      if (navigationRef.isReady()) {
        if (type === 'doctor_invite') navigationRef.navigate('Connect');
        else if (type === 'care_transfer') navigationRef.navigate('Dashboard');
      }
    });
    return () => sub.remove();
  }, []);

  return null;
}

export default function App() {
  useEffect(() => {
    preloadSounds();
    return () => {
      unloadSounds();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <NavigationContainer ref={navigationRef} linking={linking}>
          <PushSetup />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
