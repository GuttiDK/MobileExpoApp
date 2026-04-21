// app/_layout.tsx
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: '#00D4FF',
          tabBarInactiveTintColor: '#484F58',
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color }) => (
              <TabIcon icon="📊" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Indstillinger',
            tabBarIcon: ({ color }) => (
              <TabIcon icon="⚙️" color={color} />
            ),
          }}
        />
      </Tabs>
    </SafeAreaProvider>
  );
}

function TabIcon({ icon, color }: { icon: string; color: string }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 20, opacity: color === '#00D4FF' ? 1 : 0.4 }}>{icon}</Text>;
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#161B22',
    borderTopColor: '#21262D',
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 8,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
