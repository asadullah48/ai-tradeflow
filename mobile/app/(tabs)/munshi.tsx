import { useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";

type Message = { id: string; role: "user" | "munshi"; text: string; blocked?: boolean; toolsCalled?: string[] };

const SUGGESTIONS = [
  "is haftay kya order karna chahiye?",
  "kis ka udhaar sab se purana hai?",
  "profit summary batao",
];

let nextId = 0;

export default function MunshiScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(question: string) {
    if (!question.trim()) return;
    setMessages((m) => [...m, { id: String(nextId++), role: "user", text: question }]);
    setInput("");
    setLoading(true);
    try {
      const resp = await api.post<{ answer: string; tools_called: string[]; blocked: boolean }>("/agent/ask", { question });
      setMessages((m) => [...m, { id: String(nextId++), role: "munshi", text: resp.answer, blocked: resp.blocked, toolsCalled: resp.tools_called }]);
    } catch {
      setMessages((m) => [...m, { id: String(nextId++), role: "munshi", text: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>Munshi AI</Text>

      <View style={styles.suggestionRow}>
        {SUGGESTIONS.map((s) => (
          <Pressable key={s} style={styles.suggestion} onPress={() => ask(s)}>
            <Text style={styles.suggestionText}>{s}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        style={styles.list}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <View style={{ alignItems: item.role === "user" ? "flex-end" : "flex-start" }}>
            <View
              style={[
                styles.bubble,
                item.role === "user" ? styles.bubbleUser : item.blocked ? styles.bubbleBlocked : styles.bubbleMunshi,
              ]}
            >
              <Text style={item.role === "user" ? styles.bubbleTextUser : styles.bubbleText}>{item.text}</Text>
            </View>
            {item.toolsCalled && item.toolsCalled.length > 0 && (
              <Text style={styles.toolsText}>tools used: {item.toolsCalled.join(", ")}</Text>
            )}
          </View>
        )}
      />

      {loading && <ActivityIndicator style={{ marginBottom: 8 }} />}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask Munshi AI..."
            onSubmitEditing={() => ask(input)}
          />
          <Pressable style={styles.sendButton} onPress={() => ask(input)}>
            <Text style={styles.sendButtonText}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "bold", marginHorizontal: 16, marginTop: 12 },
  suggestionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginHorizontal: 16, marginTop: 10 },
  suggestion: { borderWidth: 1, borderColor: "#ddd", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  suggestionText: { fontSize: 12 },
  list: { flex: 1 },
  bubble: { maxWidth: "85%", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleUser: { backgroundColor: "#111" },
  bubbleMunshi: { borderWidth: 1, borderColor: "#eee" },
  bubbleBlocked: { borderWidth: 1, borderColor: "#fca5a5", backgroundColor: "#fef2f2" },
  bubbleText: { fontSize: 14 },
  bubbleTextUser: { fontSize: 14, color: "#fff" },
  toolsText: { fontSize: 10, color: "#999", marginTop: 2 },
  inputRow: { flexDirection: "row", gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: "#eee" },
  input: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  sendButton: { backgroundColor: "#111", borderRadius: 999, paddingHorizontal: 16, justifyContent: "center" },
  sendButtonText: { color: "#fff", fontWeight: "600" },
});
