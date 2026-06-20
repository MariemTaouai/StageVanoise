import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, Stack } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";

const API_URL = "http://192.168.1.16:3000";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SIDEBAR_WIDTH = 280;

/* ─── Palette — Vanoise Cream ───────────────────────────────── */
const C = {
  bg:          "#FFFFFF",
  surface:     "#FDF6EE",   // creamLight
  cream:       "#F5E6C8",   // sidebar
  red:         "#C0202A",
  redSoft:     "#FDF0F0",
  green:       "#2E7D32",
  greenSoft:   "#F0FDF4",
  blue:        "#2563EB",
  ink:         "#1F1610",   // textMain
  inkMid:      "#3E2723",   // brownDark
  inkLight:    "#7D6E65",   // textSub
  inkFaint:    "#C8B8A8",
  sidebarBg:   "#F5E6C8",   // cream sidebar
  border:      "#EFE5D3",
};

const makeChartConfig = (accent: string) => ({
  backgroundGradientFrom: C.surface,
  backgroundGradientTo:   C.surface,
  color:      (opacity = 1) => `rgba(192,32,42,${opacity})`,
  labelColor: () => C.inkLight,
  strokeWidth: 2,
  decimalPlaces: 0,
  propsForDots: { r: "3.5", strokeWidth: "0", fill: accent },
  propsForBackgroundLines: { stroke: "rgba(125,110,101,0.15)", strokeWidth: 1 },
});

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);

const fmtShort = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + " M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + " k";
  return fmt(n);
};

const calcDelta = (a: number, b: number) =>
  b > 0 ? ((a - b) / b) * 100 : null;

/* ─── Sub-components ────────────────────────────────────────── */
const StatTile = ({
  label, value, stripe,
}: { label: string; value: string; stripe: string }) => (
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

const Legend = () => (
  <View style={leg.row}>
    {[
      { color: C.red,      label: "Réel" },
      { color: "#6B7280",  label: "Budget" },
      { color: C.green,    label: "Forecast" },
      { color: C.inkFaint, label: "N-1" },
    ].map((l) => (
      <View key={l.label} style={leg.item}>
        <View style={[leg.dot, { backgroundColor: l.color }]} />
        <Text style={leg.txt}>{l.label}</Text>
      </View>
    ))}
  </View>
);

/* ─── Screen ────────────────────────────────────────────────── */
export default function SalesDashboardScreen() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [nom, setNom]                 = useState("");

  const [salesRows, setSalesRows]             = useState<any[]>([]);
  const [weeklyHistory, setWeeklyHistory]     = useState<any[]>([]);
  const [budgetVolume, setBudgetVolume]       = useState(0);
  const [budgetCA, setBudgetCA]               = useState(0);
  const [forecastVolume, setForecastVolume]   = useState(0);
  const [forecastCA, setForecastCA]           = useState(0);
  const [n1Volume, setN1Volume]               = useState(0);
  const [n1CA, setN1CA]                       = useState(0);

  const slideAnim   = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const getChartData = (type: "volume" | "ca") => {
    const realData =
      weeklyHistory.length === 4
        ? weeklyHistory.map((w: any) =>
            type === "volume" ? Number(w.total_vol) : Number(w.total_ca)
          )
        : [0, 0, 0, 0];
    const bVal  = (type === "volume" ? budgetVolume   : budgetCA)   / 4;
    const fVal  = (type === "volume" ? forecastVolume : forecastCA) / 4;
    const n1Val = (type === "volume" ? n1Volume       : n1CA)       / 4;
    return {
      labels: ["S-3", "S-2", "S-1", "S"],
      datasets: [
        { data: realData,                     color: () => C.red,      strokeWidth: 3 },
        { data: [bVal,  bVal,  bVal,  bVal],  color: () => "#6B7280",  strokeWidth: 1.5 },
        { data: [fVal,  fVal,  fVal,  fVal],  color: () => C.green,    strokeWidth: 1.5 },
        { data: [n1Val, n1Val, n1Val, n1Val], color: () => C.inkFaint, strokeWidth: 1 },
      ],
    };
  };

  const openSidebar = () => {
    setSidebarOpen(true);
    Animated.parallel([
      Animated.spring(slideAnim,   { toValue: 0, useNativeDriver: true, tension: 100, friction: 14 }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const closeSidebar = () => {
    Animated.parallel([
      Animated.spring(slideAnim,   { toValue: -SIDEBAR_WIDTH, useNativeDriver: true, tension: 100, friction: 14 }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setSidebarOpen(false));
  };

  const handleLogout = async () => {
    closeSidebar();
    await AsyncStorage.clear();
    router.replace("/login");
  };

  useEffect(() => {
    const init = async () => {
      try {
        const userData = await AsyncStorage.getItem("user");
        if (userData) setNom(JSON.parse(userData).nom || "Opérateur");

        const [resSales, resBudgetWeekly, resForecastWeekly, resYearly, resWeekly] =
          await Promise.all([
            fetch(`${API_URL}/api/sales`),
            fetch(`${API_URL}/api/sales/budget-weekly`),
            fetch(`${API_URL}/api/sales/forecast-weekly`),
            fetch(`${API_URL}/api/sales/yearly-volume-comparison`),
            fetch(`${API_URL}/api/sales/weekly-history`),
          ]);

        if (resSales.ok) setSalesRows(await resSales.json());

        if (resBudgetWeekly.ok) {
          const b = await resBudgetWeekly.json();
          setBudgetVolume(b.reduce((s: number, w: any) => s + Number(w.budget_vol), 0));
          setBudgetCA(b.reduce((s: number, w: any) => s + Number(w.budget_ca), 0));
        }

        if (resForecastWeekly.ok) {
          const f = await resForecastWeekly.json();
          setForecastVolume(f.reduce((s: number, w: any) => s + Number(w.forecast_vol), 0));
          setForecastCA(f.reduce((s: number, w: any) => s + Number(w.forecast_ca), 0));
        }

        if (resYearly.ok) {
          const y = await resYearly.json();
          setN1Volume(Number(y.Vol_N1));
          setN1CA(Number(y.CA_N1));
        }

        if (resWeekly.ok) setWeeklyHistory(await resWeekly.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const totalVol = salesRows.reduce((s, r: any) => s + (Number(r.volume)  || 0), 0);
  const totalCA  = salesRows.reduce((s, r: any) => s + (Number(r.ca_brut) || 0), 0);

  const dVolBudget = calcDelta(totalVol, budgetVolume);
  const dCABudget  = calcDelta(totalCA,  budgetCA);

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <SafeAreaView style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* ── Top bar ── */}
      <View style={s.topbar}>
        <TouchableOpacity style={s.hamburger} onPress={openSidebar}>
          <Text style={s.hamburgerIcon}>☰</Text>
        </TouchableOpacity>
        <View style={s.centerTitleContainer}>
          <Text style={s.topbarTitle}>SALES DASHBOARD</Text>
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

      {/* Red accent rule */}
      <View style={s.redRule} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={s.loadWrap}>
            <ActivityIndicator size="large" color={C.red} />
            <Text style={s.loadTxt}>Chargement…</Text>
          </View>
        ) : (
          <>
            {/* Date chip */}
            <View style={s.dateChip}>
              <Text style={s.dateTxt}>{today}</Text>
            </View>

            {/* ════ VOLUME ════ */}
            <Divider label="VOLUME · KG" />

            <View style={s.heroCard}>
              <View>
                <Text style={s.heroEye}>RÉALISÉ CUMULÉ</Text>
                <Text style={s.heroVal}>{fmtShort(totalVol)}</Text>
                <Text style={s.heroUnit}>kilogrammes</Text>
              </View>
              {dVolBudget != null && (
                <View style={[s.deltaBadge, { backgroundColor: dVolBudget >= 0 ? C.greenSoft : C.redSoft }]}>
                  <Text style={[s.deltaTxt, { color: dVolBudget >= 0 ? C.green : C.red }]}>
                    {dVolBudget >= 0 ? "▲" : "▼"} {Math.abs(dVolBudget).toFixed(1)}%
                  </Text>
                  <Text style={s.deltaLbl}>vs Budget</Text>
                </View>
              )}
            </View>

            <View style={s.tileRow}>
              <StatTile label="N-1"      value={fmtShort(n1Volume)}       stripe={C.inkFaint} />
              <StatTile label="Budget"   value={fmtShort(budgetVolume)}   stripe="#6B7280" />
              <StatTile label="Forecast" value={fmtShort(forecastVolume)} stripe={C.blue} />
            </View>

            <View style={s.chartCard}>
              <Text style={s.chartEye}>TENDANCE HEBDOMADAIRE</Text>
              <LineChart
                data={getChartData("volume")}
                width={SCREEN_WIDTH - 64}
                height={170}
                chartConfig={makeChartConfig(C.red)}
                bezier
                withInnerLines
                withOuterLines={false}
                style={{ marginLeft: -10, borderRadius: 0 }}
              />
              <Legend />
            </View>

            {/* ════ CA ════ */}
            <Divider label="CHIFFRE D'AFFAIRES · TND" />

            <View style={[s.heroCard, { borderLeftColor: C.green }]}>
              <View>
                <Text style={s.heroEye}>CA RÉALISÉ</Text>
                <Text style={[s.heroVal, { color: C.green }]}>{fmtShort(totalCA)}</Text>
                <Text style={s.heroUnit}>dinars tunisiens</Text>
              </View>
              {dCABudget != null && (
                <View style={[s.deltaBadge, { backgroundColor: dCABudget >= 0 ? C.greenSoft : C.redSoft }]}>
                  <Text style={[s.deltaTxt, { color: dCABudget >= 0 ? C.green : C.red }]}>
                    {dCABudget >= 0 ? "▲" : "▼"} {Math.abs(dCABudget).toFixed(1)}%
                  </Text>
                  <Text style={s.deltaLbl}>vs Budget</Text>
                </View>
              )}
            </View>

            <View style={s.tileRow}>
              <StatTile label="N-1"      value={fmtShort(n1CA)}      stripe={C.inkFaint} />
              <StatTile label="Budget"   value={fmtShort(budgetCA)}  stripe="#6B7280" />
              <StatTile label="Forecast" value={fmtShort(forecastCA)} stripe={C.blue} />
            </View>

            <View style={s.chartCard}>
              <Text style={s.chartEye}>TENDANCE HEBDOMADAIRE</Text>
              <LineChart
                data={getChartData("ca")}
                width={SCREEN_WIDTH - 64}
                height={170}
                chartConfig={makeChartConfig(C.green)}
                bezier
                withInnerLines
                withOuterLines={false}
                style={{ marginLeft: -10, borderRadius: 0 }}
              />
              <Legend />
            </View>

            <View style={{ height: 32 }} />

            {/* ── Footer site ── */}
            <TouchableOpacity
              style={s.footer}
              onPress={() => Linking.openURL("https://vanoiserie.tn/")}
              activeOpacity={0.7}
            >
              <View style={s.footerDivider} />
              <Text style={s.footerEye}>DÉCOUVREZ NOS PRODUITS</Text>
              <View style={s.footerRow}>
                <Text style={s.footerIcon}>🌐</Text>
                <Text style={s.footerLink}>vanoiserie.tn</Text>
                <Text style={s.footerArrow}>→</Text>
              </View>
            </TouchableOpacity>

            <View style={{ height: 32 }} />
          </>
        )}
      </ScrollView>

      {sidebarOpen && (
        <Animated.View style={[s.overlay, { opacity: overlayAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeSidebar} />
        </Animated.View>
      )}

      <Animated.View style={[s.sidebar, { transform: [{ translateX: slideAnim }] }]}>
        <View style={sb.stripe} />
        {/* ── Logo société ── */}
        <View style={sb.logoBlock}>
          <Image
            source={require("../../assets/favicon.png")}
            style={sb.logoImg}
            resizeMode="contain"
          />
          <Text style={sb.brand}>DR. OETKER</Text>
          <Text style={sb.brandSub}>VANOISE PORTAL</Text>
        </View>
        {/* ── Agent info ── */}
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
          {[
            { icon: "📊", label: "Vue Générale", active: true },
            { icon: "👥", label: "Clients" },
            { icon: "📦", label: "Produits" },
          ].map((it) => (
            <View key={it.label} style={[sb.item, it.active && sb.itemActive]}>
              <Text style={sb.itemIcon}>{it.icon}</Text>
              <Text style={[sb.itemLabel, it.active && sb.itemLabelActive]}>{it.label}</Text>
              {it.active && <View style={sb.pip} />}
            </View>
          ))}
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

/* ─── Styles ─────────────────────────────────────────────────── */
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
  topbarTitle: { fontSize: 15, fontWeight: "800", color: C.inkMid, letterSpacing: 1 },
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
  redRule:   { height: 3, backgroundColor: C.red },
  scroll:    { padding: 20 },
  loadWrap:  { alignItems: "center", paddingTop: 80, gap: 12 },
  loadTxt:   { color: C.inkLight, fontSize: 13 },
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
  heroEye:  { fontSize: 9, fontWeight: "800", color: C.inkLight, letterSpacing: 2, marginBottom: 4 },
  heroVal:  { fontSize: 38, fontWeight: "800", color: C.ink, letterSpacing: -1 },
  heroUnit: { fontSize: 11, color: C.inkLight, marginTop: 2 },
  deltaBadge: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center" },
  deltaTxt:   { fontSize: 17, fontWeight: "800" },
  deltaLbl:   { fontSize: 9, fontWeight: "600", color: C.inkLight, marginTop: 2 },
  tileRow:  { flexDirection: "row", gap: 8, marginBottom: 14 },
  chartCard: {
    backgroundColor: C.surface, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    padding: 16, overflow: "hidden", marginBottom: 28,
  },
  chartEye: { fontSize: 9, fontWeight: "800", color: C.inkFaint, letterSpacing: 2.5, marginBottom: 10 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(31,22,16,0.4)", zIndex: 99 },
  sidebar: {
    position: "absolute", left: 0, top: 0, bottom: 0,
    width: SIDEBAR_WIDTH, backgroundColor: C.cream,
    borderRightWidth: 1, borderRightColor: C.border, zIndex: 100,
  },
  footer: {
    alignItems: "center", paddingVertical: 20,
  },
  footerDivider: {
    width: 40, height: 2, backgroundColor: C.border,
    borderRadius: 1, marginBottom: 14,
  },
  footerEye: {
    fontSize: 8, fontWeight: "800", color: C.inkFaint,
    letterSpacing: 2.5, marginBottom: 10,
  },
  footerRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 100,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  footerIcon: { fontSize: 13 },
  footerLink: {
    fontSize: 13, fontWeight: "700", color: C.red,
    letterSpacing: 0.3,
  },
  footerArrow: { fontSize: 13, color: C.inkLight, fontWeight: "700" },
});

const tile = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  stripe: { height: 3, width: "100%" },
  body:   { padding: 12 },
  label:  { fontSize: 8, fontWeight: "800", color: C.inkLight, letterSpacing: 1.5, marginBottom: 4 },
  value:  { fontSize: 16, fontWeight: "800", color: C.ink },
  sub:    { fontSize: 9, color: C.inkFaint, marginTop: 2 },
  delta:  { fontSize: 10, fontWeight: "700", marginTop: 3 },
});

const div = StyleSheet.create({
  row:  { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  txt:  { fontSize: 9, fontWeight: "800", color: C.inkFaint, letterSpacing: 2.5, flexShrink: 0 },
  line: { flex: 1, height: 1, backgroundColor: C.border },
});

const leg = StyleSheet.create({
  row:  { flexDirection: "row", justifyContent: "space-around", marginTop: 10 },
  item: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot:  { width: 7, height: 7, borderRadius: 3.5 },
  txt:  { fontSize: 9, color: C.inkLight, fontWeight: "700" },
});

const sb = StyleSheet.create({
  stripe: { height: 4, backgroundColor: C.red },
  logoBlock: {
    alignItems: "center",
    paddingTop: 28, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: C.border,
    marginBottom: 4,
  },
  logoImg:   { width: 189, height: 64, marginBottom: 8 },
  brand:     { fontSize: 14, fontWeight: "900", color: C.inkMid, letterSpacing: 0.5 },
  brandSub:  { fontSize: 9, fontWeight: "700", color: C.red, letterSpacing: 2, marginTop: 2 },
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
  name:   { fontSize: 15, fontWeight: "800", color: C.ink },
  role:   { fontSize: 11, color: C.inkLight, marginTop: 2 },
  sep:    { height: 1, backgroundColor: C.border, marginHorizontal: 20, marginBottom: 16 },
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
  itemIcon:   { fontSize: 15, color: C.inkMid },
  itemLabel:  { flex: 1, fontSize: 13, fontWeight: "600", color: C.ink },
  itemLabelActive: { color: "#FFFFFF", fontWeight: "700" },
  pip: {
    position: "absolute", left: 0, top: "20%", bottom: "20%",
    width: 3, borderRadius: 2, backgroundColor: C.red,
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
  version:   { textAlign: "center", fontSize: 10, color: C.inkLight },
});