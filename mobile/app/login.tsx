import { useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

export default function LoginScreen() {
  const [phone, setPhone] = useState("03000000000");
  const [password, setPassword] = useState("tradeflow123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      const resp = await api.post<{ access_token: string }>("/auth/login", { phone, password });
      useAuthStore.getState().setAuth(resp.access_token, { id: "", name: phone, phone, role: "owner" });
      router.replace("/(tabs)/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server. Check EXPO_PUBLIC_API_URL.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>AI TradeFlow</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>

      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="Phone"
        keyboardType="phone-pad"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        autoCapitalize="none"
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
      </Pressable>

      <Text style={styles.hint}>
        Demo login pre-filled: 03000000000 / tradeflow123{"\n"}(run `python seed.py` in backend/)
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 28, fontWeight: "bold" },
  subtitle: { fontSize: 14, color: "#666", marginTop: 4, marginBottom: 24 },
  input: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 16,
  },
  button: { backgroundColor: "#111", borderRadius: 999, padding: 14, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  error: { color: "#dc2626", marginBottom: 12 },
  hint: { marginTop: 24, fontSize: 12, color: "#999", textAlign: "center" },
});
