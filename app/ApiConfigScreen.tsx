import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, Stack } from "expo-router";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
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
  ActivityIndicator,
  Alert,
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

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';


export default function ApiConfigScreen() {
  const [apiUrl, setApiUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedUrl, setSavedUrl] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const fadeAnim = useRef(new Animated.Value(0)).current;


  const loadSavedUrl = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem("api_url");
      if (stored) {
        setSavedUrl(stored);
        setApiUrl(stored);
        setStatus("success");
        setStatusMessage("✅ URL chargée avec succès");
      } else {
        setApiUrl("");
        setSavedUrl("");
        setStatus("idle");
        setStatusMessage("🔌 En attente de configuration");
      }
    } catch (error) {
      console.error("❌ Erreur chargement URL:", error);
      setStatus("error");
      setStatusMessage("❌ Erreur lors du chargement");
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

  const testConnection = useCallback(async (url: string): Promise<TestResponse> => {
    const testUrl = `${url}/api/test`;
    console.log("🔍 Test de connexion:", testUrl);
    
    const response = await fetch(testUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("✅ Données reçues:", data);
    return data;
  }, []);

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
      const data = await testConnection(formattedUrl);
      
      await AsyncStorage.setItem("api_url", formattedUrl);
      setSavedUrl(formattedUrl);
      setStatus("success");
      setStatusMessage("✅ Connexion établie avec succès !");
      
      Alert.alert(
        "✅ Succès",
        `Connexion établie avec le serveur !\n\n📡 ${data.message || 'Serveur accessible'}\n🕐 ${data.timestamp || ''}`,
        [{ text: "Continuer", onPress: () => router.replace("/login") }]
      );
    } catch (error: any) {
      console.error("❌ Erreur détaillée:", error);
      setStatus("error");
      setStatusMessage(`❌ ${error.message || 'Erreur de connexion'}`);
      
      const testUrl = `${formattedUrl}/api/test`;
      
      Alert.alert(
        "❌ Erreur de connexion",
        `Détails: ${error.message || 'Erreur inconnue'}\n\n` +
        "💡 Solutions :\n" +
        "• Vérifiez que le backend est démarré (node server.js)\n" +
        "• Vérifiez que vous êtes sur le même WiFi\n" +
        "• Si vous êtes sur émulateur Android, utilisez: http://10.0.2.2:5000\n" +
        "• Si vous êtes sur émulateur iOS, utilisez: http://localhost:5000\n" +
        "• Désactivez le firewall Windows\n\n" +
        `📡 URL testée: ${testUrl}`
      );
    } finally {
      setLoading(false);
    }
  }, [apiUrl, formatUrl, testConnection]);

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
      ]
    );
  }, []);


  useEffect(() => {
    loadSavedUrl();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [loadSavedUrl]);


  const statusColor = useMemo(() => {
    switch(status) {
      case "success": return C.green;
      case "error": return C.red;
      case "testing": return C.blue;
      default: return C.inkLight;
    }
  }, [status]);

  const statusIcon = useMemo(() => {
    switch(status) {
      case "success": return "✅";
      case "error": return "❌";
      case "testing": return "⏳";
      default: return "🔌";
    }
  }, [status]);

  const isUrlValid = useMemo(() => {
    return apiUrl && apiUrl.trim().length > 0;
  }, [apiUrl]);


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
                Entrez l'URL du serveur pour connecter l'application
              </Text>

              {/* Statut */}
              <View style={[styles.statusContainer, { borderColor: statusColor }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {statusIcon} {statusMessage || "🔌 En attente de configuration"}
                </Text>
              </View>

              {/* URL actuelle */}
              {savedUrl !== "" && (
                <View style={styles.currentUrlContainer}>
                  <View style={styles.currentUrlHeader}>
                    <Text style={styles.currentUrlLabel}>🔗 URL actuelle :</Text>
                    <TouchableOpacity onPress={handleReset} style={styles.resetSmallBtn}>
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
                style={[styles.testBtn, (!isUrlValid || loading) && styles.testBtnDisabled]}
                onPress={handleSave}
                disabled={!isUrlValid || loading}
              >
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color="#FFF" size="small" />
                    <Text style={styles.testBtnTxt}> Connexion...</Text>
                  </View>
                ) : (
                  <Text style={styles.testBtnTxt}>🔗 Tester et sauvegarder</Text>
                )}
              </TouchableOpacity>

              {/* Bouton Réinitialiser */}
              <TouchableOpacity 
                style={styles.resetBtn} 
                onPress={handleReset}
                disabled={loading}
              >
                <Text style={styles.resetBtnTxt}>🗑️ Réinitialiser l'URL</Text>
              </TouchableOpacity>

              {/*<View style={styles.infoContainer}>
                <Text style={styles.infoTitle}>📋 Instructions :</Text>
                <Text style={styles.infoText}>
                  1️⃣ Assurez-vous que le backend est démarré
                </Text>
                <Text style={styles.infoText}>
                  2️⃣ Vérifiez que vous êtes sur le même réseau WiFi
                </Text>
                <Text style={styles.infoText}>
                  3️⃣ Entrez l'IP de votre ordinateur + le port (5000)
                </Text>
                <Text style={styles.infoText}>
                  💡 Si vous êtes sur émulateur Android : http://10.0.2.2:5000
                </Text>
                <Text style={styles.infoText}>
                  💡 Si vous êtes sur émulateur iOS : http://localhost:5000
                </Text>
              </View>*/}
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