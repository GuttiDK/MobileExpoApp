import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthProvider, useAuth } from "./lib/authContext";
import AuthScreen from "./screens/AuthScreen";
import HousesScreen from "./screens/HousesScreen";
import HouseDetailScreen from "./screens/HouseDetailScreen";
import RoomDetailScreen from "./screens/RoomDetailScreen";
import AdminScreen from "./screens/AdminScreen";
import AdminUserHousesScreen from "./screens/AdminUserHousesScreen";

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: "#0f172a" },
          headerTintColor: "#f1f5f9",
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: "#0f172a" },
        }}
      >
        {!user ? (
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Houses" component={HousesScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="HouseDetail"
              component={HouseDetailScreen}
              options={({ route }: any) => ({ title: route.params?.houseName || "Hus" })}
            />
            <Stack.Screen
              name="RoomDetail"
              component={RoomDetailScreen}
              options={({ route }: any) => ({ title: route.params?.roomName || "Rum" })}
            />
            <Stack.Screen
              name="Admin"
              component={AdminScreen}
              options={{ title: "🔧 Admin" }}
            />
            <Stack.Screen
              name="AdminUserHouses"
              component={AdminUserHousesScreen}
              options={({ route }: any) => ({ title: `${route.params?.userName}s huse` })}
            />
          </>
        )}
      </Stack.Navigator>
      <StatusBar style="light" />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}
