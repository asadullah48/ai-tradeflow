import { useCallback, useState } from "react";
import { useFocusEffect, router } from "expo-router";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

type StockAlert = { product_id: string; name: string; current_stock: number; min_stock_level: number; unit: string };
type Dashboard = {
  todays_sales_total: number;
  total_receivables: number;
  total_payables: number;
  stock_alerts: StockAlert[];
  top_udhaar_exposure: { party_id: string; party_name: string; amount: number }[];
  fast_movers: { product_name: string; velocity_per_day: number }[];
};

function Card({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const load = useCallback(() => {
    api.get<Dashboard>("/dashboard").then(setData).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await api.get<Dashboard>("/dashboard").then(setData).catch(() => {});
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>Dashboard</Text>
          <Pressable onPress={() => { clearAuth(); router.replace("/login"); }}>
            <Text style={styles.logout}>Logout</Text>
          </Pressable>
        </View>

        {!data ? (
          <Text style={{ marginTop: 20 }}>Loading...</Text>
        ) : (
          <>
            <View style={styles.cardRow}>
              <Card label="Today's Sales" value={`Rs ${data.todays_sales_total.toLocaleString()}`} />
              <Card label="Receivables" value={`Rs ${data.total_receivables.toLocaleString()}`} />
            </View>
            <View style={styles.cardRow}>
              <Card label="Payables" value={`Rs ${data.total_payables.toLocaleString()}`} />
              <Card label="Stock Alerts" value={String(data.stock_alerts.length)} />
            </View>

            <Text style={styles.sectionTitle}>Top Udhaar Exposure</Text>
            {data.top_udhaar_exposure.length === 0 && <Text style={styles.muted}>No data yet</Text>}
            <FlatList
              data={data.top_udhaar_exposure}
              keyExtractor={(p) => p.party_id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <Text>{item.party_name}</Text>
                  <Text style={styles.mono}>Rs {item.amount.toLocaleString()}</Text>
                </View>
              )}
            />

            <Text style={styles.sectionTitle}>Stock Alerts</Text>
            {data.stock_alerts.length === 0 && <Text style={styles.muted}>No data yet</Text>}
            <FlatList
              data={data.stock_alerts}
              keyExtractor={(p) => p.product_id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <Text style={styles.alert}>{item.name}</Text>
                  <Text style={styles.alert}>{item.current_stock}/{item.min_stock_level} {item.unit}</Text>
                </View>
              )}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 24, fontWeight: "bold" },
  logout: { color: "#dc2626" },
  cardRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  card: { flex: 1, borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 14 },
  cardLabel: { fontSize: 12, color: "#666" },
  cardValue: { fontSize: 20, fontWeight: "bold", marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginTop: 24, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f2f2f2" },
  mono: { fontVariant: ["tabular-nums"] },
  alert: { color: "#dc2626" },
  muted: { color: "#999" },
});
