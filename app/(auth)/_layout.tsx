// app/(auth)/_layout.tsx
import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="login" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="verify-otp" options={{ headerShown: false, gestureEnabled: false }} />
      {/* ✅ AJOUTER CECI */}
      <Stack.Screen 
        name="RoleSelectionScreen" 
        options={{ 
          headerShown: true,
          title: "Sélectionner un rôle",
          headerTitleStyle: {
            color: '#5C3317',
            fontWeight: '600',
          },
          headerStyle: {
            backgroundColor: '#FDF6EE',
          },
          headerBackVisible: false,
          gestureEnabled: false,
        }} 
      />
    </Stack>
  );
}