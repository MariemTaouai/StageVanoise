import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, Stack, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Image,
    Linking,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    downloadLabelPdf,
    generateZplLabel,
    sendToPrinter,
    type ZplData,
} from "../../Services/printService";
import { getApiUrl, getConfiguredApiUrl } from "../../Services/apiService";
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SIDEBAR_WIDTH = 280;

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

const MOIS = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Jun",
  "Jul",
  "Aoû",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];
const ITEMS_PER_PAGE = 3;

interface SousLotDetail {
  sousLot: string;
  quantiteLancee: number;
  unite: string;
}

interface ExpeditionHistoryItem {
  id: number;
  palette: string | null;
  codeDeclaration: string | null;
  numOF: string;
  article: string;
  quantiteTotale: number;
  unite: string;
  date_expedition: string;
  lot: string;
  sousLots: SousLotDetail[];
  expedie: boolean;
}

// ✅ Interface ScannedData avec sousLots
interface ScannedData {
  id: number;
  palette?: string | null;
  codeDeclaration?: string | null;
  numOF: string;
  article: string;
  quantiteLancee: number;
  unite: string;
  date_creation: string;
  date_expedition: string | null;
  lot: string;
  sousLot: string;
  expedie: boolean;
  type: "P" | "S";
  qteUS: number;
  coefUS: number;
  quantiteLanceeUVC: number | null;
  qteUSUVC: number | null;
  codeArticle: string;
  sousLots?: {
    sousLot: string;
    quantiteLancee: number;
    qteUS: number;
    unite: string;
  }[];
}

interface Stats {
  total: number;
  monthly: { mois: number; total: number }[];
}

const formatDate = (date: string | null): string => {
  if (!date) return "N/A";
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return date;

    // ✅ Forcer le fuseau horaire Tunisia (UTC+1)
    return dateObj.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Africa/Tunis", // ✅ Fuseau horaire de la Tunisie
    });
  } catch {
    return date;
  }
};
const isExpedie = (data: ScannedData): boolean => {
  return data.expedie === true;
};

const getTypeLabel = (data: ScannedData): string => {
  if (data.palette) return "📦 Palette (Prestataire)";
  if (data.codeDeclaration) return "📋 Code Déclaration (Salarié)";
  return "Type inconnu";
};

const getPaletteIdentifiant = (data: ScannedData | null): string => {
  if (!data) return "";
  return data.palette || data.codeDeclaration || "";
};

export default function ExpeditionScreen() {
  console.log("📦 [ExpeditionScreen] Écran EXPÉDITION chargé !");

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [nom, setNom] = useState("Opérateur");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showHistorique, setShowHistorique] = useState(false);
  const [apiUrl, setApiUrl] = useState("");

  const [scannedData, setScannedData] = useState<ScannedData | null>(null);
  const [stats, setStats] = useState<Stats>({ total: 0, monthly: [] });

  const [historique, setHistorique] = useState<ExpeditionHistoryItem[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  const [palettesExpediees, setPalettesExpediees] = useState(0);
  const countedPalettesRef = useRef<Set<string>>(new Set());

  const [permission, requestPermission] = useCameraPermissions();

  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const refreshToken = await AsyncStorage.getItem("refresh_token");
      if (!refreshToken) return null;

      const url = await getConfiguredApiUrl();
      const response = await fetch(`${url}/refresh-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();
      if (response.ok && data.accessToken) {
        await AsyncStorage.setItem("access_token", data.accessToken);
        return data.accessToken;
      }
      return null;
    } catch (error) {
      console.error("❌ Erreur refresh:", error);
      return null;
    }
  }, []);

  const clearTokensAndLogout = useCallback(async () => {
    try {
      const refreshToken = await AsyncStorage.getItem("refresh_token");
      const url = await getConfiguredApiUrl();
      if (refreshToken) {
        await fetch(`${url}/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
      }
      await AsyncStorage.multiRemove([
        "access_token",
        "refresh_token",
        "user",
        "user_roles",
        "selected_role",
      ]);
      router.replace("/(auth)/login");
    } catch (error) {
      console.error("❌ Erreur logout:", error);
      router.replace("/(auth)/login");
    }
  }, []);

  const fetchWithToken = useCallback(
    async (url: string, options: RequestInit = {}) => {
      try {
        let token = await AsyncStorage.getItem("access_token");
        if (!token) {
          const newToken = await refreshAccessToken();
          if (!newToken) throw new Error("Session expirée");
          token = newToken;
        }

        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...options.headers,
        };

        let response = await fetch(url, { ...options, headers });

        if (response.status === 401) {
          const newToken = await refreshAccessToken();
          if (newToken) {
            const retryHeaders = {
              "Content-Type": "application/json",
              Authorization: `Bearer ${newToken}`,
              ...options.headers,
            };
            response = await fetch(url, { ...options, headers: retryHeaders });
          } else {
            await clearTokensAndLogout();
            throw new Error("Session expirée");
          }
        }

        return response;
      } catch (error) {
        console.error("❌ Erreur fetchWithToken:", error);
        throw error;
      }
    },
    [refreshAccessToken, clearTokensAndLogout],
  );

  useEffect(() => {
    const checkAccess = async () => {
      try {
        console.log("🔍 [ExpeditionScreen] Vérification des rôles...");

        const accessToken = await AsyncStorage.getItem("access_token");
        if (!accessToken) {
          console.log("❌ Pas de token");
          Alert.alert("⛔ Non authentifié", "Veuillez vous reconnecter.");
          router.replace("/(auth)/login");
          setIsChecking(false);
          return;
        }

        const rolesString = await AsyncStorage.getItem("user_roles");
        if (!rolesString) {
          console.log("❌ Aucun rôle trouvé");
          Alert.alert("⛔ Accès refusé", "Vous n'avez pas les droits.");
          router.replace("/(auth)/login");
          setIsChecking(false);
          return;
        }

        const userRoles = JSON.parse(rolesString);
        console.log("👤 Rôles:", userRoles);
        setUserRoles(userRoles);

        const hasAccess = userRoles.some((role: string) =>
          ["Expéditeur", "Admin"].includes(role),
        );

        if (!hasAccess) {
          Alert.alert(
            "⛔ Accès refusé",
            "Vous n'avez pas les droits pour accéder à cette page.",
          );
          router.replace("/(auth)/login");
          setIsChecking(false);
          return;
        }

        console.log("✅ Accès autorisé !");
        setIsAuthorized(true);
      } catch (error) {
        console.error("❌ Erreur vérification:", error);
        router.replace("/(auth)/login");
      } finally {
        setIsChecking(false);
      }
    };

    checkAccess();
  }, []);

  const fetchStats = useCallback(
    async (url?: string) => {
      const baseUrl = url || apiUrl;
      if (!baseUrl) {
        console.warn("⚠️ API URL non configurée");
        return;
      }

      try {
        console.log("📊 Récupération des statistiques...");
        const response = await fetchWithToken(
          `${baseUrl}/api/expedition/stats`,
        );
        if (!response.ok) throw new Error("Erreur serveur");
        const data = await response.json();
        console.log("📊 Statistiques reçues:", data);
        setStats(data);
      } catch (e) {
        console.error("❌ Erreur fetch stats:", e);
      }
    },
    [apiUrl, fetchWithToken],
  );

  const fetchHistorique = useCallback(
    async (pageNum = 1, search = "") => {
      if (!apiUrl) return;

      try {
        setLoadingHist(true);
        const url = `${apiUrl}/api/expedition/historique?page=${pageNum}&search=${encodeURIComponent(search)}&limit=${ITEMS_PER_PAGE}`;
        console.log(`📜 FETCH HISTORIQUE - Page ${pageNum}:`, url);
        const response = await fetchWithToken(url);

        if (response.ok) {
          const data = await response.json();
          if (data.items) {
            const normalized: ExpeditionHistoryItem[] = data.items.map(
              (item: any) => ({
                id: item.id,
                palette: item.palette ?? null,
                codeDeclaration: item.codeDeclaration ?? null,
                numOF: item.numOF,
                article: item.article,
                quantiteTotale: item.quantiteTotale ?? item.quantiteLancee ?? 0,
                unite: item.unite,
                date_expedition: item.date_expedition,
                lot: item.lot,
                sousLots: Array.isArray(item.sousLots)
                  ? item.sousLots
                  : item.sousLot
                    ? [
                        {
                          sousLot: item.sousLot,
                          quantiteLancee: item.quantiteLancee ?? 0,
                          unite: item.unite,
                        },
                      ]
                    : [],
                expedie: item.expedie,
              }),
            );

            setHistorique(normalized);
            setTotalItems(data.total || 0);
            setTotalPages(data.totalPages || 1);
            setCurrentPage(pageNum);
            console.log(
              `✅ Historique: page ${pageNum}/${data.totalPages}, ${normalized.length} palettes`,
            );
          }
        }
      } catch (e) {
        console.error("❌ Erreur fetchHistorique:", e);
        Alert.alert("Erreur", "Impossible de charger l'historique");
      } finally {
        setLoadingHist(false);
      }
    },
    [apiUrl, fetchWithToken],
  );

  const goToPage = useCallback(
    (pageNum: number) => {
      if (pageNum < 1 || pageNum > totalPages || pageNum === currentPage)
        return;
      setCurrentPage(pageNum);
      fetchHistorique(pageNum, searchTerm);
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: 0, animated: true });
      }
    },
    [totalPages, currentPage, searchTerm, fetchHistorique],
  );

  const handleSearch = useCallback(
    (text: string) => {
      setSearchTerm(text);
      setCurrentPage(1);
      fetchHistorique(1, text);
    },
    [fetchHistorique],
  );

  const clearSearch = useCallback(() => {
    setSearchTerm("");
    setCurrentPage(1);
    fetchHistorique(1, "");
  }, [fetchHistorique]);

  useEffect(() => {
    const init = async () => {
      try {
        const url = await getConfiguredApiUrl();
        setApiUrl(url);
        console.log("✅ API URL chargée:", url);

        const userData = await AsyncStorage.getItem("user");
        if (userData) {
          const user = JSON.parse(userData);
          setNom(user.nom || "Opérateur");
          setUserRoles(user.roles || []);
        }

        await fetchStats(url);
        await fetchHistorique(1, "");

        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }).start();
      } catch (error) {
        console.error("❌ Erreur initialisation:", error);
        Alert.alert("Erreur", "Impossible de charger les données");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  useFocusEffect(
    useCallback(() => {
      console.log("🔄 [ExpeditionScreen] Rafraîchissement des données (focus)");
      if (apiUrl) {
        fetchStats(apiUrl);
        fetchHistorique(currentPage, searchTerm);
      }
    }, [apiUrl, searchTerm, currentPage, fetchStats, fetchHistorique]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStats();
    await fetchHistorique(1, searchTerm);
    setRefreshing(false);
  }, [fetchStats, fetchHistorique, searchTerm]);

  const openSidebar = useCallback(() => {
    setSidebarOpen(true);
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 14,
      }),
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const closeSidebar = useCallback(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: -SIDEBAR_WIDTH,
        useNativeDriver: true,
        tension: 100,
        friction: 14,
      }),
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setSidebarOpen(false));
  }, []);

  const handleLogout = useCallback(async () => {
    closeSidebar();
    await clearTokensAndLogout();
  }, [closeSidebar, clearTokensAndLogout]);

  const switchRole = useCallback(async () => {
    try {
      await AsyncStorage.removeItem("selected_role");
      router.push("/(auth)/RoleSelectionScreen");
    } catch (error) {
      console.error("❌ Erreur changement de rôle:", error);
    }
  }, []);

  const handleBarcodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (!apiUrl) {
        Alert.alert("Erreur", "URL API non configurée");
        return;
      }

      setShowCamera(false);
      try {
        const response = await fetchWithToken(
          `${apiUrl}/api/expedition/check/${encodeURIComponent(data.trim())}`,
        );

        if (!response.ok) {
          const errorData = await response.json();
          Alert.alert("Erreur", errorData.message || "Palette non trouvée.");
          return;
        }

        const result = await response.json();
        console.log("📦 Données complètes:", result);
        setScannedData(result);
        Animated.spring(fadeAnim, {
          toValue: 1,
          useNativeDriver: true,
        }).start();
      } catch (e) {
        Alert.alert("Erreur", "Serveur injoignable");
      }
    },
    [apiUrl, fetchWithToken, fadeAnim],
  );

  const expedierPalette = useCallback(async () => {
    setLoading(true);
    try {
      const codeToValidate =
        scannedData?.palette || scannedData?.codeDeclaration;
      console.log(`📤 Validation de la palette: ${codeToValidate}`);

      const response = await fetchWithToken(
        `${apiUrl}/api/expedition/valider`,
        {
          method: "POST",
          body: JSON.stringify({ code: codeToValidate }),
        },
      );

      const result = await response.json();

      if (response.ok) {
        Alert.alert(
          "✅ Succès",
          `Palette validée avec succès !\n${result.message || ""}`,
        );

        const identifiantPalette = getPaletteIdentifiant(scannedData);

        if (
          identifiantPalette &&
          !countedPalettesRef.current.has(identifiantPalette)
        ) {
          countedPalettesRef.current.add(identifiantPalette);
          setPalettesExpediees((prev) => prev + 1);
          console.log(
            `📊 Nouvelle palette expédiée (total session: ${countedPalettesRef.current.size})`,
          );
        } else {
          console.log(
            `📊 Sous-lot supplémentaire pour la palette "${identifiantPalette}" — compteur inchangé`,
          );
        }

        setScannedData(null);
        await fetchStats();
        await fetchHistorique(1, searchTerm);
      } else {
        let errorMessage = "Erreur lors de la validation.";
        if (result.error) {
          errorMessage = result.error.includes("déjà")
            ? "⚠️ Cette palette a déjà été expédiée."
            : result.error;
        }
        Alert.alert("❌ Erreur", errorMessage);
        await fetchStats();
      }
    } catch (e) {
      console.error("❌ Erreur validation:", e);
      Alert.alert(
        "❌ Erreur",
        "Impossible de contacter le serveur.\nVérifiez votre connexion.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    apiUrl,
    scannedData,
    fetchWithToken,
    fetchStats,
    fetchHistorique,
    searchTerm,
  ]);

  const validerExpedition = useCallback(async () => {
    if (!apiUrl) {
      Alert.alert("❌ Erreur", "URL du serveur non configurée");
      return;
    }

    if (!scannedData) {
      Alert.alert("❌ Erreur", "Aucune palette scannée");
      return;
    }

    if (isExpedie(scannedData)) {
      Alert.alert(
        "⚠️ Attention",
        "Cette palette a déjà été expédiée !\n" +
          `Date d'expédition : ${formatDate(scannedData.date_expedition)}`,
      );
      return;
    }

    const codeDisplay =
      scannedData.palette || scannedData.codeDeclaration || "N/A";
    Alert.alert(
      "📦 Confirmation",
      `Voulez-vous vraiment expédier la palette :\n"${codeDisplay}" ?`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Confirmer", onPress: () => expedierPalette() },
      ],
    );
  }, [apiUrl, scannedData, expedierPalette]);

  const imprimerPalette = useCallback(async () => {
    if (!scannedData) {
      Alert.alert("Erreur", "Aucune palette scannée");
      return;
    }

    try {
      const zplData: ZplData = {
        type: scannedData.type || "S",
        palette: scannedData.palette || scannedData.codeDeclaration || "N/A",
        of: scannedData.numOF || "N/A",
        numof: scannedData.numOF || "N/A",
        designation: scannedData.article || "Inconnu",
        matricule: "",
        quantiteLancee: String(scannedData.quantiteLancee || 0),
        quantiteLanceeUVC: scannedData.quantiteLanceeUVC || undefined,
        lignes: [
          {
            slot: scannedData.sousLot || "N/A",
            qty: scannedData.quantiteLancee || 0,
            LOT: scannedData.lot || "N/A",
            qteUVC: scannedData.quantiteLanceeUVC || undefined,
          },
        ],
        dateExp: scannedData.date_expedition || null,
      };

      const zpl = generateZplLabel(zplData);
      await sendToPrinter(zpl);
    } catch (error) {
      console.error("❌ Erreur impression:", error);
      Alert.alert("Erreur", "Impossible d'imprimer l'étiquette");
    }
  }, [scannedData]);

  const telechargerPdf = useCallback(async () => {
    if (!scannedData) {
      Alert.alert("Erreur", "Aucune palette scannée");
      return;
    }

    try {
      const zplData: ZplData = {
        type: scannedData.type || "S",
        palette: scannedData.palette || scannedData.codeDeclaration || "N/A",
        of: scannedData.numOF || "N/A",
        numof: scannedData.numOF || "N/A",
        designation: scannedData.article || "Inconnu",
        matricule: "",
        quantiteLancee: String(scannedData.quantiteLancee || 0),
        quantiteLanceeUVC: scannedData.quantiteLanceeUVC ?? undefined,
        lignes: [
          {
            slot: scannedData.sousLot || "N/A",
            qty: scannedData.quantiteLancee || 0,
            LOT: scannedData.lot || "N/A",
            qteUVC: scannedData.quantiteLanceeUVC ?? undefined,
          },
        ],
        dateExp: scannedData.date_expedition || null,
      };

      await downloadLabelPdf(zplData);
    } catch (error) {
      console.error("❌ Erreur téléchargement PDF:", error);
      Alert.alert("Erreur", "Impossible de télécharger le PDF");
    }
  }, [scannedData]);

  const chartLabels = stats.monthly?.map((d) => MOIS[(d.mois || 1) - 1]) || [];
  const chartDataValues = stats.monthly?.map((d) => d.total || 0) || [];
  const hasData = chartLabels.length > 0 && chartDataValues.some((v) => v > 0);

  const chartData = {
    labels: hasData ? chartLabels : ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun"],
    datasets: [
      {
        data: hasData ? chartDataValues : [0, 0, 0, 0, 0, 0],
        color: (opacity = 1) => `rgba(192, 32, 42, ${opacity})`,
        strokeWidth: 3,
      },
    ],
  };

  const chartConfig = {
    backgroundGradientFrom: "#FFF",
    backgroundGradientTo: "#FFF",
    color: (opacity = 1) => `rgba(192, 32, 42, ${opacity})`,
    labelColor: () => C.inkLight,
    strokeWidth: 2,
    decimalPlaces: 0,
    propsForDots: { r: "5", strokeWidth: "2", stroke: C.red },
    propsForBackgroundLines: {
      stroke: "rgba(125,110,101,0.15)",
      strokeWidth: 1,
    },
  };

  if (isChecking) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.loadWrap}>
          <ActivityIndicator size="large" color={C.red} />
          <Text style={styles.loadTxt}>Vérification des droits...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthorized) return null;

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.loadWrap}>
          <ActivityIndicator size="large" color={C.red} />
          <Text style={styles.loadTxt}>Chargement des données...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={styles.topbar}>
        <TouchableOpacity style={styles.hamburger} onPress={openSidebar}>
          <Text style={styles.hamburgerIcon}>☰</Text>
        </TouchableOpacity>
        <View style={styles.centerTitleContainer}>
          <Text style={styles.topbarTitle}>
            {showHistorique ? "📜 HISTORIQUE DES EXPÉDITIONS" : "EXPÉDITION"}
          </Text>
          <Text style={styles.topbarSubTitle}>Dr. Oetker · Vanoise App</Text>
        </View>
        <View style={styles.logoWrap}>
          <Image
            source={require("../../assets/favicon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </View>
      <View style={styles.redRule} />

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[C.red]}
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Stats */}
          {!showHistorique && (
            <View style={styles.statsCard}>
              <View style={styles.statsHeader}>
                <Text style={styles.statsLabel}>📦 PALETTES EXPÉDIÉES</Text>
                <View style={styles.statsBadge}>
                  <Text style={styles.statsBadgeText}>CE MOIS</Text>
                </View>
              </View>
              <Text style={styles.statsVal}>{stats.total || 0}</Text>
              <View style={styles.statsProgress}>
                <View
                  style={[
                    styles.statsProgressBar,
                    { width: `${Math.min((stats.total / 100) * 100, 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.statsSub}>
                Objectif mensuel : 100 palettes
              </Text>
            </View>
          )}

          {/* Scanner */}
          {!showStats && !showHistorique && (
            <>
              {!scannedData ? (
                <TouchableOpacity
                  style={styles.scanBtn}
                  onPress={async () => {
                    const p = await requestPermission();
                    if (p.granted) setShowCamera(true);
                  }}
                >
                  <Text style={styles.scanBtnIcon}>📷</Text>
                  <Text style={styles.scanBtnTxt}>SCANNER UNE PALETTE</Text>
                  <Text style={styles.scanBtnSub}>
                    Appuyez pour activer la caméra
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.infoCard}>
                  <View style={styles.infoHeader}>
                    <Text style={styles.infoBadge}>✅ SCAN RÉUSSI</Text>
                    <TouchableOpacity
                      onPress={() => setScannedData(null)}
                      style={styles.infoClose}
                    >
                      <Text style={styles.infoCloseTxt}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    style={styles.infoScroll}
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled={true}
                  >
                    {/* Identifiant */}
                    <View style={styles.infoGroup}>
                      <Text style={styles.infoGroupTitle}>🆔 IDENTIFIANT</Text>
                      {scannedData.palette ? (
                        <>
                          <View
                            style={[styles.infoRow, styles.infoRowHighlight]}
                          >
                            <Text style={styles.infoLabel}>Palette</Text>
                            <Text
                              style={[
                                styles.infoValue,
                                styles.infoValueHighlight,
                              ]}
                            >
                              {scannedData.palette || "N/A"}
                            </Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>
                              Code Déclaration
                            </Text>
                            <Text style={styles.infoValue}>
                              {scannedData.codeDeclaration || "N/A"}
                            </Text>
                          </View>
                        </>
                      ) : (
                        <>
                          <View
                            style={[styles.infoRow, styles.infoRowHighlight]}
                          >
                            <Text style={styles.infoLabel}>
                              Code Déclaration
                            </Text>
                            <Text
                              style={[
                                styles.infoValue,
                                styles.infoValueHighlight,
                              ]}
                            >
                              {scannedData.codeDeclaration || "N/A"}
                            </Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Palette</Text>
                            <Text style={styles.infoValue}>
                              {scannedData.palette || "N/A"}
                            </Text>
                          </View>
                        </>
                      )}
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Type</Text>
                        <Text
                          style={[
                            styles.infoValue,
                            scannedData.type === "P"
                              ? styles.statusExpedie
                              : styles.statusNonExpedie,
                          ]}
                        >
                          {getTypeLabel(scannedData)}
                        </Text>
                      </View>
                    </View>

                    

                    {/* Production */}
                    <View style={styles.infoGroup}>
                      <Text style={styles.infoGroupTitle}>🏭 PRODUCTION</Text>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Numéro OF</Text>
                        <Text style={styles.infoValue}>
                          {scannedData.numOF || "N/A"}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Article</Text>
                        <Text style={styles.infoValue}>
                          {scannedData.article || "N/A"}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Code Article</Text>
                        <Text style={styles.infoValue}>
                          {scannedData.codeArticle || "N/A"}
                        </Text>
                      </View>
                    </View>

                    {/* ✅ LOTS & SOUS-LOTS - CORRIGÉ */}
                    <View style={styles.infoGroup}>
                      <Text style={styles.infoGroupTitle}>
                        🏷️ LOTS & SOUS-LOTS
                      </Text>

                      {/* Lot principal */}
                      <View style={styles.lotRow}>
                        <View style={styles.lotInfo}>
                          <Text style={styles.lotLabel}>📦 Lot</Text>
                          <Text style={styles.lotValue}>
                            {scannedData.lot || "N/A"}
                          </Text>
                        </View>
                        <View style={styles.lotInfo}>
                          <Text style={styles.lotLabel}>Qté Totale</Text>
                          <Text style={styles.lotValue}>
                            {scannedData.quantiteLancee || 0}{" "}
                            {scannedData.unite || ""}
                          </Text>
                        </View>
                      </View>

                      {/* ✅ Liste de TOUS les sous-lots */}
                      <Text style={styles.sousLotsTitle}>
                        📎 Détail des sous-lots :
                      </Text>

                      {scannedData.sousLots &&
                      scannedData.sousLots.length > 0 ? (
                        scannedData.sousLots.map((sl, idx) => (
                          <View key={idx} style={styles.sousLotRowDetail}>
                            <View style={styles.sousLotInfo}>
                              <Text style={styles.sousLotLabel}>
                                Sous-lot {idx + 1}
                              </Text>
                              <Text style={styles.sousLotValue}>
                                {sl.sousLot || "N/A"}
                              </Text>
                            </View>
                            <View style={styles.sousLotInfo}>
                              <Text style={styles.sousLotLabel}>Qté</Text>
                              <Text style={styles.sousLotValue}>
                                {sl.quantiteLancee || 0}{" "}
                                {sl.unite || scannedData.unite || ""}
                              </Text>
                            </View>
                            {scannedData.type === "S" && (
                              <View style={styles.sousLotInfo}>
                                <Text style={styles.sousLotLabel}>UVC</Text>
                                <Text
                                  style={[
                                    styles.sousLotValue,
                                    { color: C.blue },
                                  ]}
                                >
                                  {(
                                    sl.quantiteLancee *
                                    (scannedData.coefUS || 1)
                                  ).toFixed(2)}
                                </Text>
                              </View>
                            )}
                          </View>
                        ))
                      ) : (
                        <Text style={styles.sousLotEmpty}>
                          Aucun sous-lot enregistré
                        </Text>
                      )}

                      {/* ✅ Total */}
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>
                          📊 Total palette :
                        </Text>
                        <Text style={styles.totalValue}>
                          {scannedData.quantiteLancee || 0}{" "}
                          {scannedData.unite || ""}
                        </Text>
                      </View>
                    </View>

                    {/* Dates */}
                    <View style={styles.infoGroup}>
                      <Text style={styles.infoGroupTitle}>📅 DATES</Text>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Date Création</Text>
                        <Text style={styles.infoValue}>
                          {formatDate(scannedData.date_creation)}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.infoRow,
                          scannedData.date_expedition
                            ? styles.infoRowHighlight
                            : null,
                        ]}
                      >
                        <Text style={styles.infoLabel}>Date Expédition</Text>
                        <Text
                          style={[
                            styles.infoValue,
                            scannedData.date_expedition
                              ? styles.statusExpedie
                              : styles.statusNonExpedie,
                          ]}
                        >
                          {formatDate(scannedData.date_expedition)}
                        </Text>
                      </View>
                    </View>

                    {/* Statut */}
                    <View style={styles.infoGroup}>
                      <Text style={styles.infoGroupTitle}>📌 STATUT</Text>
                      <View
                        style={[
                          styles.infoRow,
                          {
                            backgroundColor: isExpedie(scannedData)
                              ? "#E8F5E9"
                              : "#FFEBEE",
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            borderWidth: 1,
                            borderColor: isExpedie(scannedData)
                              ? C.green
                              : C.red,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.infoLabel,
                            { fontWeight: "700", fontSize: 14 },
                          ]}
                        >
                          Statut
                        </Text>
                        <Text
                          style={[
                            styles.infoValue,
                            {
                              fontWeight: "800",
                              fontSize: 16,
                              color: isExpedie(scannedData) ? C.green : C.red,
                            },
                          ]}
                        >
                          {isExpedie(scannedData)
                            ? "✅ Expédiée"
                            : "⏳ En attente"}
                        </Text>
                      </View>
                    </View>
                  </ScrollView>

                  {isExpedie(scannedData) ? (
                    <View style={styles.errorCard}>
                      <Text style={styles.errorIcon}>⚠️</Text>
                      <Text style={styles.errorTxt}>
                        Cette palette est déjà expédiée
                      </Text>
                      <Text style={styles.errorSub}>
                        Expédiée le {formatDate(scannedData.date_expedition)}
                      </Text>
                      <TouchableOpacity
                        style={styles.errorBtn}
                        onPress={() => setScannedData(null)}
                      >
                        <Text style={styles.errorBtnTxt}>Fermer</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.validBtn}
                        onPress={validerExpedition}
                        disabled={loading}
                      >
                        {loading ? (
                          <ActivityIndicator color="#FFF" />
                        ) : (
                          <>
                            <Text style={styles.btnTxt}>
                              VALIDER L&apos;EXPÉDITION
                            </Text>
                            <Text style={styles.btnSub}>
                              Confirmer la sortie du stock
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <View
                        style={{ flexDirection: "row", gap: 10, marginTop: 10 }}
                      >
                        <TouchableOpacity
                          style={[styles.printBtn, { flex: 1 }]}
                          onPress={imprimerPalette}
                        >
                          <Text style={styles.printBtnTxt}>🖨️ Imprimer</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.printBtn,
                            { flex: 1, backgroundColor: C.blue },
                          ]}
                          onPress={telechargerPdf}
                        >
                          <Text style={styles.printBtnTxt}>⬇️ PDF</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              )}
            </>
          )}

          {/* Historique */}
          {showHistorique && (
            <View style={styles.historiqueContainer}>
              <View style={styles.searchBarContainer}>
                <Text style={styles.searchBarIcon}>🔍</Text>
                <TextInput
                  style={styles.searchBarInput}
                  placeholder="Rechercher par palette, code, article..."
                  placeholderTextColor={C.inkLight}
                  value={searchTerm}
                  onChangeText={handleSearch}
                />
                {searchTerm.length > 0 && (
                  <TouchableOpacity
                    onPress={clearSearch}
                    style={styles.clearSearchContainer}
                  >
                    <Text style={styles.clearSearchText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {totalItems > 0 && (
                <Text style={styles.histCounter}>
                  {totalItems} palette{totalItems > 1 ? "s" : ""} expédiée
                  {totalItems > 1 ? "s" : ""}
                </Text>
              )}

              {loadingHist && historique.length === 0 ? (
                <View style={{ marginVertical: 40 }}>
                  <ActivityIndicator size="small" color={C.red} />
                </View>
              ) : historique.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>📭</Text>
                  <Text style={styles.emptyTitle}>Aucune expédition</Text>
                  <Text style={styles.emptySub}>
                    Les palettes expédiées apparaîtront ici
                  </Text>
                </View>
              ) : (
                <>
                  {historique.map((item, index) => (
                    <View key={index} style={styles.histCard}>
                      <View style={styles.histCardHeader}>
                        <Text style={styles.histPalNum}>
                          {item.palette || item.codeDeclaration || "N/A"}
                        </Text>
                        <View style={styles.histStatusBadge}>
                          <Text style={styles.histStatusText}>✅ Expédiée</Text>
                        </View>
                      </View>
                      <Text style={styles.histArticle}>
                        📦 {item.article || "Article inconnu"}
                      </Text>

                      <View style={styles.histDetails}>
                        <View style={styles.histDetailRow}>
                          <Text style={styles.histDetailLabel}>🏭 OF</Text>
                          <Text style={styles.histDetailValue}>
                            {item.numOF || "N/A"}
                          </Text>
                        </View>
                        <View style={styles.histDetailRow}>
                          <Text style={styles.histDetailLabel}>🏷️ Lot</Text>
                          <Text style={styles.histDetailValue}>
                            {item.lot || "N/A"}
                          </Text>
                        </View>
                        <View style={styles.histDetailRow}>
                          <Text style={styles.histDetailLabel}>
                            📊 Qté totale
                          </Text>
                          <Text style={styles.histDetailValue}>
                            {item.quantiteTotale || 0} {item.unite || "CAR"}
                          </Text>
                        </View>
                        <View style={styles.histDetailRow}>
                          <Text style={styles.histDetailLabel}>
                            📅 Expédié le
                          </Text>
                          <Text style={styles.histDetailValue}>
                            {formatDate(item.date_expedition)}
                          </Text>
                        </View>
                      </View>

                      {item.sousLots && item.sousLots.length > 0 && (
                        <View style={styles.sousLotsBlock}>
                          <Text style={styles.sousLotsTitle}>
                            📎 Sous-lots ({item.sousLots.length})
                          </Text>
                          {item.sousLots.map((sl, i) => (
                            <View key={i} style={styles.sousLotRow}>
                              <Text style={styles.sousLotName}>
                                {sl.sousLot || "N/A"}
                              </Text>
                              <Text style={styles.sousLotQty}>
                                {sl.quantiteLancee || 0}{" "}
                                {sl.unite || item.unite || ""}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}

                  {totalPages > 1 && (
                    <View style={styles.paginationWrapper}>
                      <TouchableOpacity
                        style={[
                          styles.pagBtn,
                          currentPage === 1 && styles.pagBtnDisabled,
                        ]}
                        onPress={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1 || loadingHist}
                      >
                        <Text
                          style={[
                            styles.pagBtnTxt,
                            currentPage === 1 && styles.pagBtnTxtDisabled,
                          ]}
                        >
                          ◀ Précédent
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.pageBadge}>
                        <Text style={styles.pageBadgeTxt}>
                          {currentPage} / {totalPages}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.pagBtn,
                          currentPage === totalPages && styles.pagBtnDisabled,
                        ]}
                        onPress={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages || loadingHist}
                      >
                        <Text
                          style={[
                            styles.pagBtnTxt,
                            currentPage === totalPages &&
                              styles.pagBtnTxtDisabled,
                          ]}
                        >
                          Suivant ▶
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {loadingHist && (
                    <View style={{ marginVertical: 10 }}>
                      <ActivityIndicator size="small" color={C.red} />
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* Statistiques */}
          {showStats && (
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>📈 Évolution mensuelle</Text>
                <View style={styles.chartDot} />
              </View>
              {hasData ? (
                <LineChart
                  data={chartData}
                  width={SCREEN_WIDTH - 64}
                  height={200}
                  chartConfig={chartConfig}
                  bezier
                  style={styles.chart}
                  withInnerLines
                  withOuterLines={false}
                  withVerticalLabels
                  formatYLabel={(value) => Math.round(Number(value)).toString()}
                />
              ) : (
                <View style={styles.chartEmpty}>
                  <Text style={styles.chartEmptyText}>
                    📊 Aucune donnée disponible
                  </Text>
                  <Text style={styles.chartEmptySub}>
                    Les expéditions apparaîtront ici
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.footer}>
            <View style={styles.footerDivider} />
            <Text style={styles.copyright}>
              © 2026{" "}
              <Text
                style={styles.copyrightLink}
                onPress={() => Linking.openURL("https://vanoiserie.tn/")}
              >
                Dr. Oetker Vanoise
              </Text>{" "}
              Tous droits réservés.
            </Text>
          </View>
          <View style={{ height: 32 }} />
        </Animated.View>
      </ScrollView>

      {showCamera && (
        <View style={StyleSheet.absoluteFill}>
          <CameraView
            style={StyleSheet.absoluteFill}
            onBarcodeScanned={handleBarcodeScanned}
          />
          <TouchableOpacity
            style={styles.closeCam}
            onPress={() => setShowCamera(false)}
          >
            <Text style={styles.closeCamTxt}>✕ Fermer</Text>
          </TouchableOpacity>
        </View>
      )}

      {sidebarOpen && (
        <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={closeSidebar}
          />
        </Animated.View>
      )}

      <Animated.View
        style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}
      >
        <View style={sb.stripe} />
        <View style={sb.logoBlock}>
          <Image
            source={require("../../assets/favicon.png")}
            style={sb.logoImg}
            resizeMode="contain"
          />
          <Text style={sb.brand}>DR. OETKER</Text>
          <Text style={sb.brandSub}>VANOISE PORTAL</Text>
        </View>
        <View style={sb.header}>
          <View style={sb.avatarLg}>
            <Text style={sb.avatarLgTxt}>
              {nom ? nom[0].toUpperCase() : "V"}
            </Text>
          </View>
          <View>
            <Text style={sb.name}>{nom || "Opérateur"}</Text>
            <Text style={sb.role}>Logistique · Vanoise</Text>
          </View>
        </View>
        <View style={sb.sep} />
        <View style={sb.section}>
          <Text style={sb.sectionLabel}>NAVIGATION</Text>
          <TouchableOpacity
            style={[sb.item, !showStats && !showHistorique && sb.itemActive]}
            onPress={() => {
              setShowStats(false);
              setShowHistorique(false);
              setScannedData(null);
              closeSidebar();
            }}
          >
            <Text style={sb.itemIcon}>📦</Text>
            <Text
              style={[
                sb.itemLabel,
                !showStats && !showHistorique && sb.itemLabelActive,
              ]}
            >
              Expédition
            </Text>
            {!showStats && !showHistorique && <View style={sb.pip} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[sb.item, showHistorique && sb.itemActive]}
            onPress={() => {
              setShowHistorique(true);
              setShowStats(false);
              closeSidebar();
            }}
          >
            <Text style={sb.itemIcon}>📜</Text>
            <Text style={[sb.itemLabel, showHistorique && sb.itemLabelActive]}>
              Historique
            </Text>
            {showHistorique && <View style={sb.pip} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[sb.item, showStats && sb.itemActive]}
            onPress={() => {
              setShowStats(true);
              setShowHistorique(false);
              closeSidebar();
            }}
          >
            <Text style={sb.itemIcon}>📊</Text>
            <Text style={[sb.itemLabel, showStats && sb.itemLabelActive]}>
              Statistiques
            </Text>
            {showStats && <View style={sb.pip} />}
          </TouchableOpacity>

          <View style={sb.sep} />

          {userRoles.length > 1 && (
            <TouchableOpacity style={sb.switchRoleItem} onPress={switchRole}>
              <Text style={sb.itemIcon}>🔄</Text>
              <Text style={sb.itemLabel}>Changer de rôle</Text>
            </TouchableOpacity>
          )}

          
        </View>
        <View style={sb.footer}>
          <TouchableOpacity style={sb.logoutBtn} onPress={handleLogout}>
            <Text style={sb.logoutTxt}>Se déconnecter</Text>
          </TouchableOpacity>
          <Text style={sb.version}>Dr. Oetker Vanoise · v1.0</Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: C.cream,
    backgroundColor: C.bg,
  },
  hamburger: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  hamburgerIcon: { color: C.inkMid, fontSize: 20, fontWeight: "bold" },
  centerTitleContainer: { alignItems: "center" },
  topbarTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: C.inkMid,
    letterSpacing: 1,
  },
  topbarSubTitle: { fontSize: 11, color: C.inkLight, marginTop: 1 },
  logoWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: "#ECDFD2",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.red,
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  logo: { width: 55, height: 32 },
  redRule: { height: 3, backgroundColor: C.red },
  scroll: { padding: 20, paddingBottom: 40 },

  loadWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadTxt: { color: C.inkLight, fontSize: 13 },

  statsCard: {
    backgroundColor: C.red,
    padding: 24,
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: C.red,
    shadowOpacity: 0.3,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statsLabel: {
    color: "#FFD1D1",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1,
  },
  statsBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statsBadgeText: { color: "#FFF", fontSize: 10, fontWeight: "700" },
  statsVal: {
    color: "#FFF",
    fontSize: 48,
    fontWeight: "900",
    marginBottom: 12,
  },
  statsProgress: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
  },
  statsProgressBar: {
    height: "100%",
    backgroundColor: "#FFF",
    borderRadius: 3,
  },
  statsSub: { color: "#FFD1D1", fontSize: 12, opacity: 0.8 },

  scanBtn: {
    backgroundColor: C.ink,
    padding: 24,
    borderRadius: 20,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: C.ink,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  scanBtnIcon: { fontSize: 40, marginBottom: 8 },
  scanBtnTxt: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 1,
  },
  scanBtnSub: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 4 },

  infoCard: {
    backgroundColor: C.surface,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  infoScroll: { flex: 1, maxHeight: SCREEN_HEIGHT * 0.65 },
  infoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  infoBadge: {
    backgroundColor: C.greenSoft,
    color: C.green,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    fontSize: 11,
    fontWeight: "700",
  },
  infoClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.redSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCloseTxt: { color: C.red, fontSize: 16, fontWeight: "700" },

  infoGroup: {
    marginBottom: 10,
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoGroupTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: C.inkMid,
    marginBottom: 8,
    letterSpacing: 0.5,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
    minHeight: 30,
  },
  infoRowHighlight: {
    backgroundColor: C.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 0,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoLabel: { fontSize: 13, color: C.inkLight, fontWeight: "600", flex: 0.45 },
  infoValue: {
    fontSize: 13,
    color: C.ink,
    fontWeight: "600",
    flex: 0.55,
    textAlign: "right",
    flexWrap: "wrap",
  },
  infoValueHighlight: { fontSize: 15, fontWeight: "800", color: C.red },

  uvcRow: {
    backgroundColor: "#EFF6FF",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 0,
    marginVertical: 2,
  },
  uvcLabel: { color: C.blue, fontWeight: "700" },
  uvcValue: { color: C.blue, fontWeight: "700" },

  lotHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 6,
  },
  lotHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: C.inkLight,
    flex: 1,
    textAlign: "center",
  },
  lotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    backgroundColor: C.surface,
    borderRadius: 8,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  lotRowSub: {
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: "dashed",
  },
  lotInfo: { flex: 1, alignItems: "center" },
  lotLabel: { fontSize: 10, color: C.inkLight, fontWeight: "500" },
  lotValue: { fontSize: 13, color: C.ink, fontWeight: "700", marginTop: 2 },

  // ✅ Styles pour les sous-lots détaillés
  sousLotsTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: C.inkMid,
    marginTop: 8,
    marginBottom: 6,
  },
  sousLotRowDetail: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: C.surface,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  sousLotInfo: {
    flex: 1,
    alignItems: "center",
  },
  sousLotLabel: {
    fontSize: 9,
    color: C.inkLight,
    fontWeight: "500",
  },
  sousLotValue: {
    fontSize: 12,
    color: C.ink,
    fontWeight: "700",
  },
  sousLotEmpty: {
    fontSize: 12,
    color: C.inkLight,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 8,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: C.red,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: C.ink,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "900",
    color: C.red,
  },

  statusExpedie: { color: C.green, fontWeight: "700" },
  statusNonExpedie: { color: C.red, fontWeight: "700" },

  errorCard: {
    backgroundColor: C.redSoft,
    padding: 16,
    borderRadius: 16,
    marginTop: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.red,
  },
  errorIcon: { fontSize: 32, marginBottom: 6 },
  errorTxt: {
    color: C.red,
    fontWeight: "bold",
    fontSize: 15,
    textAlign: "center",
  },
  errorSub: {
    color: C.inkLight,
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  errorBtn: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 24,
    backgroundColor: C.red,
    borderRadius: 8,
  },
  errorBtnTxt: { color: "#FFF", fontWeight: "600" },

  validBtn: {
    backgroundColor: C.green,
    padding: 14,
    borderRadius: 14,
    marginTop: 10,
    alignItems: "center",
    shadowColor: C.green,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  btnTxt: { color: "#FFF", fontWeight: "bold", fontSize: 15, letterSpacing: 1 },
  btnSub: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 },

  printBtn: {
    backgroundColor: C.blue,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    flex: 1,
  },
  printBtnTxt: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 13,
  },

  chartCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  chartTitle: { fontSize: 14, fontWeight: "700", color: C.ink },
  chartDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.red },
  chart: { marginLeft: -10, borderRadius: 0 },
  chartEmpty: { height: 200, alignItems: "center", justifyContent: "center" },
  chartEmptyText: { color: C.inkLight, fontSize: 16, fontWeight: "600" },
  chartEmptySub: { color: C.inkFaint, fontSize: 13, marginTop: 4 },

  closeCam: {
    position: "absolute",
    top: 50,
    right: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 12,
    zIndex: 10,
  },
  closeCamTxt: { color: "#FFF", fontWeight: "bold", fontSize: 14 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(31,22,16,0.4)",
    zIndex: 99,
  },
  sidebar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: C.cream,
    borderRightWidth: 1,
    borderRightColor: C.border,
    zIndex: 100,
  },

  footer: { alignItems: "center", paddingVertical: 24, marginTop: 10 },
  footerDivider: {
    width: 40,
    height: 1,
    backgroundColor: C.border,
    borderRadius: 1,
    marginBottom: 16,
  },
  copyright: {
    fontSize: 12,
    color: C.inkLight,
    textAlign: "center",
    lineHeight: 20,
  },
  copyrightLink: { fontSize: 12, color: C.red, fontWeight: "700" },

  historiqueContainer: { flex: 1, paddingBottom: 20 },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3EFE9",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E6DCCE",
  },
  searchBarIcon: { marginRight: 10, fontSize: 16, color: C.inkLight },
  searchBarInput: { flex: 1, fontSize: 14, color: C.ink, fontWeight: "500" },
  clearSearchContainer: {
    padding: 4,
    backgroundColor: "rgba(31,22,16,0.1)",
    borderRadius: 100,
  },
  clearSearchText: { fontSize: 10, color: C.inkMid, fontWeight: "bold" },

  histCounter: {
    fontSize: 12,
    color: C.inkLight,
    textAlign: "right",
    marginBottom: 12,
    fontWeight: "500",
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: C.inkMid,
    marginBottom: 8,
  },
  emptySub: { fontSize: 14, color: C.inkLight, textAlign: "center" },

  histCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: C.green,
  },
  histCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  histPalNum: {
    fontSize: 15,
    fontWeight: "800",
    color: C.inkMid,
    letterSpacing: 0.5,
  },
  histStatusBadge: {
    backgroundColor: C.greenSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.green,
  },
  histStatusText: { fontSize: 10, fontWeight: "700", color: C.green },
  histArticle: {
    fontSize: 14,
    fontWeight: "600",
    color: C.ink,
    marginBottom: 8,
  },
  histDetails: {
    backgroundColor: "#FFF",
    borderRadius: 8,
    padding: 10,
  },
  histDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  histDetailLabel: { fontSize: 12, color: C.inkLight, fontWeight: "500" },
  histDetailValue: { fontSize: 12, color: C.ink, fontWeight: "600" },

  sousLotsBlock: {
    marginTop: 8,
    backgroundColor: "#FFF",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: "dashed",
  },

  sousLotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: C.surface,
    borderRadius: 6,
    marginBottom: 3,
  },
  sousLotName: { fontSize: 12, color: C.inkMid, fontWeight: "700" },
  sousLotQty: { fontSize: 12, color: C.inkLight, fontWeight: "600" },

  paginationWrapper: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 15,
    paddingVertical: 10,
  },
  pagBtn: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: "center",
    elevation: 1,
  },
  pagBtnDisabled: {
    backgroundColor: "#F5F5F5",
    borderColor: "#E0E0E0",
    elevation: 0,
  },
  pagBtnTxt: { color: C.red, fontWeight: "700", fontSize: 13 },
  pagBtnTxtDisabled: { color: "#B0B0B0" },
  pageBadge: {
    backgroundColor: C.redSoft,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(192,32,42,0.15)",
  },
  pageBadgeTxt: { color: C.red, fontWeight: "800", fontSize: 12 },
});

const sb = StyleSheet.create({
  stripe: { height: 4, backgroundColor: C.red },
  logoBlock: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 4,
  },
  logoImg: { width: 189, height: 64, marginBottom: 8 },
  brand: {
    fontSize: 14,
    fontWeight: "900",
    color: C.inkMid,
    letterSpacing: 0.5,
  },
  brandSub: {
    fontSize: 9,
    fontWeight: "700",
    color: C.red,
    letterSpacing: 2,
    marginTop: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  avatarLg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.red,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLgTxt: { color: "#FFF", fontWeight: "800", fontSize: 20 },
  name: { fontSize: 15, fontWeight: "800", color: C.ink },
  role: { fontSize: 11, color: C.inkLight, marginTop: 2 },
  sep: {
    height: 1,
    backgroundColor: C.border,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  section: { paddingHorizontal: 14 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: C.inkLight,
    letterSpacing: 2.5,
    marginLeft: 14,
    marginBottom: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 4,
    position: "relative",
  },
  itemActive: { backgroundColor: C.red },
  itemIcon: { fontSize: 15, color: C.inkMid },
  itemLabel: { flex: 1, fontSize: 13, fontWeight: "600", color: C.ink },
  itemLabelActive: { color: "#FFFFFF", fontWeight: "700" },
  pip: {
    position: "absolute",
    left: 0,
    top: "20%",
    bottom: "20%",
    width: 3,
    borderRadius: 2,
    backgroundColor: C.cream,
  },

  switchRoleItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 12,
  },
  configItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginTop: 4,
    marginBottom: 8,
  },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  logoutBtn: {
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: "#FDF6EE",
    borderWidth: 1,
    borderColor: C.red,
    alignItems: "center",
    marginBottom: 10,
  },
  logoutTxt: { color: C.red, fontWeight: "700", fontSize: 13 },
  version: { textAlign: "center", fontSize: 10, color: C.inkLight },
});
