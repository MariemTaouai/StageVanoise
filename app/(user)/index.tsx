import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, Stack } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Linking } from "react-native";
import { BarChart, LineChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SIDEBAR_WIDTH = 280;

/* ─── NOUVELLE PALETTE CLAIRE & PREMIUM VANOISE ─── */
const C = {
  white: "#FFFFFF",        // Fond principal de l'application
  cream: "#F5E6C8",        // Beige crème chaud (Sidebar)
  creamLight: "#FDF6EE",   // Crème plus claire pour les cartes/formulaires
  red: "#C0202A",          // Rouge marque (Boutons actifs, accents)
  brownDark: "#3E2723",    // Brun foncé pour des textes ultra-lisibles
  textMain: "#1F1610",     // Texte principal
  textSub: "#7D6E65",      // Texte secondaire / légendes
  green: "#2E7D32",        // Vert soft pour les indicateurs positifs
  border: "#EFE5D3",       // Bordures légères assorties au crème
};

const navItems = [
  { id: "click", icon: "📈", label: "Click" },
  { id: "demandes", icon: "📥", label: "Demandes Clients" },
  { id: "avis", icon: "⭐", label: "Avis & Retours" },
];

/* ─── CHARTS CONFIG CLAIRE ─── */
const chartConfig = {
  backgroundGradientFrom: C.creamLight,
  backgroundGradientTo: C.creamLight,
  color: (opacity = 1) => `rgba(192, 32, 42, ${opacity})`,
  labelColor: () => C.textSub,
  strokeWidth: 2,
  propsForDots: { r: "5", strokeWidth: "2", stroke: C.red },
  propsForBackgroundLines: { stroke: "rgba(125, 110, 101, 0.15)", strokeWidth: 1 },
  decimalPlaces: 0,
};

export default function DashboardScreen() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentScreen, setCurrentScreen] = useState("dashboard"); // Gestionnaire d'écrans séparés
  const [nom, setNom] = useState("");

  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const openSidebar = () => {
    setSidebarOpen(true);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 14 }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const closeSidebar = () => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: -SIDEBAR_WIDTH, useNativeDriver: true, tension: 100, friction: 14 }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setSidebarOpen(false));
  };

  const handleNavigation = (screenId: string) => {
    setCurrentScreen(screenId); // Change instantanément de composant affiché
    closeSidebar();
  };

  const handleLogout = async () => {
    try {
      closeSidebar();
      await AsyncStorage.clear();
      router.replace("/login");
    } catch (error) {
      console.error("Erreur déconnexion:", error);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await AsyncStorage.getItem("user");
        if (userData) {
          const user = JSON.parse(userData);
          setNom(user.nom || "Opérateur");
        }
      } catch (error) {
        console.log("Erreur AsyncStorage", error);
      }
    };
    loadUser();
  }, []);

  const getInitials = (fullName: string) => {
    if (!fullName) return "VN";
    return fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  /* ─── RENDU CONDITIONNEL DES ÉCRANS (PARTIES SÉPARÉES) ─── */
  const renderScreenContent = () => {
    switch (currentScreen) {
      case "dashboard":
        return (
          <View>
            {/* Grid des KPIs */}
            <View style={s.kpiGrid}>
              <KpiCard icon="⚡" val="84 200" lbl="VENTES (TND)" trend="+12%" up iconColor={C.red} />
              <KpiCard icon="📦" val="147" lbl="COMMANDES" trend="+8%" up iconColor={C.brownDark} />
              <KpiCard icon="🛰️" val="38" lbl="CLIENTS ACTIFS" trend="+3 nouv." up iconColor={C.green} />
              <KpiCard icon="🎯" val="78%" lbl="OBJECTIF GLOBAL" trend="Cible: 108k" up={false} iconColor={C.textSub} />
            </View>

            {/* Aperçu rapide des performances */}
          
          </View>
        );

      case "click":
        return (
          <View>
            <View style={s.card}>
              <Text style={s.cardTitle}>ÉVOLUTION DES VENTES COMPARES</Text>
              <LineChart
                data={{
                  labels: ["1", "5", "9", "13", "17", "21", "25", "29"],
                  datasets: [{ data: [2800, 3800, 4200, 5100, 4400, 5600, 6100, 6800] }],
                }}
                width={SCREEN_WIDTH - 40}
                height={200}
                chartConfig={chartConfig}
                bezier
                style={s.chartStyle}
              />
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>PERFORMANCE PAR CATÉGORIE (%)</Text>
              <BarChart
                data={{
                  labels: ["Ingréd.", "Mélanges", "Desserts", "Autres"],
                  datasets: [{ data: [42, 28, 20, 10] }],
                }}
                width={SCREEN_WIDTH - 40}
                height={200}
                chartConfig={chartConfig}
                fromZero
                showValuesOnTopOfBars
                style={s.chartStyle}
              />
            </View>
          </View>
        );

      case "demandes":
        return (
          <View style={s.card}>
            <Text style={s.cardTitle}>RÉPARTITION ET CIBLES PAR ZONE</Text>
            {[
              { name: "Grand Tunis", pct: 92, color: C.red },
              { name: "Sfax & Sud", pct: 74, color: C.brownDark },
              { name: "Sousse & Sahel", pct: 61, color: "#993556" },
              { name: "Nord-Ouest", pct: 48, color: C.textSub },
            ].map((z) => (
              <View key={z.name} style={s.progRow}>
                <View style={s.progHeader}>
                  <Text style={s.progLabel}>{z.name}</Text>
                  <Text style={[s.progVal, { color: z.color }]}>{z.pct}%</Text>
                </View>
                <View style={s.progTrack}>
                  <View style={[s.progFill, { width: `${z.pct}%`, backgroundColor: z.color }]} />
                </View>
              </View>
            ))}
          </View>
        );

      case "avis":
        return (
          <View style={s.card}>
            <Text style={s.cardTitle}>TOP PARTENAIRES COMMERCIAUX</Text>
            {[
              { initials: "MS", name: "Maison Sfaxienne", sub: "12 commandes · Sfax", amt: "14 800", badge: "Top client", color: C.red },
              { initials: "PB", name: "Pâtisserie Bougatir", sub: "9 commandes · Tunis", amt: "11 200", badge: "Fidèle", color: C.brownDark },
              { initials: "SC", name: "Sucré & Co", sub: "7 commandes · Sousse", amt: "8 600", badge: "Nouveau", color: C.green },
            ].map((c, index) => (
              <View key={c.name} style={s.clientRow}>
                <View style={[s.clientAv, { backgroundColor: c.color + "15" }]}>
                  <Text style={[s.clientAvTxt, { color: c.color }]}>{c.initials}</Text>
                </View>
                <View style={s.clientInfo}>
                  <Text style={s.clientName}>{c.name}</Text>
                  <Text style={s.clientSub}>{c.sub}</Text>
                </View>
                <Text style={s.clientAmt}>{c.amt} TND</Text>
              </View>
            ))}
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />

      {/* ── BARRE SUPÉRIEURE ÉPURÉE ── */}
     <View style={s.topbar}>
  <TouchableOpacity style={s.hamburger} onPress={openSidebar}>
    <Text style={s.hamburgerIcon}>☰</Text>
  </TouchableOpacity>
  <View style={s.centerTitleContainer}>
    <Text style={s.topbarTitle}>
      {navItems.find((n) => n.id === currentScreen)?.label.toUpperCase()}
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

      {/* ── COEUR DE L'ÉCRAN SÉLECTIONNÉ ── */}
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {renderScreenContent()}
      </ScrollView>

      {/* ── BACKGROUND OVERLAY ── */}
      {sidebarOpen && (
        <Animated.View style={[s.overlay, { opacity: overlayAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeSidebar} activeOpacity={1} />
        </Animated.View>
      )}

      {/* ── SIDEBAR LUMINSEUSE (CREAM #F5E6C8) ── */}
      <Animated.View style={[s.sidebar, { transform: [{ translateX: slideAnim }] }]}>
        <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
          
          <View style={s.sbHeader}>
            {/* LOGO IMAGE INCORPORÉ DIRECTEMENT ICI */}
            <View style={s.logoContainer}>
              <Image source={require("../../assets/favicon.png")} style={s.sbLogoImage} resizeMode="contain" />
              <Text style={s.sbBrand}>DR. OETKER</Text>
              <Text style={s.sbBrandSub}>VANOISE PORTAL</Text>
            </View>

            {/* Infos Agent Connecté */}
       <View style={{ flex: 1, justifyContent: 'center' }}>
    <Text style={{ fontSize: 11, color: C.textSub, fontWeight: "500" }}>
      Bonjour,
    </Text>
    <Text style={s.sbAgentName} numberOfLines={1}>
      {nom ? nom : "Opérateur"}
    </Text>
  </View>
          </View>

          {/* Corps de navigation */}
          <ScrollView style={s.sbNav}>
            <Text style={s.sbSection}>NAVIGATION INTERNE</Text>
            {navItems.map((item) => {
              const isItemActive = currentScreen === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[s.sbItem, isItemActive && s.sbItemActive]}
                  onPress={() => handleNavigation(item.id)}
                >
                  <Text style={[s.sbItemIcon, isItemActive && { color: C.white }]}>{item.icon}</Text>
                  <Text style={[s.sbItemLabel, isItemActive && s.sbItemLabelActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Déconnexion */}
          <View style={s.sbFooter}>
            <TouchableOpacity style={s.sbLogout} onPress={handleLogout}>
              <Text style={s.sbLogoutTxt}>Deconnexion</Text>
            </TouchableOpacity>
          </View>
          
        </SafeAreaView>
        
      </Animated.View>
    </SafeAreaView>
  );
}

/* ─── COMPOSANT CARTE KPI CLAIRE ─── */
function KpiCard({ icon, val, lbl, trend, up, iconColor }: any) {
  return (
    <View style={s.kpi}>
      <View style={s.kpiHeaderRow}>
        <Text style={[s.kpiIcon, { color: iconColor }]}>{icon}</Text>
        <Text style={[s.kpiTrend, { color: up ? C.green : C.red }]}>
          {up ? "▲" : "▼"} {trend}
        </Text>
      </View>
      <Text style={s.kpiVal}>{val}</Text>
      <Text style={s.kpiLbl}>{lbl}</Text>
    </View>
  );
}

/* ─── STYLES DU DESIGN CLAIR ─── */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.white },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10 },
  
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: C.cream,
    backgroundColor: C.white,
  },
  hamburger: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.creamLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  hamburgerIcon: { color: C.brownDark, fontSize: 20, fontWeight: "bold" },
  centerTitleContainer: { alignItems: "center" },
  topbarTitle: { fontSize: 15, fontWeight: "800", color: C.brownDark, letterSpacing: 1 },
  topbarSubTitle: { fontSize: 11, color: C.textSub, marginTop: 1 },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16, marginTop: 10 },
  kpi: {
    width: (SCREEN_WIDTH - 52) / 2,
    borderRadius: 16,
    backgroundColor: C.creamLight,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  kpiHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  kpiIcon: { fontSize: 18 },
  kpiVal: { fontSize: 22, fontWeight: "800", color: C.textMain },
  kpiLbl: { fontSize: 10, color: C.textSub, marginTop: 4, fontWeight: "600" },
  kpiTrend: { fontSize: 11, fontWeight: "700" },

  card: {
    backgroundColor: C.creamLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 12, fontWeight: "800", color: C.brownDark, marginBottom: 14, letterSpacing: 0.5 },
  emptyTxt: { fontSize: 13, color: C.textSub, lineHeight: 18 },
  chartStyle: { marginLeft: -15, borderRadius: 12 },

logoWrap: {
  width: 44,
  height: 44,
  borderRadius: 14,
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#ECDFD2",
  alignItems: "center",
  justifyContent: "center",
  shadowColor: "#C0202A",
  shadowOpacity: 0.1,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
},
logo: {
  width: 32,
  height: 32,
},


  progRow: { marginBottom: 14 },
  progHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  progLabel: { fontSize: 13, color: C.textMain, fontWeight: "500" },
  progVal: { fontSize: 13, fontWeight: "700" },
  progTrack: { height: 6, backgroundColor: C.border, borderRadius: 3, overflow: "hidden" },
  progFill: { height: "100%", borderRadius: 3 },

  clientRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  clientAv: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyValue: "center", justifyContent: 'center' },
  clientAvTxt: { fontSize: 12, fontWeight: "800" },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 13, fontWeight: "700", color: C.textMain },
  clientSub: { fontSize: 11, color: C.textSub },
  clientAmt: { fontSize: 13, fontWeight: "800", color: C.textMain },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(31,22,16,0.4)", zIndex: 99 },
  sidebar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: C.cream,
    borderRightWidth: 1,
    borderColor: C.border,
    zIndex: 100,
  },
  sbHeader: { padding: 24, borderBottomWidth: 1, borderColor: C.border },
  logoContainer: { alignItems: "center", marginBottom: 20 },
  sbLogoImage: { width: 65, height: 65, marginBottom: 8 },
  sbBrand: { fontSize: 15, fontWeight: "900", color: C.brownDark, letterSpacing: 0.5 },
  sbBrandSub: { fontSize: 9, color: C.red, fontWeight: "700", letterSpacing: 1.5, marginTop: 2 },
  
  sbAgent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,

  },
  sbAvatarTxt: { fontSize: 12, fontWeight: "800", color: C.white },
  sbAgentName: { fontSize: 13, fontWeight: "700", color: C.textMain },
  sbOnlineTxt: { fontSize: 10, color: C.green, fontWeight: "600", marginTop: 2 },
  
  sbNav: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  sbSection: { fontSize: 10, color: C.textSub, letterSpacing: 1, paddingHorizontal: 12, marginBottom: 8, fontWeight: "700" },
  sbItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, marginBottom: 4 },
  sbItemActive: { backgroundColor: C.red },
  sbItemIcon: { fontSize: 16, color: C.brownDark },
  sbItemLabel: { flex: 1, fontSize: 13, color: C.textMain, fontWeight: "500" },
  sbItemLabelActive: { color: C.white, fontWeight: "700" },
  
  sbFooter: { padding: 16, borderTopWidth: 1, borderColor: C.border },
  sbLogout: {
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: C.creamLight,
    borderWidth: 1,
    borderColor: C.red,
    alignItems: "center",
  },
  sbLogoutTxt: { fontSize: 12, color: C.red, fontWeight: "700" },
});