import { useCallback, useState } from "react";
import { useFocusEffect, router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";

type Party = { id: string; name: string; type: string };
type Balance = { party_id: string; party_name: string; balance: number };

export default function KhataListScreen() {
  const [parties, setParties] = useState<Party[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});

  const load = useCallback(() => {
    api.get<Party[]>("/parties").then(async (list) => {
      setParties(list);
      const entries = await Promise.all(
        list.map(async (p) => [p.id, (await api.get<Balance>(`/ledger/parties/${p.id}/balance`)).balance] as const)
      );
      setBalances(Object.fromEntries(entries));
    }).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>Khata</Text>
      <FlatList
        data={parties}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => {
          const balance = balances[item.id];
          return (
            <Pressable style={styles.row} onPress={() => router.push(`/(tabs)/khata/${item.id}`)}>
              <View>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.muted}>{item.type}</Text>
              </View>
              <Text style={balance > 0 ? styles.positive : balance < 0 ? styles.negative : undefined}>
                {balance !== undefined ? `Rs ${balance.toLocaleString()}` : "..."}
              </Text>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "bold", marginHorizontal: 16, marginTop: 12 },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f2f2f2",
  },
  name: { fontSize: 16 },
  muted: { color: "#999", fontSize: 12 },
  positive: { color: "#15803d" },
  negative: { color: "#dc2626" },
});
