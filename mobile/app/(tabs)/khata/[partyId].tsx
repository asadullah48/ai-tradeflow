import { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";

type Balance = { party_id: string; party_name: string; balance: number; aging: { label: string; amount: number }[] };
type LedgerEntry = { id: string; date: string; type: string; amount: number; method: string; note: string | null };

export default function KhataDetailScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);

  const load = useCallback(() => {
    if (!partyId) return;
    api.get<Balance>(`/ledger/parties/${partyId}/balance`).then(setBalance).catch(() => {});
    api.get<LedgerEntry[]>(`/ledger/parties/${partyId}`).then(setEntries).catch(() => {});
  }, [partyId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!balance) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Text style={{ padding: 16 }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={{ padding: 16 }}>
        <Text style={styles.title}>{balance.party_name}</Text>
        <Text style={[styles.balance, balance.balance >= 0 ? styles.positive : styles.negative]}>
          Rs {balance.balance.toLocaleString()}
        </Text>

        <View style={styles.agingRow}>
          {balance.aging.map((a) => (
            <Text key={a.label} style={[styles.agingItem, a.amount > 0 && a.label !== "current" ? styles.negative : undefined]}>
              {a.label}: Rs {a.amount.toLocaleString()}
            </Text>
          ))}
        </View>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.muted}>{item.date} - {item.method}{item.note ? ` (${item.note})` : ""}</Text>
            <Text style={item.type === "debit" ? styles.negative : styles.positive}>
              {item.type === "debit" ? "+" : "-"}Rs {item.amount.toLocaleString()}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "bold" },
  balance: { fontSize: 20, marginTop: 4 },
  positive: { color: "#15803d" },
  negative: { color: "#dc2626" },
  agingRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 },
  agingItem: { fontSize: 13, color: "#444" },
  row: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f2f2f2" },
  muted: { color: "#999", fontSize: 12 },
});
