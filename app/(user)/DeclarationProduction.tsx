import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, Stack } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  downloadLabelPdf,
  generateZplLabel,
  sendToPrinter,
  type ZplData,
} from "../../Services/printService";
import { getConfiguredApiUrl } from "../../Services/apiService";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SIDEBAR_WIDTH = 280;

export interface Article {
  id: string;
  GESTION: string;
  palette: {
    ZPCU: string;
    ZPCUSTUCOE: string;
  }[];
}

export interface ArticleOF {
  numOF: string;
  codeArticle: string;
  quantiteLancee: number;
  statut?: string;
  designation: string;
  unite: string;
  coefUS: number;
  // Champs supplémentaires de l'API
  id?: string;
  ZMFGFCY?: string;
  ZROU?: string;
  ZDATE?: string;
  ZSTAT?: string;
  ZENDDAT?: string;
  lignes?: any[];
  nomenclature?: any[];
  articleExists?: boolean;
  originalCodeArticle?: string;
}

export interface ProductionLine {
  id: string;
  slot: string;
  quantite: string | number;
}

export interface UserData {
  nom?: string;
  matricule?: string;
  roles?: string[];
}

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

const formatDate = (date: string | null): string => {
  if (!date) return "N/A";
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return date;

    return dateObj.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Africa/Tunis",
    });
  } catch {
    return date;
  }
};

const Divider = ({ label }: { label: string }) => (
  <View style={div.row}>
    <Text style={div.txt}>{label}</Text>
    <View style={div.line} />
  </View>
);

export default function ProductionDeclarationScreen() {
  // ✅ ÉTATS
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [activeTab, setActiveTab] = useState<"declaration" | "historique">(
    "declaration",
  );
  const [nom, setNom] = useState("");
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [matricule, setMatricule] = useState("MTR-2026");
  const [apiUrl, setApiUrl] = useState("");
  const [backend2Url, setBackend2Url] = useState(""); // ✅ URL du backend 2
  const [modeProduction, setModeProduction] = useState<"S" | "P">("S");
  const [historiquePalettes, setHistoriquePalettes] = useState<any[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [ordresFabrication, setOrdresFabrication] = useState<ArticleOF[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [articlesMap, setArticlesMap] = useState<Map<string, Article>>(new Map());
  const [searchText, setSearchText] = useState("");
  const [selectedOF, setSelectedOF] = useState("");
  const [selectedOFData, setSelectedOFData] = useState<ArticleOF | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [quantiteLancee, setQuantiteLancee] = useState<string>("");
  const [savedQuantiteLancee, setSavedQuantiteLancee] = useState<string>("");
  const [lotGlobal, setLotGlobal] = useState("");
  const [lignesProduction, setLignesProduction] = useState<ProductionLine[]>(
    [],
  );
  const [paletteGeneree, setPaletteGeneree] = useState<string | null>(null);
  const [dernierePaletteLignes, setDernierePaletteLignes] = useState<
    ProductionLine[]
  >([]);
  const [quantiteLanceeUVCResult, setQuantiteLanceeUVCResult] = useState<
    number | null
  >(null);
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const fetchWithToken = async (url: string, options: RequestInit = {}) => {
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) {
        const newToken = await refreshAccessToken();
        if (!newToken) throw new Error("Session expirée");
      }

      const finalToken = await AsyncStorage.getItem("access_token");
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${finalToken}`,
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
  };

  const refreshAccessToken = async (): Promise<string | null> => {
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
  };

  const clearTokensAndLogout = async () => {
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
  };

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const accessToken = await AsyncStorage.getItem("access_token");
        if (!accessToken) {
          Alert.alert("⛔ Non authentifié", "Veuillez vous reconnecter.");
          router.replace("/(auth)/login");
          setIsChecking(false);
          return;
        }

        const roles = await AsyncStorage.getItem("user_roles");
        if (!roles) {
          Alert.alert("⛔ Accès refusé", "Vous n'avez pas les droits.");
          router.replace("/(auth)/login");
          setIsChecking(false);
          return;
        }

        const userRoles = JSON.parse(roles);
        setUserRoles(userRoles);

        const hasAccess = userRoles.some((role: string) =>
          ["Production Controller", "Admin"].includes(role),
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

        setIsAuthorized(true);
        await loadData();
      } catch (error) {
        console.error("❌ Erreur vérification:", error);
        router.replace("/(auth)/login");
      } finally {
        setIsChecking(false);
      }
    };
    checkAccess();
  }, []);

  const loadData = async () => {
    try {
      // ✅ Récupérer l'URL du backend 1 (votre API principale)
      const url = await getConfiguredApiUrl();
      setApiUrl(url);
      console.log("📌 Backend 1 URL:", url);

      // ✅ Récupérer l'URL du backend 2 depuis AsyncStorage ou configuration
      const backend2UrlStored = await AsyncStorage.getItem("backend2_url");
      if (backend2UrlStored) {
        setBackend2Url(backend2UrlStored);
        console.log("📌 Backend 2 URL (stockée):", backend2UrlStored);
      } else {
        // URL par défaut du backend 2
        const defaultBackend2Url = "http://172.16.10.121:4000";
        setBackend2Url(defaultBackend2Url);
        await AsyncStorage.setItem("backend2_url", defaultBackend2Url);
        console.log("📌 Backend 2 URL (défaut):", defaultBackend2Url);
      }

      try {
        const response = await fetchWithToken(`${url}/api/config/mode`);
        if (response.ok) {
          const data = await response.json();
          if (data.mode === "P" || data.mode === "S") {
            setModeProduction(data.mode as "S" | "P");
          }
        }
      } catch (e) {
        console.warn("Mode non récupéré, défaut S", e);
      }

      const raw = await AsyncStorage.getItem("user");
      if (raw) {
        const parsedUser: UserData = JSON.parse(raw);
        setNom(parsedUser.nom || "Opérateur");
        setUserRoles(parsedUser.roles || []);
        if (parsedUser.matricule) setMatricule(parsedUser.matricule);
      }
    } catch (error) {
      console.error("❌ Erreur chargement:", error);
      router.replace("/ApiConfigScreen");
    }
  };

  // ✅ SIDEBAR
  const openSidebar = () => {
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
  };

  const closeSidebar = () => {
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
  };

  const handleLogout = async () => {
    closeSidebar();
    await clearTokensAndLogout();
  };

  const switchRole = async () => {
    await AsyncStorage.removeItem("selected_role");
    router.replace("/(auth)/RoleSelectionScreen");
  };

  // ── FETCH DONNÉES ──
  const fetchHistorique = async (pageNum = 1, currentSearch = "") => {
    if (!apiUrl) return;
    try {
      setLoadingHist(true);
      const url = `${apiUrl}/api/production/historique?page=${pageNum}&search=${encodeURIComponent(currentSearch)}`;
      const response = await fetchWithToken(url);
      if (response.ok) {
        const data = await response.json();
        setHasMore(data.length >= 5);
        setHistoriquePalettes(data);
      }
    } catch (e: any) {
      console.error("❌ Erreur historique:", e);
      if (e.message?.includes("Session expirée")) {
        Alert.alert("⏳ Session expirée", "Veuillez vous reconnecter.");
        await clearTokensAndLogout();
      }
    } finally {
      setLoadingHist(false);
    }
  };

  useEffect(() => {
    if (activeTab === "historique") {
      setPage(1);
      const t = setTimeout(() => fetchHistorique(1, searchTerm), 300);
      return () => clearTimeout(t);
    }
  }, [searchTerm, activeTab]);

  const handleNextPage = () => {
    if (loadingHist || !hasMore) return;
    const n = page + 1;
    setPage(n);
    fetchHistorique(n, searchTerm);
  };

  const handlePrevPage = () => {
    if (loadingHist || page <= 1) return;
    const n = page - 1;
    setPage(n);
    fetchHistorique(n, searchTerm);
  };

  // ✅ Récupérer les articles depuis /api/articles (Backend 2)
  useEffect(() => {
    if (!backend2Url) return;

    const fetchArticles = async () => {
      try {
        const url = `${backend2Url}/api/articles`;
        console.log("🔍 Récupération des articles depuis:", url);
        
        const token = await AsyncStorage.getItem("access_token");
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };
        
        const response = await fetch(url, { headers });
        
        if (response.ok) {
          const data = await response.json();
          console.log("📦 Articles reçus:", data);
          
          let articlesData = Array.isArray(data) ? data : [];
          if (!Array.isArray(data) && data.data) {
            articlesData = Array.isArray(data.data) ? data.data : [];
          }
          
          setArticles(articlesData);
          
          // Créer un Map pour une recherche rapide
          const map = new Map();
          articlesData.forEach((article: Article) => {
            map.set(article.id, article);
          });
          setArticlesMap(map);
          
          console.log(`✅ ${articlesData.length} articles chargés`);
          console.log('📋 Codes articles:', Array.from(map.keys()));
        } else {
          console.error("❌ Erreur récupération articles:", response.status);
        }
      } catch (e: any) {
        console.error("❌ Erreur récupération articles:", e);
      }
    };
    
    fetchArticles();
  }, [backend2Url]);

  // ✅ Récupérer les OFs depuis /api/OFMLIGNEs (Backend 2)
  useEffect(() => {
    if (!backend2Url) return;

    const fetchOFs = async () => {
      try {
        const url = `${backend2Url}/api/OFMLIGNEs`;
        console.log("🔍 Récupération des OFs depuis:", url);
        
        const token = await AsyncStorage.getItem("access_token");
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };
        
        const response = await fetch(url, { headers });
        
        if (response.ok) {
          const data = await response.json();
          console.log("📋 OFs reçus:", data);
          
          let ofsData = Array.isArray(data) ? data : [];
          if (!Array.isArray(data) && data.data) {
            ofsData = Array.isArray(data.data) ? data.data : [];
          }
          
          const mappedData: ArticleOF[] = ofsData.map((item: any) => {
            const firstLigne = item.lignes && item.lignes.length > 0 ? item.lignes[0] : null;
            const codeArticle = firstLigne?.ZITMREF || item.ZROU || '';
            
            // Vérifier si l'article existe dans la base
            const articleExists = articlesMap.has(codeArticle);
            
            let totalQty = 0;
            if (item.lignes && Array.isArray(item.lignes)) {
              totalQty = item.lignes.reduce((sum: number, ligne: any) => {
                const qty = parseFloat(ligne.ZEXTQTY) || 0;
                return sum + qty;
              }, 0);
            }
            
            return {
              numOF: item.id || item.numOF || '',
              codeArticle: codeArticle,
              designation: firstLigne?.ZITMDES || item.ZROU || 'OF sans désignation',
              unite: firstLigne?.ZUOM || 'CAR',
              coefUS: 1,
              quantiteLancee: totalQty || parseFloat(firstLigne?.ZEXTQTY) || 0,
              statut: item.ZSTAT || 'ACTIF',
              articleExists: articleExists,
              id: item.id,
              ZMFGFCY: item.ZMFGFCY,
              ZROU: item.ZROU,
              ZDATE: item.ZDATE,
              ZSTAT: item.ZSTAT,
              ZENDDAT: item.ZENDDAT,
              lignes: item.lignes,
              nomenclature: item.nomenclature,
            };
          });
          
          let filteredData = mappedData;
          if (searchText.trim()) {
            const search = searchText.toLowerCase();
            filteredData = mappedData.filter((of) => 
              of.numOF?.toLowerCase().includes(search) ||
              of.codeArticle?.toLowerCase().includes(search) ||
              of.designation?.toLowerCase().includes(search)
            );
          }
          
          console.log("📋 OFs formatés:", filteredData);
          setOrdresFabrication(filteredData);
        } else if (response.status === 404) {
          console.error("❌ API non trouvée. Vérifiez l'URL:", url);
          Alert.alert(
            "Erreur de connexion",
            "Impossible de contacter le serveur. Vérifiez que le serveur est accessible."
          );
        } else {
          console.error("❌ Erreur HTTP:", response.status);
          const errorText = await response.text();
          console.error("❌ Détails:", errorText);
        }
      } catch (e: any) {
        console.error("❌ Erreur OF:", e);
        if (e.message?.includes("Session expirée")) {
          Alert.alert("⏳ Session expirée", "Veuillez vous reconnecter.");
          await clearTokensAndLogout();
        } else {
          Alert.alert(
            "Erreur réseau",
            "Impossible de se connecter au serveur. Vérifiez votre connexion."
          );
        }
      } finally {
        setLoading(false);
      }
    };
    
    const t = setTimeout(fetchOFs, 300);
    return () => clearTimeout(t);
  }, [searchText, articlesMap, backend2Url]);

  // ── GESTION PALETTE ──
  const ajouterLigne = () => {
    setPaletteGeneree(null);
    setLignesProduction([
      ...lignesProduction,
      { id: Math.random().toString(), slot: "", quantite: "" },
    ]);
  };

  const updateLigne = (
    id: string,
    champ: keyof ProductionLine,
    valeur: string,
  ) =>
    setLignesProduction(
      lignesProduction.map((l) =>
        l.id === id ? { ...l, [champ]: valeur } : l,
      ),
    );

  const supprimerLigne = (id: string) =>
    setLignesProduction(lignesProduction.filter((l) => l.id !== id));

  const validerDeclaration = async () => {
    if (
      !apiUrl ||
      !selectedOFData ||
      !lotGlobal ||
      lignesProduction.length === 0
    ) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs.");
      return;
    }

    try {
      setLoading(true);

      // ═══════════════════════════════════════════════════════════
      // ÉTAPE 1 : Vérifier/créer l'ARTICLE dans le backend 1
      // ═══════════════════════════════════════════════════════════
      console.log(`🔄 Vérification/création de l'article dans backend 1: ${selectedOFData.codeArticle}`);

      try {
        // Récupérer les infos de l'article depuis le backend 2
        const articleResponse = await fetch(
          `${backend2Url}/api/articles/${encodeURIComponent(selectedOFData.codeArticle)}`,
          { headers: { "Content-Type": "application/json" } },
        );

        let designationFinale = selectedOFData.designation;
        let uniteFinale = selectedOFData.unite || 'CAR';
        let coefUSFinal = selectedOFData.coefUS || 1;

        if (articleResponse.ok) {
          const articleBackend2 = await articleResponse.json();
          designationFinale = articleBackend2.designation || designationFinale;
          uniteFinale = articleBackend2.unite || uniteFinale;
          coefUSFinal = articleBackend2.coefUS || coefUSFinal;
        }

        // Créer l'article dans le backend 1
        const createArticleResponse = await fetchWithToken(`${apiUrl}/api/articles`, {
          method: 'POST',
          body: JSON.stringify({
            codeArticle: selectedOFData.codeArticle,
            designation: designationFinale,
            unite: uniteFinale,
            coefUS: coefUSFinal,
          }),
        });

        if (!createArticleResponse.ok) {
          const errorData = await createArticleResponse.json().catch(() => ({}));
          throw new Error(errorData.error || "Impossible de créer/vérifier l'article dans le backend 1.");
        }

        console.log('✅ Article vérifié/créé dans le backend 1');
      } catch (createError: any) {
        console.error('❌ Erreur création article:', createError);
        Alert.alert("Erreur", `Synchronisation article échouée : ${createError.message}`);
        setLoading(false);
        return;
      }

      // ═══════════════════════════════════════════════════════════
      // ÉTAPE 2 : Vérifier/créer l'OF dans le backend 1
      // ═══════════════════════════════════════════════════════════
      console.log(`🔄 Vérification/création de l'OF dans backend 1: ${selectedOFData.numOF}`);

      try {
        const createOFResponse = await fetchWithToken(`${apiUrl}/api/ofs`, {
          method: 'POST',
          body: JSON.stringify({
            numOF: selectedOFData.numOF,
            codeArticle: selectedOFData.codeArticle,
            quantiteLancee: selectedOFData.quantiteLancee,
            statut: selectedOFData.ZSTAT === '1' ? 'Actif' : 'Créé',
          }),
        });

        if (!createOFResponse.ok) {
          const errorData = await createOFResponse.json().catch(() => ({}));
          throw new Error(errorData.error || "Impossible de créer/vérifier l'OF dans le backend 1.");
        }

        console.log('✅ OF vérifié/créé dans le backend 1');
      } catch (createOFError: any) {
        console.error('❌ Erreur création OF:', createOFError);
        Alert.alert("Erreur", `Synchronisation OF échouée : ${createOFError.message}`);
        setLoading(false);
        return;
      }

      // ═══════════════════════════════════════════════════════════
      // ÉTAPE 3 : Déclarer la production
      // ═══════════════════════════════════════════════════════════
      const payload = {
        numOF: selectedOFData.numOF,
        codeArticle: selectedOFData.codeArticle,
        quantiteLancee: selectedOFData.quantiteLancee,
        lot: lotGlobal,
        matricule: matricule,
        list: lignesProduction.map((l) => ({
          slot: l.slot || null,
          qty: parseFloat(String(l.quantite || 0).replace(",", ".")),
          unite: selectedOFData.unite,
        })),
      };

      console.log("📤 Payload:", JSON.stringify(payload, null, 2));

      const response = await fetchWithToken(
        `${apiUrl}/api/production/declarer`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );

      const result = await response.json();

      if (response.ok) {
        const codeGenere: string = result.code;
        if (!codeGenere)
          throw new Error("Le serveur n'a pas retourné de code.");

        if (result.type === "S" || result.type === "P") {
          setModeProduction(result.type as "S" | "P");
        }

        setSavedQuantiteLancee(String(selectedOFData.quantiteLancee));
        setDernierePaletteLignes([...lignesProduction]);
        setPaletteGeneree(codeGenere);
        setQuantiteLanceeUVCResult(result.quantiteLanceeUVC ?? null);

        Alert.alert(
          "Succès",
          result.type === "P"
            ? `📦 Palette : ${codeGenere}`
            : `📋 Code Déclaration : ${codeGenere}`,
        );

        setLignesProduction([]);
        setQuantiteLancee("");
      } else {
        throw new Error(result.error || "Erreur serveur");
      }
    } catch (error: any) {
      console.error("❌ Production declarer error:", error);
      Alert.alert("Erreur", error.message);
      if (error.message?.includes("Session expirée")) {
        await clearTokensAndLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const buildLabelData = (): ZplData => {
    const coef = selectedOFData?.coefUS || 1;
    const qtyLancee =
      savedQuantiteLancee || String(selectedOFData?.quantiteLancee || "0");
    const qtyLanceeBrute = parseFloat(qtyLancee.replace(",", ".")) || 0;
    const qtyLanceeUVC =
      modeProduction === "S"
        ? parseFloat((qtyLanceeBrute * coef).toFixed(2))
        : undefined;
    const lines =
      dernierePaletteLignes.length > 0
        ? dernierePaletteLignes
        : lignesProduction;

    return {
      type: modeProduction,
      palette: paletteGeneree || "",
      of: selectedOFData?.codeArticle || selectedOF,
      numof: selectedOFData?.numOF || selectedOF,
      designation: selectedOFData?.designation || "",
      matricule: matricule,
      quantiteLancee: qtyLancee,
      quantiteLanceeUVC: qtyLanceeUVC,
      lignes: lines.map((l) => {
        const qtyBrute =
          parseFloat(String(l.quantite || 0).replace(",", ".")) || 0;
        return {
          slot: l.slot,
          qty: qtyBrute,
          LOT: lotGlobal,
          qteUVC:
            modeProduction === "S"
              ? parseFloat((qtyBrute * coef).toFixed(2))
              : undefined,
        };
      }),
    };
  };

  const imprimerPalette = async () => {
    if (!paletteGeneree || !selectedOFData) {
      Alert.alert("Erreur", "Générez d'abord une palette ou déclaration.");
      return;
    }
    const zpl = generateZplLabel(buildLabelData());
    setIsPrinting(true);
    await sendToPrinter(zpl);
    setIsPrinting(false);
  };

  const telechargerPdf = async () => {
    if (!paletteGeneree || !selectedOFData) {
      Alert.alert("Erreur", "Générez d'abord une palette ou déclaration.");
      return;
    }
    setIsPrinting(true);
    await downloadLabelPdf(buildLabelData());
    setIsPrinting(false);
  };

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // ✅ LOADER
  if (isChecking) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={C.red} />
        <Text style={{ marginTop: 10, color: C.inkLight }}>
          Vérification des droits...
        </Text>
      </View>
    );
  }

  if (!isAuthorized) return null;

  return (
    <SafeAreaView style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={s.topbar}>
        <TouchableOpacity style={s.hamburger} onPress={openSidebar}>
          <Text style={s.hamburgerIcon}>☰</Text>
        </TouchableOpacity>
        <View style={s.centerTitleContainer}>
          <Text style={s.topbarTitle}>
            {activeTab === "declaration"
              ? "DÉCLARATION PRODUCTION"
              : "HISTORIQUE DES PALETTES"}
          </Text>
          <Text style={s.topbarSubTitle}>Dr. Oetker · Vanoise App</Text>
        </View>
        <View style={s.logoWrap}>
          <Image
            source={require("../../assets/favicon.png")}
            style={s.logo}
            resizeMode="contain"
          />
        </View>
      </View>
      <View style={s.redRule} />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loading && ordresFabrication.length === 0 ? (
          <View style={s.loadWrap}>
            <Animated.Image
              source={require("../../assets/favicon.png")}
              style={[s.loadLogo, { transform: [{ scale: pulseAnim }] }]}
              resizeMode="contain"
            />
            <Text style={s.loadTxt}>Connexion au système...</Text>
          </View>
        ) : (
          <>
            {activeTab === "declaration" && (
              <View>
                {/* Header avec date et mode */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 20,
                  }}
                >
                  <View style={s.dateChip}>
                    <Text style={s.dateTxt}>{today}</Text>
                  </View>
                  <View
                    style={[
                      s.modeBadge,
                      modeProduction === "P" ? s.modeBadgeP : s.modeBadgeS,
                    ]}
                  >
                    <Text style={s.modeBadgeTxt}>
                      {modeProduction === "P" ? "👷 Prestataire" : "🏭 Salarié"}
                    </Text>
                  </View>
                </View>

                {/* Switch role si plusieurs rôles */}
                {userRoles.length > 1 && (
                  <TouchableOpacity
                    style={s.switchRoleButton}
                    onPress={switchRole}
                  >
                    <Text style={s.switchRoleIcon}>🔄</Text>
                    <View style={s.switchRoleContent}>
                      <Text style={s.switchRoleTitle}>Changer de rôle</Text>
                      <Text style={s.switchRoleSubtitle}>
                        Vos rôles: {userRoles.join(", ")}
                      </Text>
                    </View>
                    <Text style={s.switchRoleArrow}>›</Text>
                  </TouchableOpacity>
                )}

                {/* OF Selection */}
                <Divider label="ORDRE DE FABRICATION" />
                <View style={s.pickerCard}>
                  <Text style={s.inputLabel}>
                    Rechercher et Sélectionner lOF
                  </Text>
                  <TextInput
                    style={s.input}
                    placeholder="Tapez pour filtrer (Ex: OF2303-SGR00260...)"
                    value={searchText}
                    onChangeText={(txt) => {
                      setSearchText(txt);
                      setSelectedOF("");
                      setSelectedOFData(null);
                      setPaletteGeneree(null);
                      setQuantiteLanceeUVCResult(null);
                      setQuantiteLancee("");
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                  />

                  {showDropdown && ordresFabrication.length > 0 && (
                    <View style={s.dropdownContainer}>
                      <ScrollView
                        nestedScrollEnabled
                        style={{ maxHeight: 150 }}
                      >
                        {ordresFabrication.map((of) => (
                          <TouchableOpacity
                            key={of.numOF}
                            style={s.dropdownItem}
                            onPress={() => {
                              setSelectedOF(of.numOF);
                              setSelectedOFData(of);
                              setSearchText(`${of.numOF} - ${of.designation}`);
                              setQuantiteLancee(String(of.quantiteLancee));
                              setQuantiteLanceeUVCResult(
                                of.quantiteLancee * (of.coefUS || 1),
                              );
                              setShowDropdown(false);
                            }}
                          >
                            <Text style={s.dropdownItemTxt}>
                              {of.numOF}
                            </Text>
                            <Text style={{ fontSize: 11, color: C.inkLight }}>
                              📦 {of.codeArticle} - Qté: {of.quantiteLancee} {of.unite}
                            </Text>
                            {!of.articleExists && (
                              <Text style={{ fontSize: 10, color: C.red, fontWeight: 'bold' }}>
                                ⚠️ Article manquant
                              </Text>
                            )}
                            {of.articleExists && (
                              <Text style={{ fontSize: 10, color: C.green }}>
                                ✅ Article existant
                              </Text>
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {selectedOFData && (
                    <View style={s.infoArticleBadge}>
                      <Text
                        style={[
                          s.infoArticleTxt,
                          { fontSize: 16, fontWeight: "800", color: C.red },
                        ]}
                      >
                        📋 {selectedOFData.numOF}
                      </Text>
                      
                      
                         
                        
                    
                      
                      <Text style={s.infoArticleTxt}>
                        <Text style={{ fontWeight: "700" }}>📦 Article :</Text>{" "}
                        {selectedOFData.codeArticle
                          ? `${selectedOFData.codeArticle} - ${selectedOFData.designation}`
                          : selectedOFData.designation}
                      </Text>
                      <Text style={s.infoArticleTxt}>
                        <Text style={{ fontWeight: "700" }}>📏 Unité :</Text>{" "}
                        {selectedOFData.unite || "CAR"}
                      </Text>
                      <Text style={s.infoArticleTxt}>
                        <Text style={{ fontWeight: "700" }}>📊 Coef US :</Text>{" "}
                        {selectedOFData.coefUS}
                      </Text>
                      <Text
                        style={[
                          s.infoArticleTxt,
                          {
                            color: C.red,
                            fontSize: 18,
                            fontWeight: "800",
                            marginTop: 6,
                            paddingTop: 6,
                            borderTopWidth: 1,
                            borderTopColor: C.border,
                          },
                        ]}
                      >
                        📊 Quantité Lancée : {selectedOFData.quantiteLancee}{" "}
                        {selectedOFData.unite || "CAR"}
                      </Text>
                      {modeProduction === "S" && (
                        <Text
                          style={[
                            s.infoArticleTxt,
                            { color: C.blue, fontSize: 14 },
                          ]}
                        >
                          → UVC :{" "}
                          {(
                            selectedOFData.quantiteLancee *
                            (selectedOFData.coefUS || 1)
                          ).toFixed(2)}{" "}
                          {selectedOFData.unite || "CAR"}
                        </Text>
                      )}
                      {/* Affichage des infos supplémentaires de l'OF */}
                      {selectedOFData.ZDATE && (
                        <Text style={[s.infoArticleTxt, { fontSize: 12, color: C.inkLight }]}>
                          📅 Date: {selectedOFData.ZDATE}
                        </Text>
                      )}
                      {selectedOFData.ZSTAT && (
                        <Text style={[s.infoArticleTxt, { fontSize: 12, color: C.inkLight }]}>
                          📊 Statut: {selectedOFData.ZSTAT === '1' ? 'Actif' : 'Inactif'}
                        </Text>
                      )}
                    </View>
                  )}
                </View>

                {/* Lot Global */}
                <Divider label="IDENTIFICATION DU LOT GLOBAL" />
                <View style={s.pickerCard}>
                  <Text style={s.inputLabel}>Numéro de Lot Général</Text>
                  <TextInput
                    style={s.input}
                    placeholder="Ex: L2606"
                    value={lotGlobal}
                    onChangeText={(txt) => {
                      setLotGlobal(txt);
                      setPaletteGeneree(null);
                    }}
                  />
                </View>

                {/* Composition Palette */}
                <View style={s.tableHeaderRow}>
                  <Text style={s.sectionTitle}>Composition Palette</Text>
                  <TouchableOpacity style={s.addButton} onPress={ajouterLigne}>
                    <Text style={s.addButtonText}>+ Ajouter un sous-lot</Text>
                  </TouchableOpacity>
                </View>

                {lignesProduction.length === 0 ? (
                  <Text style={s.emptyText}>
                    Aucun emplacement saisi. Cliquez sur + Ajouter un sous-lot.
                  </Text>
                ) : (
                  lignesProduction.map((ligne, index) => (
                    <View key={ligne.id} style={s.ligneCard}>
                      <Text style={s.ligneIndex}>Sous-lot #{index + 1}</Text>
                      <View style={s.formGrid}>
                        <View style={[s.inputBox, { flex: 2 }]}>
                          <Text style={s.fieldLabel}>SLOT</Text>
                          <TextInput
                            style={s.input}
                            placeholder="Ex: A-12, B-04..."
                            value={ligne.slot}
                            onChangeText={(txt) =>
                              updateLigne(ligne.id, "slot", txt)
                            }
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.fieldLabel}>QUANTITÉ</Text>
                          <TextInput
                            style={s.input}
                            placeholder="Qté"
                            keyboardType="numeric"
                            value={
                              ligne.quantite === null ||
                              ligne.quantite === undefined
                                ? ""
                                : String(ligne.quantite)
                            }
                            onChangeText={(txt) =>
                              updateLigne(ligne.id, "quantite", txt)
                            }
                          />
                        </View>
                      </View>

                      {modeProduction === "S" &&
                        ligne.quantite !== "" &&
                        selectedOFData && (
                          <Text style={s.uvcPreview}>
                            → Qte UVC :{" "}
                            <Text style={{ fontWeight: "700", color: C.blue }}>
                              {(
                                parseFloat(
                                  String(ligne.quantite || 0).replace(",", "."),
                                ) * (selectedOFData.coefUS || 1)
                              ).toFixed(2)}{" "}
                              {selectedOFData.unite || "CAR"}
                            </Text>
                          </Text>
                        )}

                      <TouchableOpacity
                        style={s.deleteBtn}
                        onPress={() => supprimerLigne(ligne.id)}
                      >
                        <Text style={s.deleteBtnTxt}>
                          Supprimer l&apos;emplacement
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}

                {modeProduction === "S" &&
                  lignesProduction.length > 0 &&
                  selectedOFData && (
                    <View style={s.totalUVCCard}>
                      <Text style={s.totalUVCLabel}>Σ Total UVC :</Text>
                      <Text style={s.totalUVCValue}>
                        {lignesProduction
                          .reduce(
                            (acc, l) =>
                              acc +
                              parseFloat(
                                String(l.quantite || 0).replace(",", "."),
                              ) *
                                (selectedOFData.coefUS || 1),
                            0,
                          )
                          .toFixed(2)}{" "}
                        {selectedOFData.unite || "CAR"}
                      </Text>
                    </View>
                  )}

                {/* Bouton Enregistrer */}
                <View style={{ marginTop: 20 }}>
                  <TouchableOpacity
                    style={s.validerBtn}
                    onPress={validerDeclaration}
                  >
                    <Text style={s.validerBtnTxt}>Enregistrer la Palette</Text>
                  </TouchableOpacity>
                </View>

                {/* Palette générée */}
                {paletteGeneree && (
                  <View style={s.paletteCard}>
                    <Text style={s.paletteLabel}>
                      {modeProduction === "P"
                        ? "🔖 CODE PRESTATAIRE GÉNÉRÉ (ID) :"
                        : "📦 NUMÉRO DE PALETTE GÉNÉRÉ :"}
                    </Text>
                    <Text style={s.paletteCode}>{paletteGeneree}</Text>
                    <Text style={s.paletteSub}>
                      Lié à l&apos;OF : {selectedOF} · Lot : {lotGlobal}
                    </Text>
                    {modeProduction === "S" &&
                      quantiteLanceeUVCResult !== null && (
                        <Text
                          style={[
                            s.paletteSub,
                            { color: C.blue, fontWeight: "700", marginTop: 4 },
                          ]}
                        >
                          Qte Lancée UVC : {quantiteLanceeUVCResult.toFixed(2)}{" "}
                          CAR
                        </Text>
                      )}
                    <View>
                      <TouchableOpacity
                        style={s.printBtn}
                        onPress={imprimerPalette}
                        disabled={isPrinting}
                      >
                        <Text style={s.printBtnTxt}>
                          {isPrinting
                            ? "⏳ En cours..."
                            : "🖨️ Imprimer l'étiquette"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.printBtn, { marginTop: 10 }]}
                        onPress={telechargerPdf}
                        disabled={isPrinting}
                      >
                        <Text style={s.printBtnTxt}>
                          ⬇️ Télécharger l&apos;étiquette PDF
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {activeTab === "historique" && (
              <View style={{ paddingBottom: 30 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 15,
                  }}
                >
                  <Text style={s.sectionTitle}>Palettes Enregistrées</Text>
                </View>

                <View style={s.searchBarContainer}>
                  <Text style={s.searchBarIcon}>🔍</Text>
                  <TextInput
                    style={s.searchBarInput}
                    placeholder="Numéro palette, article..."
                    placeholderTextColor={C.inkLight}
                    value={searchTerm}
                    onChangeText={(txt) => setSearchTerm(txt)}
                  />
                  {searchTerm.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setSearchTerm("")}
                      style={s.clearSearchContainer}
                    >
                      <Text style={s.clearSearchText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {loadingHist ? (
                  <View style={{ marginVertical: 40 }}>
                    <ActivityIndicator size="small" color={C.red} />
                  </View>
                ) : historiquePalettes.length === 0 ? (
                  <Text style={s.emptyText}>
                    Aucune palette trouvée dans l&apos;historique.
                  </Text>
                ) : (
                  <>
                    {historiquePalettes.map((pal, idx) => (
                      <View key={idx} style={s.histCard}>
                        <View style={s.histCardHeader}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <Text style={s.histPalNum}>{pal.id || "N/A"}</Text>
                            <View
                              style={[
                                s.modeBadge,
                                pal.type === "P" ? s.modeBadgeP : s.modeBadgeS,
                              ]}
                            >
                              <Text style={s.modeBadgeTxt}>
                                {pal.type === "P" ? "Prestataire" : "Salarié"}
                              </Text>
                            </View>
                          </View>
                          <Text style={s.histDate}>
                            {pal.date_production
                              ? formatDate(pal.date_production)
                              : ""}
                          </Text>
                        </View>

                        <View style={{ marginTop: 8 }}>
                          <Text style={[s.histInfo, { marginBottom: 6 }]}>
                            📦 Article :{" "}
                            <Text style={{ fontWeight: "700" }}>
                              {pal.article || "Inconnu"}
                            </Text>
                          </Text>
                          <Text
                            style={[
                              s.histInfo,
                              {
                                fontWeight: "700",
                                color: C.inkMid,
                                fontSize: 13,
                                marginBottom: 4,
                              },
                            ]}
                          >
                            📋 Composition de la palette :
                          </Text>

                          {pal.slots && pal.slots.length > 0 ? (
                            (() => {
                              const slotsByLot: Record<string, any[]> =
                                pal.slots.reduce(
                                  (acc: Record<string, any[]>, s: any) => {
                                    const lotName = s.lot || "Sans lot";
                                    if (!acc[lotName]) acc[lotName] = [];
                                    acc[lotName].push(s);
                                    return acc;
                                  },
                                  {},
                                );
                              return Object.entries(slotsByLot).map(
                                ([lotName, slotsArr], lotIdx) => {
                                  const totalQtyLot = slotsArr.reduce(
                                    (sum: number, s: any) =>
                                      sum + (parseFloat(s.qty) || 0),
                                    0,
                                  );

                                  return (
                                    <View key={lotIdx} style={{ marginTop: 6 }}>
                                      <Text
                                        style={{
                                          fontSize: 13,
                                          fontWeight: "700",
                                          color: C.red,
                                        }}
                                      >
                                        🏷️ Lot : {lotName}
                                      </Text>

                                      {slotsArr.map((es: any, esi: number) => (
                                        <View
                                          key={esi}
                                          style={{
                                            flexDirection: "row",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            backgroundColor: C.surface,
                                            paddingVertical: 6,
                                            paddingHorizontal: 10,
                                            borderRadius: 4,
                                            marginTop: 4,
                                          }}
                                        >
                                          <Text
                                            style={{
                                              fontSize: 13,
                                              fontWeight: "600",
                                            }}
                                          >
                                            📍 Slot : {es.slot || "—"}
                                          </Text>
                                          <View
                                            style={{ alignItems: "flex-end" }}
                                          >
                                            <Text
                                              style={{
                                                fontSize: 12,
                                                color: C.inkLight,
                                              }}
                                            >
                                              Qté : {es.qty}
                                            </Text>
                                            {pal.type === "S" && (
                                              <Text
                                                style={{
                                                  fontSize: 12,
                                                  fontWeight: "700",
                                                  color: C.blue,
                                                }}
                                              >
                                                UVC :{" "}
                                                {parseFloat(
                                                  String(es.qteUS || 0),
                                                ).toFixed(2)}
                                              </Text>
                                            )}
                                          </View>
                                        </View>
                                      ))}

                                      <View
                                        style={{
                                          flexDirection: "row",
                                          justifyContent: "flex-end",
                                          paddingHorizontal: 10,
                                          marginTop: 6,
                                          backgroundColor: "#F5F5F5",
                                          borderRadius: 4,
                                          paddingVertical: 4,
                                        }}
                                      >
                                        <Text
                                          style={{
                                            fontSize: 12,
                                            fontWeight: "700",
                                            color: C.ink,
                                          }}
                                        >
                                          Total lot : {totalQtyLot.toFixed(2)}{" "}
                                          {pal.slots[0]?.unite || "CAR"}
                                        </Text>
                                      </View>

                                      {pal.type === "S" && (
                                        <View
                                          style={{
                                            flexDirection: "row",
                                            justifyContent: "flex-end",
                                            paddingHorizontal: 10,
                                            marginTop: 2,
                                          }}
                                        >
                                          <Text
                                            style={{
                                              fontSize: 12,
                                              fontWeight: "700",
                                              color: C.blue,
                                            }}
                                          >
                                            Σ UVC lot :{" "}
                                            {slotsArr
                                              .reduce(
                                                (a: number, s: any) =>
                                                  a +
                                                  (parseFloat(s.qteUS) || 0),
                                                0,
                                              )
                                              .toFixed(2)}
                                          </Text>
                                        </View>
                                      )}
                                    </View>
                                  );
                                },
                              );
                            })()
                          ) : (
                            <Text style={s.histInfo}>Aucun lot associé</Text>
                          )}

                          {pal.slots && pal.slots.length > 0 && (
                            <View
                              style={{
                                flexDirection: "row",
                                justifyContent: "flex-end",
                                paddingHorizontal: 10,
                                marginTop: 8,
                                backgroundColor: C.surface,
                                borderRadius: 6,
                                paddingVertical: 6,
                                borderWidth: 1,
                                borderColor: C.border,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: "800",
                                  color: C.ink,
                                }}
                              >
                                Total palette :{" "}
                                {pal.slots
                                  .reduce(
                                    (a: number, s: any) =>
                                      a + (parseFloat(s.qty) || 0),
                                    0,
                                  )
                                  .toFixed(2)}{" "}
                                CAR
                              </Text>
                            </View>
                          )}

                          {pal.type === "S" &&
                            pal.slots &&
                            pal.slots.length > 0 && (
                              <View style={[s.totalUVCCard, { marginTop: 6 }]}>
                                <Text style={s.totalUVCLabel}>
                                  Σ Total UVC palette :
                                </Text>
                                <Text style={s.totalUVCValue}>
                                  {pal.slots
                                    .reduce(
                                      (a: number, s: any) =>
                                        a + (parseFloat(s.qteUS) || 0),
                                      0,
                                    )
                                    .toFixed(2)}{" "}
                                  CAR
                                </Text>
                              </View>
                            )}
                        </View>
                      </View>
                    ))}

                    <View style={s.paginationWrapper}>
                      <TouchableOpacity
                        style={[s.pagBtn, page === 1 && s.pagBtnDisabled]}
                        onPress={handlePrevPage}
                        disabled={page === 1 || loadingHist}
                      >
                        <Text
                          style={[
                            s.pagBtnTxt,
                            page === 1 && s.pagBtnTxtDisabled,
                          ]}
                        >
                          ◀ Précédent
                        </Text>
                      </TouchableOpacity>
                      <View style={s.pageBadge}>
                        <Text style={s.pageBadgeTxt}>Page {page}</Text>
                      </View>
                      <TouchableOpacity
                        style={[s.pagBtn, !hasMore && s.pagBtnDisabled]}
                        onPress={handleNextPage}
                        disabled={!hasMore || loadingHist}
                      >
                        <Text
                          style={[s.pagBtnTxt, !hasMore && s.pagBtnTxtDisabled]}
                        >
                          Suivant ▶
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Footer */}
            <View style={s.footer}>
              <View style={s.footerDivider} />
              <Text style={s.copyright}>
                © 2026{" "}
                <Text
                  style={s.copyrightLink}
                  onPress={() => Linking.openURL("https://vanoiserie.tn/")}
                >
                  Dr. Oetker Vanoise
                </Text>{" "}
                Tous droits réservés.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Sidebar */}
      {sidebarOpen && (
        <Animated.View style={[s.overlay, { opacity: overlayAnim }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={closeSidebar}
          />
        </Animated.View>
      )}

      <Animated.View
        style={[s.sidebar, { transform: [{ translateX: slideAnim }] }]}
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
            <Text style={sb.role}>Département IT · Production</Text>
          </View>
        </View>
        <View style={sb.sep} />
        <View style={sb.section}>
          <Text style={sb.sectionLabel}>NAVIGATION</Text>
          <TouchableOpacity
            style={[sb.item, activeTab === "declaration" && sb.itemActive]}
            onPress={() => {
              setActiveTab("declaration");
              closeSidebar();
            }}
          >
            <Text style={sb.itemIcon}>📦</Text>
            <Text
              style={[
                sb.itemLabel,
                activeTab === "declaration" && sb.itemLabelActive,
              ]}
            >
              Déclaration Prod.
            </Text>
            {activeTab === "declaration" && <View style={sb.pip} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[sb.item, activeTab === "historique" && sb.itemActive]}
            onPress={() => {
              setActiveTab("historique");
              closeSidebar();
            }}
          >
            <Text style={sb.itemIcon}>📜</Text>
            <Text
              style={[
                sb.itemLabel,
                activeTab === "historique" && sb.itemLabelActive,
              ]}
            >
              Historique
            </Text>
            {activeTab === "historique" && <View style={sb.pip} />}
          </TouchableOpacity>
       
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

const s = StyleSheet.create({
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
    fontSize: 13,
    fontWeight: "800",
    color: C.inkMid,
    letterSpacing: 0.5,
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
  },
  logo: { width: 55, height: 32 },
  redRule: { height: 3, backgroundColor: C.red },
  scroll: { padding: 20 },

  loadWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 120,
    gap: 16,
  },
  loadLogo: { width: 90, height: 60 },
  loadTxt: {
    color: C.inkMid,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.3,
  },

  dateChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  dateTxt: { fontSize: 11, color: C.inkLight, fontWeight: "600" },

  modeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  modeBadgeS: { backgroundColor: C.greenSoft },
  modeBadgeP: { backgroundColor: "#EFF6FF" },
  modeBadgeTxt: { fontSize: 11, fontWeight: "700" },

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
  switchRoleIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  switchRoleContent: {
    flex: 1,
  },
  switchRoleTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: C.ink,
  },
  switchRoleSubtitle: {
    fontSize: 11,
    color: C.inkLight,
    marginTop: 2,
  },
  switchRoleArrow: {
    fontSize: 20,
    color: C.inkLight,
  },

  pickerCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: C.inkMid,
    marginBottom: 8,
  },
  dropdownContainer: {
    backgroundColor: "#FFF",
    borderRadius: 8,
    marginTop: 5,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.surface,
  },
  dropdownItemTxt: { color: C.ink, fontSize: 13, fontWeight: "600" },

  infoArticleBadge: {
    backgroundColor: "#F5E6C8",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#C0202A",
  },
  infoArticleTxt: { fontSize: 14, color: "#1F1610", marginBottom: 4 },

  tableHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: C.inkMid },
  addButton: {
    backgroundColor: C.green,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: { color: "#FFF", fontWeight: "700", fontSize: 12 },
  emptyText: {
    textAlign: "center",
    color: C.inkLight,
    fontStyle: "italic",
    marginVertical: 30,
  },

  ligneCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: C.cream,
  },
  ligneIndex: {
    fontSize: 11,
    fontWeight: "800",
    color: C.inkLight,
    marginBottom: 8,
  },
  formGrid: { flexDirection: "row", gap: 8 },
  inputBox: { flex: 1 },
  fieldLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: C.inkLight,
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 40,
    color: C.ink,
    fontSize: 13,
  },
  deleteBtn: { marginTop: 10, alignSelf: "flex-end" },
  deleteBtnTxt: { color: C.red, fontSize: 11, fontWeight: "600" },

  uvcPreview: { fontSize: 12, color: C.inkLight, marginTop: 6, marginLeft: 2 },

  totalUVCCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  totalUVCLabel: { fontSize: 14, fontWeight: "700", color: C.blue },
  totalUVCValue: { fontSize: 16, fontWeight: "800", color: C.blue },

  validerBtn: {
    backgroundColor: C.red,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    elevation: 3,
  },
  validerBtnTxt: { color: "#FFF", fontSize: 15, fontWeight: "800" },

  paletteCard: {
    backgroundColor: C.greenSoft,
    borderWidth: 1,
    borderColor: C.green,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    alignItems: "center",
  },
  paletteLabel: { fontSize: 12, fontWeight: "700", color: C.green },
  paletteCode: {
    fontSize: 24,
    fontWeight: "900",
    color: C.ink,
    letterSpacing: 2,
    marginVertical: 6,
  },
  paletteSub: { fontSize: 11, color: C.inkLight },

  printBtn: {
    backgroundColor: C.blue,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  printBtnTxt: { color: "#FFF", fontWeight: "700", fontSize: 13 },

  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3EFE9",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 20,
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
    minWidth: 110,
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

  histCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: C.cream,
  },
  histCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: 6,
  },
  histPalNum: {
    fontSize: 15,
    fontWeight: "800",
    color: C.inkMid,
    letterSpacing: 0.5,
  },
  histDate: { fontSize: 11, color: C.inkLight },
  histInfo: { fontSize: 13, color: C.ink },

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
  footer: { alignItems: "center", paddingVertical: 24 },
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
});

const div = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  txt: {
    fontSize: 9,
    fontWeight: "800",
    color: C.inkFaint,
    letterSpacing: 2.5,
    flexShrink: 0,
  },
  line: { flex: 1, height: 1, backgroundColor: C.border },
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