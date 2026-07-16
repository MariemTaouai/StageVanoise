import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      {/* Supprimez (tabs) et listez vos pages directement */}
      <Stack.Screen name="ExpeditionScreen" />
      <Stack.Screen name="SalesDashboard" />
    </Stack>
  );
}