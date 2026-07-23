import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as MailComposer from "expo-mail-composer";
import { getApiUrl, getConfiguredApiUrl } from "../../Services/apiService";
import { router, Stack, useFocusEffect } from "expo-router";
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
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LineChart, PieChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SIDEBAR_WIDTH = 280;

const C = {
  bg: "#F8F6F4",
  surface: "#FFFFFF",
  cream: "#F5E6C8",
  creamLight: "#FAF2E8",
  red: "#C0202A",
  redSoft: "#FDF0F0",
  green: "#2E7D32",
  greenSoft: "#E8F5E9",
  blue: "#1565C0",
  blueSoft: "#E3F2FD",
  gold: "#F5A623",
  ink: "#1F1610",
  inkMid: "#3E2723",
  inkLight: "#7D6E65",
  inkFaint: "#C8B8A8",
  border: "#E8E0D8",
  shadow: "rgba(31,22,16,0.08)",
};

const FILTRES = [
  { label: "📋 Tous", value: "tous" },
  { label: "⏳ En attente", value: "attente" },
  { label: "✅ Reçus vers GeoDe", value: "recus" },
  { label: "📤 Exportés", value: "exportes" },
];

const ITEMS_PER_PAGE = 3;
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

// ✅ INTERFACE AVEC SOUS-LOTS
interface SousLotDetail {
  sousLot: string;
  quantiteLancee: number;
  unite: string;
}

interface Palette {
  id: number;
  palette: string | null;
  codeDeclaration: string | null;
  numOF: string;
  article: string;
  quantiteLancee: number;
  unite: string;
  date_expedition: string | null;
  date_reception: string | null;
  date_export: string | null;
  lot: string;
  sousLot: string | null;
  recu: boolean;
  exporte: boolean;
  statut: "attente" | "recu" | "exporte";
  qteUS: number;
  codeArticle: string;
  sousLots?: SousLotDetail[]; // ✅ AJOUTÉ
  quantiteTotale?: number; // ✅ AJOUTÉ
}

interface Stats {
  total: number;
  attente: number;
  recus: number;
  exportes: number;
}

interface MonthlyData {
  labels: string[];
  recusData: number[];
  exportesData: number[];
}

interface TopArticle {
  name: string;
  count: number;
}

export default function ReceptionScreen() {
  console.log("📥 [ReceptionScreen] Écran RÉCEPTION chargé !");

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [nom, setNom] = useState("Opérateur");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [apiUrl, setApiUrl] = useState("");

  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [allPalettes, setAllPalettes] = useState<Palette[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtre, setFiltre] = useState("tous");
  const [selectAll, setSelectAll] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailDestinataire, setEmailDestinataire] = useState("");
  const [emailCorps, setEmailCorps] = useState("");
  const [csvFileUri, setCsvFileUri] = useState("");
  const [csvFileName, setCsvFileName] = useState("");

  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
        console.log("🔍 [ReceptionScreen] Vérification des rôles...");

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
          ["Réception", "Admin"].includes(role),
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

  const formatDate = useCallback((date: string | null): string | null => {
    if (!date) return null;
    try {
      const dateStr = date.includes("Z") ? date : date + "Z";
      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) {
        console.warn("⚠️ Date invalide:", date);
        return date;
      }
      return dateObj.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC",
      });
    } catch (error) {
      console.error("❌ Erreur formatDate:", error);
      return date;
    }
  }, []);

  const getDisplayId = useCallback((pal: Palette): string => {
    if (pal.palette) return pal.palette;
    if (pal.codeDeclaration) return pal.codeDeclaration;
    return "N/A";
  }, []);

  const getTypeLabel = useCallback((item: Palette): string => {
    if (item.palette) return "📦 Palette";
    if (item.codeDeclaration) return "📋 Code Déclaration";
    return "📋 Code Déclaration";
  }, []);

  const getStatutLabel = useCallback((statut: string): string => {
    switch (statut) {
      case "attente":
        return "En attente";
      case "recu":
        return "Reçu";
      case "exporte":
        return "Exporté";
      default:
        return "Inconnu";
    }
  }, []);

  const getStatutColor = useCallback((statut: string): string => {
    switch (statut) {
      case "attente":
        return C.red;
      case "recu":
        return C.green;
      case "exporte":
        return C.blue;
      default:
        return C.inkLight;
    }
  }, []);

  const getStatutBgColor = useCallback((statut: string): string => {
    switch (statut) {
      case "attente":
        return C.redSoft;
      case "recu":
        return C.greenSoft;
      case "exporte":
        return C.blueSoft;
      default:
        return C.surface;
    }
  }, []);

  const getStatutIcon = useCallback((statut: string): string => {
    switch (statut) {
      case "attente":
        return "⏳";
      case "recu":
        return "✅";
      case "exporte":
        return "📤";
      default:
        return "❓";
    }
  }, []);

  const getStatusDate = useCallback(
    (item: Palette): string | null => {
      switch (item.statut) {
        case "recu":
          return item.date_reception ? formatDate(item.date_reception) : null;
        case "exporte":
          return item.date_export ? formatDate(item.date_export) : null;
        default:
          return null;
      }
    },
    [formatDate],
  );

  const getStatusDateLabel = useCallback((statut: string): string => {
    switch (statut) {
      case "recu":
        return "📥 Reçu vers GeoDe le";
      case "exporte":
        return "📤 Exporté vers GeoDe le";
      default:
        return "";
    }
  }, []);

  const fetchPalettes = useCallback(
    async (url?: string) => {
      const baseUrl = url || apiUrl;
      if (!baseUrl) {
        console.warn("⚠️ API URL non configurée");
        return;
      }

      try {
        setLoading(true);

        const urlAll = `${baseUrl}/api/reception/list?search=&filtre=tous`;
        console.log("📡 Requête (toutes):", urlAll);
        const resAll = await fetchWithToken(urlAll);
        if (!resAll.ok) throw new Error("Erreur serveur");
        const dataAll = await resAll.json();
        setAllPalettes(dataAll);

        const urlFiltered = `${baseUrl}/api/reception/list?search=${encodeURIComponent(searchTerm)}&filtre=${filtre}`;
        console.log("📡 Requête (filtrée):", urlFiltered);
        const resFiltered = await fetchWithToken(urlFiltered);
        if (!resFiltered.ok) throw new Error("Erreur serveur");
        const dataFiltered = await resFiltered.json();
        setPalettes(dataFiltered);

        setSelectedIds([]);
        setSelectAll(false);
        setTotalPages(Math.ceil(dataFiltered.length / ITEMS_PER_PAGE));
      } catch (e) {
        console.error("❌ Erreur fetch palettes:", e);
        Alert.alert("Erreur", "Impossible de charger les palettes.");
      } finally {
        setLoading(false);
      }
    },
    [apiUrl, searchTerm, filtre, fetchWithToken],
  );

  const stats = useMemo<Stats>(
    () => ({
      total: allPalettes.length,
      attente: allPalettes.filter((p) => !p.recu && !p.exporte).length,
      recus: allPalettes.filter((p) => p.recu && !p.exporte).length,
      exportes: allPalettes.filter((p) => p.exporte).length,
    }),
    [allPalettes],
  );

  const monthlyData = useMemo<MonthlyData>(() => {
    const monthly: { [key: string]: { recus: number; exportes: number } } = {};
    MOIS.forEach((m) => {
      monthly[m] = { recus: 0, exportes: 0 };
    });

    allPalettes.forEach((p) => {
      if (p.recu && p.date_reception) {
        try {
          const date = new Date(p.date_reception);
          if (!isNaN(date.getTime())) {
            const month = date.getMonth();
            const key = MOIS[month];
            if (monthly[key]) monthly[key].recus++;
          }
        } catch (e) {}
      }
      if (p.exporte && p.date_export) {
        try {
          const date = new Date(p.date_export);
          if (!isNaN(date.getTime())) {
            const month = date.getMonth();
            const key = MOIS[month];
            if (monthly[key]) monthly[key].exportes++;
          }
        } catch (e) {}
      }
    });

    return {
      labels: MOIS,
      recusData: MOIS.map((k) => monthly[k].recus),
      exportesData: MOIS.map((k) => monthly[k].exportes),
    };
  }, [allPalettes]);

  const topArticles = useMemo<TopArticle[]>(() => {
    const articles: { [key: string]: number } = {};
    allPalettes
      .filter((p) => p.recu)
      .forEach((p) => {
        const key = p.article || "Inconnu";
        articles[key] = (articles[key] || 0) + 1;
      });
    return Object.entries(articles)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [allPalettes]);

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

        await fetchPalettes(url);

        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }).start();
      } catch (error) {
        console.error("❌ Erreur initialisation:", error);
        Alert.alert("Erreur", "Impossible de charger les données");
      }
    };
    init();
  }, []);

  useFocusEffect(
    useCallback(() => {
      console.log("🔄 [ReceptionScreen] Rafraîchissement des données (focus)");
      if (apiUrl) {
        fetchPalettes(apiUrl);
      }
    }, [apiUrl, fetchPalettes]),
  );

  useEffect(() => {
    if (apiUrl) {
      fetchPalettes(apiUrl);
    }
  }, [searchTerm, filtre, apiUrl, fetchPalettes]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filtre]);

  const getPaginatedData = useCallback(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return palettes.slice(startIndex, endIndex);
  }, [palettes, currentPage]);

  const paginatedData = getPaginatedData();

  const goToPrevPage = useCallback(() => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  }, [currentPage]);

  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  }, [currentPage, totalPages]);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPalettes();
    setRefreshing(false);
  }, [fetchPalettes]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelectedIds([]);
    } else {
      setSelectedIds(palettes.map((p) => p.id));
    }
    setSelectAll(!selectAll);
  }, [selectAll, palettes]);

  const handleMarquerRecus = useCallback(async () => {
    if (!apiUrl) {
      Alert.alert("Erreur", "URL API non configurée");
      return;
    }

    if (selectedIds.length === 0) {
      Alert.alert("Info", "Veuillez sélectionner au moins une palette.");
      return;
    }

    const attenteIds = palettes
      .filter((p) => p.statut === "attente" && selectedIds.includes(p.id))
      .map((p) => p.id);

    if (attenteIds.length === 0) {
      Alert.alert("Info", "Les palettes sélectionnées ne sont pas en attente.");
      return;
    }

    Alert.alert(
      "Confirmation",
      `Marquer ${attenteIds.length} palette(s) comme reçues ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Confirmer",
          onPress: async () => {
            try {
              const res = await fetchWithToken(
                `${apiUrl}/api/reception/marquer-recus`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ids: attenteIds }),
                },
              );
              const result = await res.json();
              if (res.ok) {
                Alert.alert("✅ Succès", result.message);
                await fetchPalettes();
              } else {
                Alert.alert("Erreur", result.error);
              }
            } catch (e) {
              Alert.alert("Erreur", "Impossible de contacter le serveur.");
            }
          },
        },
      ],
    );
  }, [apiUrl, selectedIds, palettes, fetchWithToken, fetchPalettes]);

  const generateCSV = useCallback(
    (data: Palette[]): string => {
      const headers = [
        "ID",
        "Code",
        "Article",
        "Lot",
        "Sous-lot",
        "Quantité",
        "Quantité US",
        "Unité",
        "Date d'expédition",
        "Date de réception",
        "Date d'export",
        "Statut",
      ];

      const rows = data.map((p) => [
        p.id,
        getDisplayId(p),
        p.article || p.codeArticle || "N/A",
        p.lot || "N/A",
        p.sousLot || "N/A",
        p.quantiteLancee || 0,
        p.qteUS || "N/A",
        p.unite || "CAR",
        formatDate(p.date_expedition) || "",
        formatDate(p.date_reception) || "",
        formatDate(p.date_export) || "",
        getStatutLabel(p.statut),
      ]);

      return [headers.join(";"), ...rows.map((row) => row.join(";"))].join(
        "\n",
      );
    },
    [formatDate, getDisplayId, getStatutLabel],
  );

  const handleExporterCSV = useCallback(async () => {
    if (!apiUrl) {
      Alert.alert("Erreur", "URL API non configurée");
      return;
    }

    if (selectedIds.length === 0) {
      Alert.alert("Info", "Veuillez sélectionner au moins une palette.");
      return;
    }

    const recuIds = palettes
      .filter((p) => p.statut === "recu" && selectedIds.includes(p.id))
      .map((p) => p.id);

    if (recuIds.length === 0) {
      Alert.alert(
        "⚠️ Export impossible",
        "Seules les palettes 'Reçues' peuvent être exportées.\n\n" +
          "💡 Marquez d'abord les palettes comme 'Reçues' avant de les exporter.",
      );
      return;
    }

    setExporting(true);

    try {
      const res = await fetchWithToken(`${apiUrl}/api/reception/exporter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: recuIds }),
      });
      const result = await res.json();
      if (!res.ok) {
        Alert.alert("Erreur", result.error);
        setExporting(false);
        return;
      }

      const selectedPalettes = palettes.filter((p) => recuIds.includes(p.id));
      const csvData = generateCSV(selectedPalettes);

      const date = new Date().toISOString().split("T")[0];
      const fileName = `reception_${date}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, csvData);
      console.log("✅ Fichier créé:", fileUri);

      setCsvFileUri(fileUri);
      setCsvFileName(fileName);
      setEmailDestinataire("");
      setEmailCorps("");
      setShowEmailModal(true);
    } catch (error: any) {
      console.error("❌ Erreur lors de l'export:", error);
      Alert.alert(
        "Erreur",
        `Impossible d'exporter les données.\n\n${error.message || "Erreur inconnue"}`,
      );
    } finally {
      setExporting(false);
    }
  }, [apiUrl, selectedIds, palettes, fetchWithToken, generateCSV]);

  const handleSendEmail = useCallback(async () => {
    if (!emailDestinataire) {
      Alert.alert("Info", "Veuillez saisir un email destinataire.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailDestinataire)) {
      Alert.alert("Erreur", "Veuillez saisir un email valide.");
      return;
    }

    try {
      const isAvailable = await MailComposer.isAvailableAsync();

      if (isAvailable) {
        await MailComposer.composeAsync({
          subject: `📊 Rapport de réception - ${new Date().toISOString().split("T")[0]}`,
          recipients: [emailDestinataire],
          body:
            emailCorps ||
            `Bonjour,\n\nVeuillez trouver ci-joint le rapport des palettes reçues.\n\nCordialement,\nL'équipe Dr. Oetker Vanoise`,
          attachments: [csvFileUri],
        });

        Alert.alert("✅ Succès", "Email envoyé avec succès !");
        setShowEmailModal(false);
        setEmailDestinataire("");
        setEmailCorps("");
        await fetchPalettes();
      } else {
        Alert.alert(
          "Info",
          "L'application Mail n'est pas disponible sur cet appareil.",
        );
        setShowEmailModal(false);
      }
    } catch (error: any) {
      console.error("❌ Erreur d'envoi:", error);
      Alert.alert(
        "Erreur",
        `Impossible d'envoyer l'email.\n\n${error.message || "Erreur inconnue"}`,
      );
    }
  }, [emailDestinataire, emailCorps, csvFileUri, fetchPalettes]);

  const lineChartData = useMemo(
    () => ({
      labels: monthlyData.labels,
      datasets: [
        {
          data: monthlyData.recusData,
          color: (opacity = 1) => `rgba(46, 125, 50, ${opacity})`,
          strokeWidth: 3,
        },
        {
          data: monthlyData.exportesData,
          color: (opacity = 1) => `rgba(21, 101, 192, ${opacity})`,
          strokeWidth: 3,
        },
      ],
      legend: ["Reçus", "Exportés"],
    }),
    [monthlyData],
  );

  const pieData = useMemo(
    () => [
      {
        name: "En attente",
        population: stats.attente,
        color: C.red,
        legendFontColor: C.ink,
        legendFontSize: 12,
      },
      {
        name: "Reçus",
        population: stats.recus,
        color: C.green,
        legendFontColor: C.ink,
        legendFontSize: 12,
      },
      {
        name: "Exportés",
        population: stats.exportes,
        color: C.blue,
        legendFontColor: C.ink,
        legendFontSize: 12,
      },
    ],
    [stats],
  );

  const chartConfig = useMemo(
    () => ({
      backgroundGradientFrom: "#FFF",
      backgroundGradientTo: "#FFF",
      color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
      labelColor: () => C.inkLight,
      strokeWidth: 2,
      decimalPlaces: 0,
      propsForDots: {
        r: "6",
        strokeWidth: "2",
        stroke: "#FFF",
      },
    }),
    [],
  );

  // ✅ RENDERITEM CORRIGÉ AVEC SOUS-LOTS REGROUPÉS
  const renderItem = useCallback(
    ({ item }: { item: Palette }) => {
      const isSelected = selectedIds.includes(item.id);
      const statutIcon = getStatutIcon(item.statut);
      const statutColor = getStatutColor(item.statut);
      const statutBgColor = getStatutBgColor(item.statut);
      const statusDate = getStatusDate(item);
      const statusDateLabel = getStatusDateLabel(item.statut);
      const typeLabel = getTypeLabel(item);

      // ✅ Quantité totale (somme des sous-lots)
      const totalQty = item.quantiteTotale || item.quantiteLancee || 0;
      const nbSousLots = item.sousLots?.length || 0;

      return (
        <TouchableOpacity
          style={[styles.listItem, isSelected && styles.listItemSelected]}
          onPress={() => toggleSelect(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.checkboxContainer}>
            <View
              style={[styles.checkbox, isSelected && styles.checkboxChecked]}
            >
              {isSelected && <Text style={styles.checkIcon}>✓</Text>}
            </View>
          </View>

          <View style={styles.itemContent}>
            <View style={styles.itemHeader}>
              <View style={styles.itemCodeContainer}>
                <Text style={styles.itemCode}>{getDisplayId(item)}</Text>
                <View style={[styles.typeBadge, { backgroundColor: C.border }]}>
                  <Text style={styles.typeBadgeText}>{typeLabel}</Text>
                </View>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statutBgColor, borderColor: statutColor },
                ]}
              >
                <Text style={[styles.statusText, { color: statutColor }]}>
                  {statutIcon} {getStatutLabel(item.statut)}
                </Text>
              </View>
            </View>

            <Text style={styles.itemArticle}>
              📦 {item.article || "Article inconnu"}
            </Text>

            <View style={styles.itemDetailsRow}>
              <Text style={styles.itemDetail}>
                📅 Expédié: {formatDate(item.date_expedition) || "N/A"}
              </Text>
              <Text style={styles.itemDetail}>
                📊 Qté totale: {totalQty} {item.unite || "CAR"}
              </Text>
            </View>

            <View style={styles.itemDetailsRow}>
              <Text style={styles.itemDetail}>🏷️ Lot: {item.lot || "N/A"}</Text>
              <Text style={styles.itemDetail}>
                📎 {nbSousLots} sous-lot{nbSousLots > 1 ? "s" : ""}
              </Text>
            </View>

            <View style={styles.itemDetailsRow}>
              <Text style={styles.itemDetail}>
                🏭 OF: {item.numOF || "N/A"}
              </Text>
              {item.qteUS && (
                <Text style={styles.itemDetail}>📊 Qté US: {item.qteUS}</Text>
              )}
            </View>

            {/* ✅ SOUS-LOTS REGROUPÉS */}
            {item.sousLots && item.sousLots.length > 0 && (
              <View style={styles.sousLotsBlock}>
                <Text style={styles.sousLotsTitle}>
                  📎 Détail des sous-lots :
                </Text>
                {item.sousLots.map((sl, idx) => (
                  <View key={idx} style={styles.sousLotRow}>
                    <Text style={styles.sousLotName}>
                      {sl.sousLot || "N/A"}
                    </Text>
                    <Text style={styles.sousLotQty}>
                      {sl.quantiteLancee || 0} {sl.unite || item.unite || "CAR"}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {statusDate && (
              <View
                style={[
                  styles.statusDateContainer,
                  { backgroundColor: statutBgColor },
                ]}
              >
                <Text style={[styles.statusDateText, { color: statutColor }]}>
                  {statusDateLabel} {statusDate}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [
      selectedIds,
      toggleSelect,
      formatDate,
      getDisplayId,
      getTypeLabel,
      getStatutIcon,
      getStatutColor,
      getStatutBgColor,
      getStatutLabel,
      getStatusDate,
      getStatusDateLabel,
    ],
  );

  if (isChecking) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.red} />
          <Text style={styles.loadingText}>Vérification des droits...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthorized) return null;

  if (loading && palettes.length === 0) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.red} />
          <Text style={styles.loadingText}>Chargement des palettes...</Text>
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
            {showStats ? "📊 STATISTIQUES" : "📥 RÉCEPTION"}
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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[C.red]}
          />
        }
      >
        {showStats ? (
          <View style={styles.statsView}>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statCardValue}>{stats.total}</Text>
                <Text style={styles.statCardLabel}>Total</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statCardValue, { color: C.red }]}>
                  {stats.attente}
                </Text>
                <Text style={styles.statCardLabel}>En attente</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statCardValue, { color: C.green }]}>
                  {stats.recus}
                </Text>
                <Text style={styles.statCardLabel}>Reçus vers GeoDe</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statCardValue, { color: C.blue }]}>
                  {stats.exportes}
                </Text>
                <Text style={styles.statCardLabel}>Exportés vers GeoDe</Text>
              </View>
            </View>

            <View style={styles.rateCard}>
              <Text style={styles.rateTitle}>📊 Taux de réception</Text>
              <View style={styles.rateRow}>
                <View style={styles.rateItem}>
                  <Text style={styles.rateValue}>
                    {stats.total > 0
                      ? Math.round((stats.recus / stats.total) * 100)
                      : 0}
                    %
                  </Text>
                  <Text style={styles.rateLabel}>Reçus vers GeoDe</Text>
                </View>
                <View style={styles.rateItem}>
                  <Text style={styles.rateValue}>
                    {stats.total > 0
                      ? Math.round((stats.exportes / stats.total) * 100)
                      : 0}
                    %
                  </Text>
                  <Text style={styles.rateLabel}>Exportés vers GeoDe</Text>
                </View>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width:
                        stats.total > 0
                          ? `${(stats.recus / stats.total) * 100}%`
                          : "0%",
                      backgroundColor: C.green,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressLabel}>
                {stats.recus} / {stats.total} palettes reçues vers GeoDe
              </Text>
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>📈 Évolution mensuelle</Text>
              <LineChart
                data={lineChartData}
                width={SCREEN_WIDTH - 60}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                withInnerLines
                withOuterLines={false}
                withVerticalLabels
                fromZero
                yAxisSuffix=""
                yAxisInterval={1}
              />
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: C.green }]}
                  />
                  <Text style={styles.legendText}>Reçus</Text>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: C.blue }]}
                  />
                  <Text style={styles.legendText}>Exportés</Text>
                </View>
              </View>
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>🎯 Répartition des statuts</Text>
              {stats.total > 0 ? (
                <PieChart
                  data={pieData}
                  width={SCREEN_WIDTH - 60}
                  height={200}
                  chartConfig={chartConfig}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  absolute
                />
              ) : (
                <View style={styles.chartEmpty}>
                  <Text style={styles.chartEmptyText}>
                    Aucune donnée disponible
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>🏆 Top articles reçus</Text>
              {topArticles.length > 0 ? (
                topArticles.map((article, index) => (
                  <View key={index} style={styles.topItem}>
                    <Text style={styles.topRank}>{index + 1}</Text>
                    <Text style={styles.topName}>{article.name}</Text>
                    <Text style={styles.topCount}>{article.count}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Aucun article reçu</Text>
              )}
            </View>

            <Footer />
          </View>
        ) : (
          <View style={styles.receptionView}>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.total}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: C.red }]}>
                  {stats.attente}
                </Text>
                <Text style={styles.statLabel}>En attente</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: C.green }]}>
                  {stats.recus}
                </Text>
                <Text style={styles.statLabel}>Reçus</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: C.blue }]}>
                  {stats.exportes}
                </Text>
                <Text style={styles.statLabel}>Exportés</Text>
              </View>
            </View>

            <View style={styles.filtresContainer}>
              {FILTRES.map((f) => (
                <TouchableOpacity
                  key={f.value}
                  style={[
                    styles.filtreBtn,
                    filtre === f.value && styles.filtreBtnActive,
                  ]}
                  onPress={() => setFiltre(f.value)}
                >
                  <Text
                    style={[
                      styles.filtreBtnTxt,
                      filtre === f.value && styles.filtreBtnTxtActive,
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.searchContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher par code, article..."
                placeholderTextColor={C.inkLight}
                value={searchTerm}
                onChangeText={setSearchTerm}
              />
              {searchTerm.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchTerm("")}
                  style={styles.clearBtn}
                >
                  <Text style={styles.clearBtnTxt}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {userRoles.length > 1 && (
              <TouchableOpacity
                style={styles.switchRoleButton}
                onPress={switchRole}
              >
                <Text style={styles.switchRoleIcon}>🔄</Text>
                <View style={styles.switchRoleContent}>
                  <Text style={styles.switchRoleTitle}>Changer de rôle</Text>
                  <Text style={styles.switchRoleSubtitle}>
                    Vos rôles: {userRoles.join(", ")}
                  </Text>
                </View>
                <Text style={styles.switchRoleArrow}>›</Text>
              </TouchableOpacity>
            )}

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={C.red} />
                <Text style={styles.loadingText}>
                  Chargement des palettes...
                </Text>
              </View>
            ) : palettes.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyTitle}>Aucune palette</Text>
                <Text style={styles.emptySub}>
                  {filtre === "attente"
                    ? "Aucune palette en attente de réception."
                    : filtre === "recus"
                      ? "Aucune palette reçue."
                      : filtre === "exportes"
                        ? "Aucune palette exportée."
                        : "Aucune palette expédiée."}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.listHeader}>
                  <TouchableOpacity
                    style={styles.selectAllBtn}
                    onPress={toggleSelectAll}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        selectAll && styles.checkboxChecked,
                      ]}
                    >
                      {selectAll && <Text style={styles.checkIcon}>✓</Text>}
                    </View>
                    <Text style={styles.selectAllText}>
                      {selectAll ? "Désélectionner tout" : "Sélectionner tout"}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.selectedCount}>
                    {selectedIds.length} sélectionnée(s)
                  </Text>
                </View>

                <FlatList
                  data={paginatedData}
                  renderItem={renderItem}
                  keyExtractor={(item) => item.id.toString()}
                  contentContainerStyle={styles.listContent}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      colors={[C.red]}
                    />
                  }
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={false}
                />

                {totalPages > 1 && (
                  <View style={styles.paginationContainer}>
                    <TouchableOpacity
                      style={[
                        styles.paginationBtn,
                        currentPage === 1 && styles.paginationBtnDisabled,
                      ]}
                      onPress={goToPrevPage}
                      disabled={currentPage === 1}
                    >
                      <Text
                        style={[
                          styles.paginationBtnTxt,
                          currentPage === 1 && styles.paginationBtnTxtDisabled,
                        ]}
                      >
                        ◀
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.paginationInfo}>
                      <Text style={styles.paginationText}>
                        Page {currentPage} / {totalPages}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.paginationBtn,
                        currentPage === totalPages &&
                          styles.paginationBtnDisabled,
                      ]}
                      onPress={goToNextPage}
                      disabled={currentPage === totalPages}
                    >
                      <Text
                        style={[
                          styles.paginationBtnTxt,
                          currentPage === totalPages &&
                            styles.paginationBtnTxtDisabled,
                        ]}
                      >
                        ▶
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {selectedIds.length > 0 && (
                  <View style={styles.actionContainer}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnRecu]}
                      onPress={handleMarquerRecus}
                    >
                      <Text style={styles.actionBtnTxt}>
                        📥 Marquer reçues vers GeoDe
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnExport]}
                      onPress={handleExporterCSV}
                      disabled={exporting}
                    >
                      {exporting ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <Text style={styles.actionBtnTxt}>📤 Exporter CSV</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                <Footer />
              </>
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showEmailModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEmailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>📤 Envoyer par email</Text>

            <Text style={styles.modalLabel}>📧 Destinataire</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="email@exemple.com"
              placeholderTextColor={C.inkLight}
              value={emailDestinataire}
              onChangeText={setEmailDestinataire}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.modalLabel}>📝 Message</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder="Votre message..."
              placeholderTextColor={C.inkLight}
              value={emailCorps}
              onChangeText={setEmailCorps}
              multiline
              numberOfLines={4}
            />

            <Text style={styles.modalLabel}>📎 Fichier joint</Text>
            <View style={styles.modalFileInfo}>
              <Text style={styles.modalFileText}>📄 {csvFileName}</Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setShowEmailModal(false)}
              >
                <Text style={styles.modalBtnCancelTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSend]}
                onPress={handleSendEmail}
              >
                <Text style={styles.modalBtnTxt}>📤 Envoyer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
              {nom ? nom[0].toUpperCase() : "O"}
            </Text>
          </View>
          <View>
            <Text style={sb.name}>{nom || "Opérateur"}</Text>
            <Text style={sb.role}>Gestionnaire · Réception</Text>
          </View>
        </View>
        <View style={sb.sep} />
        <View style={sb.section}>
          <Text style={sb.sectionLabel}>NAVIGATION</Text>

          <TouchableOpacity
            style={[sb.item, !showStats && sb.itemActive]}
            onPress={() => {
              setShowStats(false);
              closeSidebar();
            }}
          >
            <Text style={sb.itemIcon}>📥</Text>
            <Text style={[sb.itemLabel, !showStats && sb.itemLabelActive]}>
              Réception
            </Text>
            {!showStats && <View style={sb.pip} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[sb.item, showStats && sb.itemActive]}
            onPress={() => {
              setShowStats(true);
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
          <Text style={sb.version}>Dr. Oetker Vanoise v1.0</Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const Footer = () => (
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
);

// ===== STYLES =====
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 20 },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderColor: C.border,
    shadowColor: C.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  hamburger: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.bg,
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
    letterSpacing: 0.5,
  },
  topbarSubTitle: { fontSize: 10, color: C.inkLight, marginTop: 1 },
  logoWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  logo: { width: 55, height: 32 },
  redRule: { height: 3, backgroundColor: C.red },
  receptionView: { flex: 1 },

  switchRoleButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.blue,
    padding: 14,
    marginBottom: 16,
    shadowColor: C.blue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  switchRoleIcon: { fontSize: 22, marginRight: 12 },
  switchRoleContent: { flex: 1 },
  switchRoleTitle: { fontSize: 14, fontWeight: "700", color: C.ink },
  switchRoleSubtitle: { fontSize: 11, color: C.inkLight, marginTop: 2 },
  switchRoleArrow: { fontSize: 20, color: C.inkLight },

  statsContainer: {
    flexDirection: "row",
    backgroundColor: C.surface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: C.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    flexWrap: "wrap",
  },
  statItem: { flex: 1, alignItems: "center", minWidth: 60 },
  statValue: { fontSize: 20, fontWeight: "800", color: C.ink },
  statLabel: { fontSize: 10, color: C.inkLight, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: C.border },
  filtresContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  filtreBtn: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    minWidth: 60,
  },
  filtreBtnActive: {
    backgroundColor: C.red,
    borderColor: C.red,
    shadowColor: C.red,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  filtreBtnTxt: {
    fontSize: 11,
    color: C.inkLight,
    fontWeight: "600",
    textAlign: "center",
  },
  filtreBtnTxtActive: { color: "#FFF" },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.creamLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
  },
  searchIcon: { fontSize: 16, marginRight: 12, color: C.inkLight },
  searchInput: { flex: 1, fontSize: 14, color: C.ink },
  clearBtn: { padding: 6 },
  clearBtnTxt: { fontSize: 14, color: C.inkLight, fontWeight: "bold" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: { marginTop: 16, color: C.inkLight, fontSize: 14 },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: C.ink },
  emptySub: {
    fontSize: 14,
    color: C.inkLight,
    marginTop: 6,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 13,
    color: C.inkLight,
    textAlign: "center",
    marginVertical: 10,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 10,
  },
  selectAllBtn: { flexDirection: "row", alignItems: "center", gap: 8 },
  selectAllText: { fontSize: 13, color: C.inkLight, fontWeight: "600" },
  selectedCount: { fontSize: 12, color: C.inkLight },
  listContent: { paddingBottom: 20 },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: C.creamLight,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: C.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  listItemSelected: {
    borderColor: C.red,
    backgroundColor: C.cream,
    borderWidth: 2,
  },
  checkboxContainer: { marginRight: 14, paddingTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.surface,
  },
  checkboxChecked: { backgroundColor: C.red, borderColor: C.red },
  checkIcon: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  itemContent: { flex: 1 },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
    flexWrap: "wrap",
    gap: 6,
  },
  itemCodeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  itemCode: { fontSize: 15, fontWeight: "700", color: C.ink },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: C.border,
  },
  typeBadgeText: { fontSize: 9, color: C.inkLight, fontWeight: "600" },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
  },
  statusText: { fontSize: 11, fontWeight: "700" },
  itemArticle: {
    fontSize: 14,
    color: C.ink,
    fontWeight: "600",
    marginBottom: 6,
  },
  itemDetailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 3,
    flexWrap: "wrap",
  },
  itemDetail: { fontSize: 12, color: C.inkLight },

  // ✅ STYLES POUR SOUS-LOTS
  sousLotsBlock: {
    marginTop: 8,
    backgroundColor: "#FFF",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: "dashed",
  },
  sousLotsTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: C.inkMid,
    marginBottom: 6,
    letterSpacing: 0.3,
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

  statusDateContainer: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  statusDateText: { fontSize: 12, fontWeight: "600" },
  paginationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginTop: 6,
    marginBottom: 10,
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  paginationBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: C.red,
    minWidth: 48,
    alignItems: "center",
  },
  paginationBtnDisabled: { backgroundColor: C.border },
  paginationBtnTxt: { color: "#FFF", fontWeight: "700", fontSize: 16 },
  paginationBtnTxtDisabled: { color: C.inkLight },
  paginationInfo: { paddingHorizontal: 24 },
  paginationText: { fontSize: 14, color: C.ink, fontWeight: "600" },
  actionContainer: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 4,
    marginTop: 8,
    marginBottom: 4,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
    flexWrap: "wrap",
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    minWidth: 100,
  },
  actionBtnRecu: { backgroundColor: C.green },
  actionBtnExport: { backgroundColor: C.blue },
  actionBtnTxt: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  statsView: { paddingBottom: 10 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: "18%",
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  statCardValue: { fontSize: 24, fontWeight: "800", color: C.ink },
  statCardLabel: { fontSize: 10, color: C.inkLight, marginTop: 2 },
  rateCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  rateTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: C.ink,
    marginBottom: 14,
  },
  rateRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 14,
  },
  rateItem: { alignItems: "center" },
  rateValue: { fontSize: 30, fontWeight: "800", color: C.ink },
  rateLabel: { fontSize: 12, color: C.inkLight, marginTop: 2 },
  progressBar: {
    height: 8,
    backgroundColor: C.border,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressFill: { height: "100%", borderRadius: 4 },
  progressLabel: { fontSize: 12, color: C.inkLight, textAlign: "right" },
  chartCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: C.ink,
    marginBottom: 12,
  },
  chart: { marginLeft: -10, borderRadius: 0 },
  chartEmpty: { height: 200, alignItems: "center", justifyContent: "center" },
  chartEmptyText: { fontSize: 14, color: C.inkLight },
  chartLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginTop: 12,
    flexWrap: "wrap",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, color: C.inkLight },
  topItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  topRank: { fontSize: 14, fontWeight: "700", color: C.red, width: 30 },
  topName: { flex: 1, fontSize: 13, color: C.ink, fontWeight: "500" },
  topCount: { fontSize: 14, fontWeight: "700", color: C.blue },
  footer: {
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  footerDivider: {
    width: 40,
    height: 3,
    backgroundColor: C.red,
    marginBottom: 10,
    borderRadius: 2,
  },
  copyright: { fontSize: 12, color: C.inkLight, textAlign: "center" },
  copyrightLink: { color: C.red, fontWeight: "700" },
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
    shadowColor: C.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 4, height: 0 },
    elevation: 5,
  },

  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modalContainer: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 24,
    width: "90%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: C.ink,
    marginBottom: 16,
    textAlign: "center",
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: C.inkLight,
    marginBottom: 6,
    marginTop: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: C.ink,
    backgroundColor: C.creamLight,
  },
  modalTextArea: { minHeight: 80, textAlignVertical: "top" },
  modalFileInfo: {
    backgroundColor: C.creamLight,
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalFileText: { fontSize: 13, color: C.ink },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  modalBtnCancel: { backgroundColor: C.border },
  modalBtnCancelTxt: { color: C.ink, fontWeight: "600", fontSize: 14 },
  modalBtnSend: { backgroundColor: C.blue },
  modalBtnTxt: { color: "#FFF", fontWeight: "700", fontSize: 14 },
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
    backgroundColor: C.red,
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
