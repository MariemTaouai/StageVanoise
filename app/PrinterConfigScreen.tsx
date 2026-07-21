import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack } from "expo-router";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const C = {
  bg: "#FFFFFF",
  surface: "#FDF6EE",
  cream: "#F5E6C8",
  red: "#C0202A",
  redSoft: "#FDF0F0",
  green: "#2E7D32",
  greenSoft: "#F0FDF4",
  blue: "#2563EB",
  ink: "#1F1610",
  inkMid: "#3E2723",
  inkLight: "#7D6E65",
  inkFaint: "#C8B8A8",
  border: "#EFE5D3",
};

type ConnectionStatus = "idle" | "saving" | "success" | "error";

const formatPrinterUrl = (url: string): string => {
  let formatted = url.trim();
  if (!formatted) return "";
  if (!formatted.startsWith("http://") && !formatted.startsWith("https://")) {
    formatted = "http://" + formatted;
  }
  if (formatted.endsWith("/")) {
    formatted = formatted.slice(0, -1);
  }
  return formatted;
};

export default function PrinterConfigScreen() {
  const [printerUrl, setPrinterUrl] = useState("");
  const [savedUrl, setSavedUrl] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadSavedUrl = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem("printer_url");
      if (stored) {
        setSavedUrl(stored);
        setPrinterUrl(stored);
        setStatus("success");
        setStatusMessage("✅ URL imprimante chargée avec succès");
      } else {
        setSavedUrl("");
        setPrinterUrl("");
        setStatus("idle");
        setStatusMessage("🔌 En attente de configuration imprimante");
      }
    } catch (error) {
      console.error("❌ Erreur chargement URL imprimante:", error);
      setStatus("error");
      setStatusMessage("❌ Erreur lors du chargement");
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!printerUrl || printerUrl.trim() === "") {
      Alert.alert("Erreur", "Veuillez entrer une URL d'imprimante valide.");
      return;
    }

    const formattedUrl = formatPrinterUrl(printerUrl);
    if (!formattedUrl) {
      Alert.alert("Erreur", "L'URL saisie n'est pas valide.");
      return;
    }

    setLoading(true);
    setStatus("saving");
    setStatusMessage("⏳ Enregistrement en cours...");

    try {
      await AsyncStorage.setItem("printer_url", formattedUrl);
      setSavedUrl(formattedUrl);
      setPrinterUrl(formattedUrl);
      setStatus("success");
      setStatusMessage("✅ URL imprimante enregistrée");

      Alert.alert("✅ Enregistré", `URL imprimante : ${formattedUrl}`);
    } catch (error) {
      console.error("❌ Erreur sauvegarde URL imprimante:", error);
      setStatus("error");
      setStatusMessage("❌ Impossible d'enregistrer l'URL");
      Alert.alert("Erreur", "Impossible d'enregistrer l'URL de l'imprimante.");
    } finally {
      setLoading(false);
    }
  }, [printerUrl]);

  const handleReset = useCallback(async () => {
    Alert.alert(
      "⚠️ Réinitialisation",
      "Voulez-vous vraiment supprimer l'URL de l'imprimante ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.removeItem("printer_url");
              setSavedUrl("");
              setPrinterUrl("");
              setStatus("idle");
              setStatusMessage("🔌 Configuration imprimante réinitialisée");
              Alert.alert(
                "✅ URL supprimée",
                "L'URL de l'imprimante a été réinitialisée.",
              );
            } catch (error) {
              console.error("❌ Erreur suppression URL imprimante:", error);
              Alert.alert(
                "Erreur",
                "Impossible de supprimer l'URL de l'imprimante.",
              );
            }
          },
        },
      ],
    );
  }, []);

  useEffect(() => {
    loadSavedUrl();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [loadSavedUrl, fadeAnim]);

  const statusColor = useMemo(() => {
    switch (status) {
      case "success":
        return C.green;
      case "error":
        return C.red;
      case "saving":
        return C.blue;
      default:
        return C.inkLight;
    }
  }, [status]);

  const statusIcon = useMemo(() => {
    switch (status) {
      case "success":
        return "✅";
      case "error":
        return "❌";
      case "saving":
        return "⏳";
      default:
        return "🔌";
    }
  }, [status]);

  const isUrlValid = useMemo(() => {
    return printerUrl && printerUrl.trim().length > 0;
  }, [printerUrl]);

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
            <View style={styles.logoContainer}>
              <Image
                source={require("../assets/favicon.png")}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.appName}>Dr. Oetker</Text>
              <Text style={styles.appSubName}>Imprimante</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.title}>🖨️ Configuration imprimante</Text>
              <Text style={styles.subTitle}>
                Enregistrez lURL du serveur dimpression fourni par votre
                encadrant.
              </Text>

              <View
                style={[styles.statusContainer, { borderColor: statusColor }]}
              >
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {statusIcon}{" "}
                  {statusMessage || "🔌 En attente de configuration imprimante"}
                </Text>
              </View>

              {savedUrl !== "" && (
                <View style={styles.currentUrlContainer}>
                  <View style={styles.currentUrlHeader}>
                    <Text style={styles.currentUrlLabel}>
                      🔗 URL imprimante actuelle :
                    </Text>
                    <TouchableOpacity
                      onPress={handleReset}
                      style={styles.resetSmallBtn}
                    >
                      <Text style={styles.resetSmallBtnTxt}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.currentUrlValue}>{savedUrl}</Text>
                </View>
              )}

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>🌐 URL imprimante</Text>
                <TextInput
                  style={[styles.input, loading && styles.inputDisabled]}
                  placeholder="Ex: 172.16.11.229:6101"
                  placeholderTextColor={C.inkLight}
                  value={printerUrl}
                  onChangeText={(text) => {
                    setPrinterUrl(text);
                    setStatus("idle");
                    setStatusMessage(
                      "🔌 En attente de configuration imprimante",
                    );
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  editable={!loading}
                />
                <Text style={styles.inputHint}>
                  💡 Format accepté : IP:Port ou http://IP:Port
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.testBtn,
                  (!isUrlValid || loading) && styles.testBtnDisabled,
                ]}
                onPress={handleSave}
                disabled={!isUrlValid || loading}
              >
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color="#FFF" size="small" />
                    <Text style={styles.testBtnTxt}> Enregistrement...</Text>
                  </View>
                ) : (
                  <Text style={styles.testBtnTxt}>
                    💾 Enregistrer lURL imprimante
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resetBtn}
                onPress={handleReset}
                disabled={loading}
              >
                <Text style={styles.resetBtnTxt}>
                  🗑️ Réinitialiser lURL imprimante
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.version}>Dr. Oetker Vanoise · v1.0</Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 30,
    marginTop: 20,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 12,
  },
  appName: {
    fontSize: 28,
    fontWeight: "900",
    color: C.inkMid,
    letterSpacing: 1,
  },
  appSubName: {
    fontSize: 14,
    color: C.red,
    fontWeight: "700",
    letterSpacing: 4,
    marginTop: 2,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: C.ink,
    textAlign: "center",
    marginBottom: 8,
  },
  subTitle: {
    fontSize: 14,
    color: C.inkLight,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  statusContainer: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    backgroundColor: "#FFF",
    alignItems: "center",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  currentUrlContainer: {
    backgroundColor: C.greenSoft,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.green,
  },
  currentUrlHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  currentUrlLabel: {
    fontSize: 12,
    color: C.inkLight,
    fontWeight: "600",
  },
  currentUrlValue: {
    fontSize: 14,
    color: C.ink,
    fontWeight: "700",
    marginTop: 2,
  },
  resetSmallBtn: {
    padding: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.redSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  resetSmallBtnTxt: {
    color: C.red,
    fontSize: 12,
    fontWeight: "700",
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: C.inkMid,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: C.ink,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  inputHint: {
    fontSize: 12,
    color: C.inkLight,
    marginTop: 6,
  },
  testBtn: {
    backgroundColor: C.red,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: C.red,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  testBtnDisabled: {
    opacity: 0.6,
  },
  testBtnTxt: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  resetBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: C.border,
  },
  resetBtnTxt: {
    color: C.inkMid,
    fontSize: 14,
    fontWeight: "700",
  },
  version: {
    marginTop: 20,
    textAlign: "center",
    color: C.inkLight,
    fontSize: 12,
  },
});
