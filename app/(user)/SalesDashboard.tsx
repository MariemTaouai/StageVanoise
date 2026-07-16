// app/(user)/SalesDashboard.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, Stack } from "expo-router";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";
import { getApiUrl } from "../../Services/apiService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SIDEBAR_WIDTH = 280;

// ─── CONSTANTES ─────────────────────────────────────────────────

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

const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

// ─── INTERFACES ─────────────────────────────────────────────────

interface SalesData {
  volume: number;
  ca_brut: number;
  qty: number;
}

interface MonthlyData {
  mois: number;
  total_quantite: number;
  total_ca: number;
  total_budget: number;
  total_budget_ca: number;
  total_forecast: number;
  total_forecast_ca: number;
  total_n1: number;
  total_n1_ca: number;
}

interface YearlyData {
  Vol_N1: number;
  CA_N1: number;
  Vol_Actuel?: number;
  CA_Actuel?: number;
}

interface BudgetWeeklyItem {
  budget_vol: number;
  budget_ca: number;
}

interface ForecastWeeklyItem {
  forecast_vol: number;
  forecast_ca: number;
}

// ─── FONCTIONS UTILITAIRES ────────────────────────────────────

const fmtShort = (n: number): string =>
  new Intl.NumberFormat("fr-FR").format(Math.round(n));

const calcDelta = (a: number, b: number): number =>
  b > 0 ? ((a - b) / b) * 100 : 0;

// ─── SUB-COMPOSANTS ───────────────────────────────────────────

const StatTile = ({ label, value, stripe }: { label: string; value: string; stripe: string }) => (
  <View style={tile.wrap}>
    <View style={[tile.stripe, { backgroundColor: stripe }]} />
    <View style={tile.body}>
      <Text style={tile.label}>{label}</Text>
      <Text style={tile.value}>{value}</Text>
    </View>
  </View>
);

const Divider = ({ label }: { label: string }) => (
  <View style={div.row}>
    <Text style={div.txt}>{label}</Text>
    <View style={div.line} />
  </View>
);

const Legend = ({ type }: { type: "volume" | "ca" }) => (
  <View style={leg.row}>
    {[
      { color: type === "volume" ? C.red : C.green, label: "Réel" },
      { color: "#6B7280", label: "Budget" },
      { color: C.blue, label: "Forecast" },
      { color: C.inkFaint, label: "N-1" },
    ].map((l) => (
      <View key={l.label} style={leg.item}>
        <View style={[leg.dot, { backgroundColor: l.color }]} />
        <Text style={leg.txt}>{l.label}</Text>
      </View>
    ))}
  </View>
);

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────

export default function SalesDashboardScreen() {
  // ── ÉTATS D'AUTHENTIFICATION ──
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [nom, setNom] = useState("");

  // ── ÉTATS UI ──
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState("");

  // ── ÉTATS DONNÉES ──
  const [salesRows, setSalesRows] = useState<SalesData[]>([]);
  const [monthlyHistory, setMonthlyHistory] = useState<MonthlyData[]>([]);
  const [budgetVolume, setBudgetVolume] = useState(0);
  const [budgetCA, setBudgetCA] = useState(0);
  const [forecastVolume, setForecastVolume] = useState(0);
  const [forecastCA, setForecastCA] = useState(0);
  const [n1Volume, setN1Volume] = useState(0);
  const [n1CA, setN1CA] = useState(0);

  // ── REFS ──
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  // ── FONCTIONS JWT ──

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      if (!refreshToken) return null;

      const url = await getApiUrl();
      const response = await fetch(`${url}/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();
      if (response.ok && data.accessToken) {
        await AsyncStorage.setItem('access_token', data.accessToken);
        return data.accessToken;
      }
      return null;
    } catch (error) {
      console.error('❌ Erreur refresh:', error);
      return null;
    }
  }, []);

  const clearTokensAndLogout = useCallback(async () => {
    try {
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      const url = await getApiUrl();
      if (refreshToken) {
        await fetch(`${url}/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      }
      await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user', 'user_roles', 'selected_role']);
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('❌ Erreur logout:', error);
      router.replace('/(auth)/login');
    }
  }, []);

  const fetchWithToken = useCallback(async (url: string, options: RequestInit = {}) => {
    try {
      let token = await AsyncStorage.getItem('access_token');
      if (!token) {
        const newToken = await refreshAccessToken();
        if (!newToken) throw new Error('Session expirée');
        token = newToken;
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      };

      let response = await fetch(url, { ...options, headers });

      if (response.status === 401) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          const retryHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${newToken}`,
            ...options.headers,
          };
          response = await fetch(url, { ...options, headers: retryHeaders });
        } else {
          await clearTokensAndLogout();
          throw new Error('Session expirée');
        }
      }

      return response;
    } catch (error) {
      console.error('❌ Erreur fetchWithToken:', error);
      throw error;
    }
  }, [refreshAccessToken, clearTokensAndLogout]);

  // ── VÉRIFICATION DES RÔLES ──

  useEffect(() => {
    const checkAccess = async () => {
      try {
        console.log('🔍 [SalesDashboard] Vérification des rôles...');
        
        const accessToken = await AsyncStorage.getItem('access_token');
        if (!accessToken) {
          console.log('❌ Pas de token');
          Alert.alert('⛔ Non authentifié', 'Veuillez vous reconnecter.');
          router.replace('/(auth)/login');
          setIsChecking(false);
          return;
        }

        const rolesString = await AsyncStorage.getItem('user_roles');
        if (!rolesString) {
          console.log('❌ Aucun rôle trouvé');
          Alert.alert('⛔ Accès refusé', 'Vous n\'avez pas les droits.');
          router.replace('/(auth)/login');
          setIsChecking(false);
          return;
        }

        const userRoles = JSON.parse(rolesString);
        console.log('👤 Rôles:', userRoles);
        setUserRoles(userRoles);
        
        const hasAccess = userRoles.some((role: string) => 
          ['Commercial', 'GA sales Controller', 'Admin'].includes(role)
        );
        
        if (!hasAccess) {
          Alert.alert('⛔ Accès refusé', 'Vous n\'avez pas les droits pour accéder à cette page.');
          router.replace('/(auth)/login');
          setIsChecking(false);
          return;
        }
        
        console.log('✅ Accès autorisé !');
        setIsAuthorized(true);
        
      } catch (error) {
        console.error('❌ Erreur vérification:', error);
        router.replace('/(auth)/login');
      } finally {
        setIsChecking(false);
      }
    };
    
    checkAccess();
  }, []);

  // ── FETCH DATA AVEC JWT ──

  const fetchWithError = useCallback(async <T,>(url: string, fallback: T): Promise<T> => {
    try {
      console.log(`📤 Appel: ${url}`);
      const response = await fetchWithToken(url);
      
      if (!response.ok) {
        console.warn(`⚠️ Erreur ${response.status} sur ${url}`);
        return fallback;
      }
      
      const data = await response.json();
      console.log(`📥 Réponse reçue de ${url}`);
      return data;
    } catch (error) {
      console.error(`❌ Erreur fetch ${url}:`, error);
      return fallback;
    }
  }, [fetchWithToken]);

  const fetchData = useCallback(async (url?: string) => {
    const baseUrl = url || apiUrl;
    
    if (!baseUrl) {
      console.warn("⚠️ API URL non configurée");
      setError("URL de l'API non configurée");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [
        salesData,
        budgetWeeklyData,
        forecastWeeklyData,
        yearlyData,
        monthlyData,
      ] = await Promise.all([
        fetchWithError<SalesData[]>(`${baseUrl}/api/sales`, []),
        fetchWithError<BudgetWeeklyItem[]>(`${baseUrl}/api/sales/budget-weekly`, []),
        fetchWithError<ForecastWeeklyItem[]>(`${baseUrl}/api/sales/forecast-weekly`, []),
        fetchWithError<YearlyData>(`${baseUrl}/api/sales/yearly-volume-comparison`, {} as YearlyData),
        fetchWithError<MonthlyData[]>(`${baseUrl}/api/sales/monthly-history`, []),
      ]);

      // Sales data
      setSalesRows(Array.isArray(salesData) ? salesData : []);

      // Budget data
      if (Array.isArray(budgetWeeklyData) && budgetWeeklyData.length > 0) {
        const bVol = budgetWeeklyData.reduce((s, w) => s + Number(w.budget_vol || 0), 0);
        const bCA = budgetWeeklyData.reduce((s, w) => s + Number(w.budget_ca || 0), 0);
        setBudgetVolume(bVol);
        setBudgetCA(bCA);
      } else {
        setBudgetVolume(0);
        setBudgetCA(0);
      }

      // Forecast data
      if (Array.isArray(forecastWeeklyData) && forecastWeeklyData.length > 0) {
        const fVol = forecastWeeklyData.reduce((s, w) => s + Number(w.forecast_vol || 0), 0);
        const fCA = forecastWeeklyData.reduce((s, w) => s + Number(w.forecast_ca || 0), 0);
        setForecastVolume(fVol);
        setForecastCA(fCA);
      } else {
        setForecastVolume(0);
        setForecastCA(0);
      }

      // N-1 data
      if (yearlyData && typeof yearlyData === 'object') {
        setN1Volume(Number(yearlyData.Vol_N1) || 0);
        setN1CA(Number(yearlyData.CA_N1) || 0);
      } else {
        setN1Volume(0);
        setN1CA(0);
      }

      // Monthly history
      if (Array.isArray(monthlyData) && monthlyData.length > 0) {
        setMonthlyHistory(monthlyData);
      } else {
        const defaultMonthly = Array.from({ length: 12 }, (_, i) => ({
          mois: i + 1,
          total_quantite: 0,
          total_ca: 0,
          total_budget: 0,
          total_budget_ca: 0,
          total_forecast: 0,
          total_forecast_ca: 0,
          total_n1: 0,
          total_n1_ca: 0
        }));
        setMonthlyHistory(defaultMonthly);
      }

    } catch (error) {
      console.error("❌ Erreur générale fetchData:", error);
      setError("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, fetchWithError]);

  const handleRetry = useCallback(async () => {
    await fetchData();
  }, [fetchData]);


  useEffect(() => {
    const init = async () => {
      try {
        setIsInitializing(true);
        
        const url = await getApiUrl();
        console.log("✅ API URL chargée:", url);
        setApiUrl(url);
        
        const raw = await AsyncStorage.getItem("user");
        if (!raw) { 
          router.replace("/login"); 
          return; 
        }
        const user = JSON.parse(raw);
        setNom(user.nom || "Opérateur");
        setUserRoles(user.roles || []);
        
        await fetchData(url);
        
      } catch (error) {
        console.error("❌ Erreur initialisation:", error);
        setError("Erreur lors du chargement initial");
      } finally {
        setIsInitializing(false);
        setLoading(false);
      }
    };
    
    init();
  }, []);


  const safeSalesRows = useMemo(() => 
    Array.isArray(salesRows) ? salesRows : [], 
  [salesRows]);

  const totalVol = useMemo(() => 
    safeSalesRows.reduce((s, r) => s + (Number(r.volume) || 0), 0), 
  [safeSalesRows]);

  const totalCA = useMemo(() => 
    safeSalesRows.reduce((s, r) => s + (Number(r.ca_brut) || 0), 0), 
  [safeSalesRows]);

  const dVolN1 = useMemo(() => 
    calcDelta(totalVol, n1Volume), 
  [totalVol, n1Volume]);

  const dCAN1 = useMemo(() => 
    calcDelta(totalCA, n1CA), 
  [totalCA, n1CA]);

  // ── DONNÉES GRAPHIQUES AVEC useMemo ──

  const getChartData = useCallback((type: "volume" | "ca") => {
    if (!Array.isArray(monthlyHistory) || monthlyHistory.length === 0) {
      return {
        labels: ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"],
        datasets: [
          { data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], color: () => type === "volume" ? C.red : C.green, strokeWidth: 3 },
          { data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], color: () => "#6B7280", strokeWidth: 1.5 },
          { data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], color: () => C.blue, strokeWidth: 1.5 },
          { data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], color: () => C.inkFaint, strokeWidth: 1 },
        ],
      };
    }

    const data2026 = [...monthlyHistory]
      .filter(item => item && typeof item === 'object')
      .sort((a, b) => Number(a.mois) - Number(b.mois));

    const labels = data2026.map((r) => {
      const moisIndex = Number(r.mois) - 1;
      return MOIS[moisIndex] || `M${r.mois}`;
    });

    const realData = data2026.map((r) => {
      const val = type === "volume" ? Number(r.total_quantite) : Number(r.total_ca);
      return isNaN(val) ? 0 : val;
    });

    const budgetData = data2026.map((r) => {
      const val = type === "volume" ? Number(r.total_budget) : Number(r.total_budget_ca);
      return isNaN(val) ? 0 : val;
    });

    const forecastData = data2026.map((r) => {
      const val = type === "volume" ? Number(r.total_forecast) : Number(r.total_forecast_ca);
      return isNaN(val) ? 0 : val;
    });

    const n1Data = data2026.map((r) => {
      const val = type === "volume" ? Number(r.total_n1) : Number(r.total_n1_ca);
      return isNaN(val) ? 0 : val;
    });

    return {
      labels,
      datasets: [
        { data: realData, color: () => type === "volume" ? C.red : C.green, strokeWidth: 3 },
        { data: budgetData, color: () => "#6B7280", strokeWidth: 1.5 },
        { data: forecastData, color: () => C.blue, strokeWidth: 1.5 },
        { data: n1Data, color: () => C.inkFaint, strokeWidth: 1 },
      ],
    };
  }, [monthlyHistory]);

  const chartDataVolume = useMemo(() => getChartData("volume"), [getChartData]);
  const chartDataCA = useMemo(() => getChartData("ca"), [getChartData]);

  const makeChartConfig = useCallback((accent: string) => ({
    backgroundGradientFrom: C.surface,
    backgroundGradientTo: C.surface,
    color: (opacity = 1) => `rgba(192,32,42,${opacity})`,
    labelColor: () => C.inkLight,
    strokeWidth: 2,
    decimalPlaces: 0,
    propsForDots: { r: "3", strokeWidth: "0", fill: accent },
    propsForBackgroundLines: { stroke: "rgba(125,110,101,0.15)", strokeWidth: 1 },
  }), []);

  const chartConfigVolume = useMemo(() => makeChartConfig(C.red), [makeChartConfig]);
  const chartConfigCA = useMemo(() => makeChartConfig(C.green), [makeChartConfig]);

  // ── SIDEBAR ──

  const openSidebar = useCallback(() => {
    setSidebarOpen(true);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 14 }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);

  const closeSidebar = useCallback(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: -SIDEBAR_WIDTH, useNativeDriver: true, tension: 100, friction: 14 }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setSidebarOpen(false));
  }, []);

  const handleLogout = useCallback(async () => {
    closeSidebar();
    await clearTokensAndLogout();
  }, [closeSidebar, clearTokensAndLogout]);

  const switchRole = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('selected_role');
      router.replace('/(auth)/RoleSelectionScreen');
    } catch (error) {
      console.error('❌ Erreur changement de rôle:', error);
    }
  }, []);

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });

  // ── RENDU ──

  if (isChecking) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.loadWrap}>
          <ActivityIndicator size="large" color={C.red} />
          <Text style={s.loadTxt}>Vérification des droits...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthorized) return null;

  if (isInitializing || loading) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.loadWrap}>
          <ActivityIndicator size="large" color={C.red} />
          <Text style={s.loadTxt}>Chargement du tableau de bord...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.errorContainer}>
          <Text style={s.errorIcon}>⚠️</Text>
          <Text style={s.errorTitle}>Erreur de chargement</Text>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryButton} onPress={handleRetry}>
            <Text style={s.retryButtonText}>🔄 Réessayer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={s.topbar}>
        <TouchableOpacity style={s.hamburger} onPress={openSidebar}>
          <Text style={s.hamburgerIcon}>☰</Text>
        </TouchableOpacity>
        <View style={s.centerTitleContainer}>
          <Text style={s.topbarTitle}>SALES DASHBOARD</Text>
          <Text style={s.topbarSubTitle}>Dr. Oetker · Vanoise App</Text>
        </View>
        <View style={s.logoWrap}>
          <Image source={require("../../assets/favicon.png")} style={s.logo} resizeMode="contain" />
        </View>
      </View>
      <View style={s.redRule} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.dateChip}>
          <Text style={s.dateTxt}>{today}</Text>
        </View>

        {userRoles.length > 1 && (
          <TouchableOpacity style={s.switchRoleButton} onPress={switchRole}>
            <Text style={s.switchRoleIcon}>🔄</Text>
            <View style={s.switchRoleContent}>
              <Text style={s.switchRoleTitle}>Changer de rôle</Text>
              <Text style={s.switchRoleSubtitle}>Vos rôles: {userRoles.join(', ')}</Text>
            </View>
            <Text style={s.switchRoleArrow}>›</Text>
          </TouchableOpacity>
        )}

        <Divider label="VOLUME" />

        <View style={s.heroCard}>
          <View>
            <Text style={s.heroEye}>QUANTITÉ TOTALE</Text>
            <Text style={s.heroVal}>{fmtShort(totalVol)}</Text>
            <Text style={s.heroUnit}>kilogrammes</Text>
          </View>
          <View style={[s.deltaBadge, { backgroundColor: dVolN1 >= 0 ? C.greenSoft : C.redSoft }]}>
            <Text style={[s.deltaTxt, { color: dVolN1 >= 0 ? C.green : C.red }]}>
              {dVolN1 >= 0 ? "▲" : "▼"} {Math.abs(dVolN1).toFixed(1)}%
            </Text>
            <Text style={s.deltaLbl}>vs N-1</Text>
          </View>
        </View>

        <View style={s.tileRow}>
          <StatTile label="N-1" value={fmtShort(n1Volume)} stripe={C.inkFaint} />
          <StatTile label="Budget" value={fmtShort(budgetVolume)} stripe="#6B7280" />
          <StatTile label="Forecast" value={fmtShort(forecastVolume)} stripe={C.blue} />
        </View>

        <View style={s.chartCard}>
          <Text style={s.chartEye}>ÉVOLUTION MENSUELLE · RÉEL vs BUDGET vs FORECAST vs N-1</Text>
          <LineChart
            data={chartDataVolume}
            width={SCREEN_WIDTH - 64}
            height={180}
            chartConfig={chartConfigVolume}
            bezier
            withInnerLines
            withOuterLines={false}
            style={{ marginLeft: -10, borderRadius: 0 }}
          />
          <Legend type="volume" />
        </View>

        <Divider label="CHIFFRE D'AFFAIRES" />

        <View style={[s.heroCard, { borderLeftColor: C.green }]}>
          <View>
            <Text style={s.heroEye}>CA RÉALISÉ</Text>
            <Text style={[s.heroVal, { color: C.green }]}>{fmtShort(totalCA)}</Text>
            <Text style={s.heroUnit}>dinars tunisiens</Text>
          </View>
          <View style={[s.deltaBadge, { backgroundColor: dCAN1 >= 0 ? C.greenSoft : C.redSoft }]}>
            <Text style={[s.deltaTxt, { color: dCAN1 >= 0 ? C.green : C.red }]}>
              {dCAN1 >= 0 ? "▲" : "▼"} {Math.abs(dCAN1).toFixed(1)}%
            </Text>
            <Text style={s.deltaLbl}>vs N-1</Text>
          </View>
        </View>

        <View style={s.tileRow}>
          <StatTile label="N-1" value={fmtShort(n1CA)} stripe={C.inkFaint} />
          <StatTile label="Budget" value={fmtShort(budgetCA)} stripe="#6B7280" />
          <StatTile label="Forecast" value={fmtShort(forecastCA)} stripe={C.blue} />
        </View>

        <View style={s.chartCard}>
          <Text style={s.chartEye}>ÉVOLUTION MENSUELLE · RÉEL vs BUDGET vs FORECAST vs N-1</Text>
          <LineChart
            data={chartDataCA}
            width={SCREEN_WIDTH - 64}
            height={180}
            chartConfig={chartConfigCA}
            bezier
            withInnerLines
            withOuterLines={false}
            style={{ marginLeft: -10, borderRadius: 0 }}
          />
          <Legend type="ca" />
        </View>

        <View style={s.footer}>
          <View style={s.footerDivider} />
          <Text style={s.copyright}>
            © 2026{" "}
            <Text style={s.copyrightLink} onPress={() => Linking.openURL("https://vanoiserie.tn/")}>
              Dr. Oetker Vanoise
            </Text>{" "}
            Tous droits réservés.
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {sidebarOpen && (
        <Animated.View style={[s.overlay, { opacity: overlayAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeSidebar} />
        </Animated.View>
      )}

      <Animated.View style={[s.sidebar, { transform: [{ translateX: slideAnim }] }]}>
        <View style={sb.stripe} />
        <View style={sb.logoBlock}>
          <Image source={require("../../assets/favicon.png")} style={sb.logoImg} resizeMode="contain" />
          <Text style={sb.brand}>DR. OETKER</Text>
          <Text style={sb.brandSub}>VANOISE PORTAL</Text>
        </View>
        <View style={sb.header}>
          <View style={sb.avatarLg}>
            <Text style={sb.avatarLgTxt}>{nom ? nom[0].toUpperCase() : "V"}</Text>
          </View>
          <View>
            <Text style={sb.name}>{nom || "Opérateur"}</Text>
            <Text style={sb.role}>Commercial · Vanoise</Text>
          </View>
        </View>
        <View style={sb.sep} />
        <View style={sb.section}>
          <Text style={sb.sectionLabel}>NAVIGATION</Text>
          <View style={[sb.item, sb.itemActive]}>
            <Text style={sb.itemIcon}>📊</Text>
            <Text style={[sb.itemLabel, sb.itemLabelActive]}>Sales Dashboard</Text>
            <View style={sb.pip} />
          </View>
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

// ─── STYLES ───────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topbar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderColor: C.cream, backgroundColor: C.bg,
  },
  hamburger: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: C.surface, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.border,
  },
  hamburgerIcon: { color: C.inkMid, fontSize: 20, fontWeight: "bold" },
  centerTitleContainer: { alignItems: "center" },
  topbarTitle: { fontSize: 15, fontWeight: "800", color: C.inkMid, letterSpacing: 1 },
  topbarSubTitle: { fontSize: 11, color: C.inkLight, marginTop: 1 },
  logoWrap: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: C.bg, borderWidth: 1, borderColor: "#ECDFD2",
    alignItems: "center", justifyContent: "center",
    shadowColor: C.red, shadowOpacity: 0.1, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  logo: { width: 55, height: 32 },
  redRule: { height: 3, backgroundColor: C.red },
  scroll: { padding: 20 },
  loadWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadTxt: { color: C.inkLight, fontSize: 13 },
  dateChip: {
    alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 100, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border, marginBottom: 20,
  },
  dateTxt: { fontSize: 11, color: C.inkLight, fontWeight: "600" },
  heroCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: C.surface, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    borderLeftWidth: 4, borderLeftColor: C.red,
    padding: 18, marginBottom: 12,
  },
  heroEye: { fontSize: 9, fontWeight: "800", color: C.inkLight, letterSpacing: 2, marginBottom: 4 },
  heroVal: { fontSize: 32, fontWeight: "800", color: C.ink, letterSpacing: -1 },
  heroUnit: { fontSize: 11, color: C.inkLight, marginTop: 2 },
  deltaBadge: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, alignItems: "center" },
  deltaTxt: { fontSize: 15, fontWeight: "800" },
  deltaLbl: { fontSize: 9, fontWeight: "600", color: C.inkLight, marginTop: 2 },
  tileRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  chartCard: {
    backgroundColor: C.surface, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    padding: 16, overflow: "hidden", marginBottom: 28,
  },
  chartEye: { fontSize: 8, fontWeight: "800", color: C.inkFaint, letterSpacing: 1.5, marginBottom: 10 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(31,22,16,0.4)", zIndex: 99 },
  sidebar: {
    position: "absolute", left: 0, top: 0, bottom: 0,
    width: SIDEBAR_WIDTH, backgroundColor: C.cream,
    borderRightWidth: 1, borderRightColor: C.border, zIndex: 100,
  },
  footer: { alignItems: "center", paddingVertical: 24 },
  footerDivider: { width: 40, height: 1, backgroundColor: C.border, borderRadius: 1, marginBottom: 16 },
  copyright: { fontSize: 12, color: C.inkLight, textAlign: "center", lineHeight: 20 },
  copyrightLink: { fontSize: 12, color: C.red, fontWeight: "700" },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  errorIcon: { fontSize: 48, marginBottom: 20 },
  errorTitle: { fontSize: 20, fontWeight: "bold", color: C.ink, marginBottom: 10 },
  errorText: { fontSize: 14, color: C.inkLight, textAlign: "center", marginBottom: 20 },
  retryButton: { backgroundColor: C.red, paddingHorizontal: 30, paddingVertical: 12, borderRadius: 8 },
  retryButtonText: { color: "#FFFFFF", fontWeight: "bold", fontSize: 16 },
  switchRoleButton: {
    flexDirection: 'row',
    alignItems: 'center',
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
  switchRoleTitle: { fontSize: 14, fontWeight: '700', color: C.ink },
  switchRoleSubtitle: { fontSize: 11, color: C.inkLight, marginTop: 2 },
  switchRoleArrow: { fontSize: 20, color: C.inkLight },
});

const tile = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  stripe: { height: 3, width: "100%" },
  body: { padding: 12 },
  label: { fontSize: 8, fontWeight: "800", color: C.inkLight, letterSpacing: 1.5, marginBottom: 4 },
  value: { fontSize: 14, fontWeight: "800", color: C.ink },
});

const div = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  txt: { fontSize: 9, fontWeight: "800", color: C.inkFaint, letterSpacing: 2.5, flexShrink: 0 },
  line: { flex: 1, height: 1, backgroundColor: C.border },
});

const leg = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-around", marginTop: 10 },
  item: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  txt: { fontSize: 9, color: C.inkLight, fontWeight: "700" },
});

const sb = StyleSheet.create({
  stripe: { height: 4, backgroundColor: C.red },
  logoBlock: {
    alignItems: "center", paddingTop: 28, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 4,
  },
  logoImg: { width: 189, height: 64, marginBottom: 8 },
  brand: { fontSize: 14, fontWeight: "900", color: C.inkMid, letterSpacing: 0.5 },
  brandSub: { fontSize: 9, fontWeight: "700", color: C.red, letterSpacing: 2, marginTop: 2 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 22, paddingTop: 28, paddingBottom: 22,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  avatarLg: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: C.red, alignItems: "center", justifyContent: "center",
  },
  avatarLgTxt: { color: "#FFF", fontWeight: "800", fontSize: 20 },
  name: { fontSize: 15, fontWeight: "800", color: C.ink },
  role: { fontSize: 11, color: C.inkLight, marginTop: 2 },
  sep: { height: 1, backgroundColor: C.border, marginHorizontal: 20, marginBottom: 16 },
  section: { paddingHorizontal: 14 },
  sectionLabel: {
    fontSize: 9, fontWeight: "800", color: C.inkLight,
    letterSpacing: 2.5, marginLeft: 14, marginBottom: 8,
  },
  item: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 10, marginBottom: 4, position: "relative",
  },
  itemActive: { backgroundColor: C.red },
  itemIcon: { fontSize: 15, color: C.inkMid },
  itemLabel: { flex: 1, fontSize: 13, fontWeight: "600", color: C.ink },
  itemLabelActive: { color: "#FFFFFF", fontWeight: "700" },
  pip: {
    position: "absolute", left: 0, top: "20%", bottom: "20%",
    width: 3, borderRadius: 2, backgroundColor: C.red,
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
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: 20, borderTopWidth: 1, borderTopColor: C.border,
  },
  logoutBtn: {
    paddingVertical: 13, borderRadius: 10,
    backgroundColor: "#FDF6EE",
    borderWidth: 1, borderColor: C.red,
    alignItems: "center", marginBottom: 10,
  },
  logoutTxt: { color: C.red, fontWeight: "700", fontSize: 13 },
  version: { textAlign: "center", fontSize: 10, color: C.inkLight },
});