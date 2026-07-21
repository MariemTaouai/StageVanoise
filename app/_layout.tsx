// app/_layout.tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from '@/hooks/use-color-scheme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    const prepare = async () => {
      await new Promise(resolve => setTimeout(resolve, 1500));
      await SplashScreen.hideAsync();
    };
    prepare();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack 
        screenOptions={{ 
          headerShown: false,
          gestureEnabled: false,
        }}
      >
        <Stack.Screen name="splash" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(auth)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(user)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', gestureEnabled: false }} />
        {/* ✅ AJOUTER CET ÉCRAN */}
        <Stack.Screen 
          name="ApiConfigScreen" 
          options={{ 
            headerShown: true,
            title: "Configuration",
            gestureEnabled: false,
          }} 
        />
        <Stack.Screen 
          name="PrinterConfigScreen" 
          options={{ 
            headerShown: true,
            title: "Configuration imprimante",
            gestureEnabled: false,
          }} 
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}