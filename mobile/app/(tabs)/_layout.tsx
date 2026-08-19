import { useEffect } from "react";
import { Tabs, router } from "expo-router";
import { Text } from "react-native";
import { useAuthStore } from "@/lib/store";

function TabIcon({ label }: { label: string }) {
  return <Text style={{ fontSize: 18 }}>{label}</Text>;
}

export default function TabsLayout() {
  const { token, hydrated } = useAuthStore();

  useEffect(() => {
    if (hydrated && !token) router.replace("/login");
  }, [hydrated, token]);

  if (!hydrated || !token) return null;

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#111" }}>
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarIcon: () => <TabIcon label="\u{1F4CA}" /> }} />
      <Tabs.Screen name="khata/index" options={{ title: "Khata", tabBarIcon: () => <TabIcon label="\u{1F4D2}" /> }} />
      <Tabs.Screen name="khata/[partyId]" options={{ href: null, headerShown: true, title: "Party" }} />
      <Tabs.Screen name="munshi" options={{ title: "Munshi AI", tabBarIcon: () => <TabIcon label="\u{1F916}" /> }} />
    </Tabs>
  );
}
