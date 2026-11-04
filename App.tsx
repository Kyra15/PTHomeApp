import React, { useEffect } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import type { LinkingOptions } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import type { RootStackParamList } from './src/navigation/types';
import { AuthProvider } from './src/auth/AuthContext';
import { preloadSounds, unloadSounds } from './src/utils/sound';

const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Invite links from the email open the app at kinetic://invite/<code> -> Connect screen with the code filled in.
// (Only applies while signed in; signed-out users sign in first, then tap the link or type the code.)
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['kinetic://'],
  config: { screens: { Connect: 'invite/:code?' } },
};

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
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
