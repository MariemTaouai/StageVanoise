import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
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

interface TestResponse {
  status: string;
  message: string;
  timestamp: string;
  server?: {
    name: string;
    version: string;
  };
}

type ConnectionStatus = "idle" | "testing" | "success" | "error";

export default function ApiConfigScreen() {
  const [apiUrl, setApiUrl] = useState("");
  const [secondaryApiUrl, setSecondaryApiUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedUrl, setSavedUrl] = useState("");
  const [savedSecondaryUrl, setSavedSecondaryUrl] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [secondaryStatus, setSecondaryStatus] =
    useState<ConnectionStatus>("idle");
  const [secondaryStatusMessage, setSecondaryStatusMessage] = useState("");

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadSavedUrl = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem("api_url");
      const storedSecondary = await AsyncStorage.getItem("api_url_2");
      if (stored) {
        setSavedUrl(stored);
        setApiUrl(stored);
        setStatus("success");
        setStatusMessage("✅ URL backend principale chargée avec succès");
      } else {
        setApiUrl("");
        setSavedUrl("");
        setStatus("idle");
        setStatusMessage("🔌 En attente de configuration backend principal");
      }

      if (storedSecondary) {
        setSavedSecondaryUrl(storedSecondary);
        setSecondaryApiUrl(storedSecondary);
        setSecondaryStatus("success");
        setSecondaryStatusMessage(
          "✅ URL backend secondaire chargée avec succès",
        );
      } else {
        setSecondaryApiUrl("");
        setSavedSecondaryUrl("");
        setSecondaryStatus("idle");
        setSecondaryStatusMessage(
          "🔌 En attente de configuration backend secondaire",
        );
      }
    } catch (error) {
      console.error("❌ Erreur chargement URL:", error);
      setStatus("error");
      setStatusMessage("❌ Erreur lors du chargement");
      setSecondaryStatus("error");
      setSecondaryStatusMessage("❌ Erreur lors du chargement");
    }
  }, []);

  const formatUrl = useCallback((url: string): string => {
    let formatted = url.trim();
    if (!formatted.startsWith("http://") && !formatted.startsWith("https://")) {
      formatted = "http://" + formatted;
    }
    if (formatted.endsWith("/")) {
      formatted = formatted.slice(0, -1);
    }
    return formatted;
  }, []);

  /**
   * Test de connexion adapté au backend.
   * - Backend 1 (Express / server.js) : possède une vraie route /api/test
   * - Backend 2 (LoopBack) : n'a PAS de route /api/test → 404 garanti.
   *   On teste donc une route qui existe réellement dessus,
   *   ex: /api/listlocations. Adapte ce endpoint si besoin.
   */
  const testConnection = useCallback(
    async (url: string, isSecondary = false): Promise<TestResponse> => {
      const endpoint = isSecondary ? "/api/listlocations" : "/api/test";
      const testUrl = `${url}${endpoint}`;
      console.log("🔍 Test de connexion:", testUrl);

      const response = await fetch(testUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("✅ Données reçues:", data);

      // Le backend 2 (LoopBack) ne renvoie pas le même format que
      // /api/test du backend 1 (Express) : on uniformise la réponse
      // seulement pour l'affichage du statut dans cet écran.
      if (isSecondary) {
        return {
          status: "success",
          message: "✅ Backend secondaire accessible (LoopBack)",
          timestamp: new Date().toISOString(),
        };
      }
      return data;
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!apiUrl || apiUrl.trim() === "") {
      Alert.alert("Erreur", "Veuillez entrer une URL valide.");
      return;
    }

    const formattedUrl = formatUrl(apiUrl);

    setLoading(true);
    setStatus("testing");
    setStatusMessage("⏳ Test de connexion en cours...");

    try {
      const data = await testConnection(formattedUrl, false);

      await AsyncStorage.setItem("api_url", formattedUrl);
      setSavedUrl(formattedUrl);
      setStatus("success");
      setStatusMessage("✅ Connexion établie avec succès !");

      Alert.alert(
        "✅ Succès",
        `Connexion établie avec le serveur principal !\n\n📡 ${data.message || "Serveur accessible"}\n🕐 ${data.timestamp || ""}`,
        [{ text: "Continuer", onPress: () => router.replace("/login") }],
      );
    } catch (error: any) {
      console.error("❌ Erreur détaillée:", error);
      setStatus("error");
      setStatusMessage(`❌ ${error.message || "Erreur de connexion"}`);

      const testUrl = `${formattedUrl}/api/test`;

      Alert.alert(
        "❌ Erreur de connexion",
        `Détails: ${error.message || "Erreur inconnue"}\n\n` +
          "💡 Solutions :\n" +
          "• Vérifiez que le backend est démarré (node server.js)\n" +
          "• Vérifiez que vous êtes sur le même WiFi\n" +
          "• Si vous êtes sur émulateur Android, utilisez: http://10.0.2.2:5000\n" +
          "• Si vous êtes sur émulateur iOS, utilisez: http://localhost:5000\n" +
          "• Désactivez le firewall Windows\n\n" +
          `📡 URL testée: ${testUrl}`,
      );
    } finally {
      setLoading(false);
    }
  }, [apiUrl, formatUrl, testConnection]);

  const handleSaveSecondary = useCallback(async () => {
    if (!secondaryApiUrl || secondaryApiUrl.trim() === "") {
      Alert.alert(
        "Erreur",
        "Veuillez entrer une URL valide pour le backend secondaire.",
      );
      return;
    }

    const formattedUrl = formatUrl(secondaryApiUrl);

    setLoading(true);
    setSecondaryStatus("testing");
    setSecondaryStatusMessage("⏳ Test de connexion en cours...");

    try {
      const data = await testConnection(formattedUrl, true);

      await AsyncStorage.setItem("api_url_2", formattedUrl);
      setSavedSecondaryUrl(formattedUrl);
      setSecondaryStatus("success");
      setSecondaryStatusMessage("✅ Connexion établie avec succès !");

      Alert.alert(
        "✅ Succès",
        `Connexion établie avec le backend secondaire !\n\n📡 ${data.message || "Serveur accessible"}\n🕐 ${data.timestamp || ""}`,
      );
    } catch (error: any) {
      console.error("❌ Erreur détaillée backend secondaire:", error);
      setSecondaryStatus("error");
      setSecondaryStatusMessage(`❌ ${error.message || "Erreur de connexion"}`);

      const testUrl = `${formattedUrl}/api/listlocations`;

      Alert.alert(
        "❌ Erreur de connexion",
        `Détails: ${error.message || "Erreur inconnue"}\n\n` +
          "💡 Solutions :\n" +
          "• Vérifiez que le backend est démarré\n" +
          "• Vérifiez que vous êtes sur le même WiFi\n" +
          "• Si vous êtes sur émulateur Android, utilisez: http://10.0.2.2:4000\n" +
          "• Si vous êtes sur émulateur iOS, utilisez: http://localhost:4000\n" +
          "• Désactivez le firewall Windows\n\n" +
          `📡 URL testée: ${testUrl}`,
      );
    } finally {
      setLoading(false);
    }
  }, [secondaryApiUrl, formatUrl, testConnection]);

  const handleReset = useCallback(async () => {
    Alert.alert(
      "⚠️ Réinitialisation",
      "Voulez-vous vraiment supprimer l'URL sauvegardée ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.removeItem("api_url");
              setSavedUrl("");
              setApiUrl("");
              setStatus("idle");
              setStatusMessage("🔌 Configuration réinitialisée");
              Alert.alert("✅ URL supprimée", "L'URL a été réinitialisée.");
            } catch (error) {
              console.error("❌ Erreur suppression:", error);
              Alert.alert("Erreur", "Impossible de supprimer l'URL.");
            }
          },
        },
      ],
    );
  }, []);

  const handleResetSecondary = useCallback(async () => {
    Alert.alert(
      "⚠️ Réinitialisation",
      "Voulez-vous vraiment supprimer l'URL du backend secondaire ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.removeItem("api_url_2");
              setSavedSecondaryUrl("");
              setSecondaryApiUrl("");
              setSecondaryStatus("idle");
              setSecondaryStatusMessage(
                "🔌 Configuration backend secondaire réinitialisée",
              );
              Alert.alert(
                "✅ URL supprimée",
                "L'URL du backend secondaire a été réinitialisée.",
              );
            } catch (error) {
              console.error("❌ Erreur suppression backend secondaire:", error);
              Alert.alert(
                "Erreur",
                "Impossible de supprimer l'URL du backend secondaire.",
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
      case "testing":
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
      case "testing":
        return "⏳";
      default:
        return "🔌";
    }
  }, [status]);

  const secondaryStatusColor = useMemo(() => {
    switch (secondaryStatus) {
      case "success":
        return C.green;
      case "error":
        return C.red;
      case "testing":
        return C.blue;
      default:
        return C.inkLight;
    }
  }, [secondaryStatus]);

  const secondaryStatusIcon = useMemo(() => {
    switch (secondaryStatus) {
      case "success":
        return "✅";
      case "error":
        return "❌";
      case "testing":
        return "⏳";
      default:
        return "🔌";
    }
  }, [secondaryStatus]);

  const isUrlValid = useMemo(() => apiUrl.trim().length > 0, [apiUrl]);
  const isSecondaryUrlValid = useMemo(
    () => secondaryApiUrl.trim().length > 0,
    [secondaryApiUrl],
  );

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
            {/* Logo */}
            <View style={styles.logoContainer}>
              <Image
                source={require("../assets/favicon.png")}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.appName}>Dr. Oetker</Text>
              <Text style={styles.appSubName}>Vanoise App</Text>
            </View>

            {/* Carte principale */}
            <View style={styles.card}>
              <Text style={styles.title}>⚙️ Configuration</Text>
              <Text style={styles.subTitle}>
                Entrez lURL du serveur pour connecter lapplication
              </Text>

              {/* Statut */}
              <View
                style={[styles.statusContainer, { borderColor: statusColor }]}
              >
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {statusIcon}{" "}
                  {statusMessage || "🔌 En attente de configuration"}
                </Text>
              </View>

              {/* URL actuelle */}
              {savedUrl !== "" && (
                <View style={styles.currentUrlContainer}>
                  <View style={styles.currentUrlHeader}>
                    <Text style={styles.currentUrlLabel}>
                      🔗 URL actuelle :
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
                <Text style={styles.inputLabel}>🌐 URL du serveur</Text>
                <TextInput
                  style={[styles.input, loading && styles.inputDisabled]}
                  placeholder="Ex: 192.168.1.100:5000"
                  placeholderTextColor={C.inkLight}
                  value={apiUrl}
                  onChangeText={(text) => {
                    setApiUrl(text);
                    setStatus("idle");
                    setStatusMessage("🔌 En attente de configuration");
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  editable={!loading}
                />
                <Text style={styles.inputHint}>
                  💡 Format : IP:Port (ex: 192.168.1.100:5000)
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
                    <Text style={styles.testBtnTxt}> Connexion...</Text>
                  </View>
                ) : (
                  <Text style={styles.testBtnTxt}>
                    🔗 Tester et sauvegarder
                  </Text>
                )}
              </TouchableOpacity>

              <View style={styles.secondaryCard}>
                <Text style={styles.secondaryTitle}>🔧 Backend secondaire</Text>
                <Text style={styles.secondarySubtitle}>
                  Entrez une URL de secours pour le backend.
                </Text>

                <View
                  style={[
                    styles.statusContainer,
                    { borderColor: secondaryStatusColor },
                  ]}
                >
                  <Text
                    style={[styles.statusText, { color: secondaryStatusColor }]}
                  >
                    {secondaryStatusIcon}{" "}
                    {secondaryStatusMessage ||
                      "🔌 En attente de configuration secondaire"}
                  </Text>
                </View>

                {savedSecondaryUrl !== "" && (
                  <View style={styles.currentUrlContainer}>
                    <View style={styles.currentUrlHeader}>
                      <Text style={styles.currentUrlLabel}>
                        🔗 URL secondaire :
                      </Text>
                      <TouchableOpacity
                        onPress={handleResetSecondary}
                        style={styles.resetSmallBtn}
                      >
                        <Text style={styles.resetSmallBtnTxt}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.currentUrlValue}>
                      {savedSecondaryUrl}
                    </Text>
                  </View>
                )}

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>🌐 URL secondaire</Text>
                  <TextInput
                    style={[styles.input, loading && styles.inputDisabled]}
                    placeholder="Ex: 192.168.1.100:4000"
                    placeholderTextColor={C.inkLight}
                    value={secondaryApiUrl}
                    onChangeText={(text) => {
                      setSecondaryApiUrl(text);
                      setSecondaryStatus("idle");
                      setSecondaryStatusMessage(
                        "🔌 En attente de configuration backend secondaire",
                      );
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    editable={!loading}
                  />
                  <Text style={styles.inputHint}>
                    💡 Format : IP:Port (ex: 192.168.1.100:4000)
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.testBtn,
                    (!isSecondaryUrlValid || loading) && styles.testBtnDisabled,
                  ]}
                  onPress={handleSaveSecondary}
                  disabled={!isSecondaryUrlValid || loading}
                >
                  <Text style={styles.testBtnTxt}>
                    🔗 Tester et sauvegarder secondaire
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Bouton Réinitialiser */}
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={handleReset}
                disabled={loading}
              >
                <Text style={styles.resetBtnTxt}>🗑️ Réinitialiser lURL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.testBtn, loading && styles.testBtnDisabled]}
                onPress={() => router.push("/PrinterConfigScreen")}
                disabled={loading}
              >
                <Text style={styles.testBtnTxt}>🖨️ Configurer limprimante</Text>
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
  secondaryCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  secondaryTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: C.ink,
    marginBottom: 6,
  },
  secondarySubtitle: {
    fontSize: 13,
    color: C.inkLight,
    marginBottom: 14,
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
    borderWidth: 1,
    borderColor: C.red,
    backgroundColor: C.redSoft,
    marginBottom: 12,
  },
  resetBtnTxt: {
    color: C.red,
    fontSize: 14,
    fontWeight: "600",
  },
  infoContainer: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: C.inkMid,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: C.inkLight,
    lineHeight: 22,
  },
  version: {
    textAlign: "center",
    fontSize: 12,
    color: C.inkLight,
    marginTop: 20,
    paddingBottom: 10,
  },
});