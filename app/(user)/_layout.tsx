import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';

const C = {
  brown: '#5C3317',
  gold:  '#C4A068',
  bg:    '#F9F4EE',
  sub:   '#8B7355',
};

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 4 }}>
      <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
    /*
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0.5,
          borderTopColor: '#E8E0D8',
          height: 64,
          paddingBottom: 8,
        },
        tabBarActiveTintColor:   C.brown,
        tabBarInactiveTintColor: C.sub,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}*/
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
{/* ← Ajoute ceci */}
<Tabs.Screen
  name="SalesDashboard"
  options={{
    href: null,
  }}
/>
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clients',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👥" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}