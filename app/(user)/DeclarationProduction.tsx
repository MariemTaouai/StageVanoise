import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, Stack } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Image,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Linking
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { generateZplLabel, sendToPrinter } from "../../Services/printService";

const API_URL = "http://10.197.21.178:3000";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SIDEBAR_WIDTH = 280;

export interface ProductionLine {
  id: string;
  lot: string;
  slot: string;
  quantite: string;
}

export interface ArticleOF {
  ZITMREF: string;
  ZITMDES: string;
  ZPCU?: string;        // ✅ Ajouté pour le ZPL
  ZPCUSTUCOE?: number;  // ✅ Ajouté pour le ZPL
  ZSHL?: number;        // ✅ Ajouté pour le ZPL
}

export interface UserData {
  nom?: string;
  matricule?: string;
}

/* ─── Palette Dr. Oetker Vanoise ─────────────────────────────── */
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

const Divider = ({ label }: { label: string }) => (
  <View style={div.row}>
    <Text style={div.txt}>{label}</Text>
    <View style={div.line} />
  </View>
);

export default function ProductionDeclarationScreen() {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [nom, setNom] = useState<string>("");
  const [matricule, setMatricule] = useState<string>("MTR-2026");
const [dernierePaletteLignes, setDernierePaletteLignes] = useState<ProductionLine[]>([]);
  const [activeTab, setActiveTab] = useState<"declaration" | "historique">("declaration");
  const [historiquePalettes, setHistoriquePalettes] = useState<any[]>([]);
  const [loadingHist, setLoadingHist] = useState<boolean>(false);

  // États pour la logique de Production & Recherche d'OF
  const [ordresFabrication, setOrdresFabrication] = useState<ArticleOF[]>([]);
  const [searchText, setSearchText] = useState<string>("");
  const [selectedOF, setSelectedOF] = useState<string>("");
  const [selectedOFData, setSelectedOFData] = useState<ArticleOF | null>(null); // ← AJOUT
  const [showDropdown, setShowDropdown] = useState<boolean>(false);

  const [lignesProduction, setLignesProduction] = useState<ProductionLine[]>([]);
  const [paletteGeneree, setPaletteGeneree] = useState<string | null>(null);

  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ── Logic Pagination & Recherche Améliorée ──
  const [page, setPage] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [hasMore, setHasMore] = useState<boolean>(true);

  useEffect(() => {
    if (loading && ordresFabrication.length === 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 800, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [loading, ordresFabrication]);

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

  const handleLogout = async () => {
    closeSidebar();
    await AsyncStorage.clear();
    router.replace("/login");
  };

  const fetchHistorique = async (pageNum = 1, currentSearch = "") => {
    try {
      setLoadingHist(true);
      const res = await fetch(
        `${API_URL}/api/production/historique?page=${pageNum}&search=${encodeURIComponent(currentSearch)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setHasMore(data.length >= 5);
        setHistoriquePalettes(data);
      }
    } catch (e) {
      console.error("Erreur historique:", e);
    } finally {
      setLoadingHist(false);
    }
  };

  useEffect(() => {
    if (activeTab === "historique") {
      setPage(1);
      const delayDebounce = setTimeout(() => {
        fetchHistorique(1, searchTerm);
      }, 300);
      return () => clearTimeout(delayDebounce);
    }
  }, [searchTerm, activeTab]);

  const handleNextPage = () => {
    if (loadingHist || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchHistorique(nextPage, searchTerm);
  };

  const handlePrevPage = () => {
    if (loadingHist || page <= 1) return;
    const prevPage = page - 1;
    setPage(prevPage);
    fetchHistorique(prevPage, searchTerm);
  };

  useEffect(() => {
    const loadUser = async () => {
      const raw = await AsyncStorage.getItem("user");
      if (!raw) { router.replace("/login"); return; }
      const parsedUser: UserData = JSON.parse(raw);
      setNom(parsedUser.nom || "Opérateur");
      if (parsedUser.matricule) setMatricule(parsedUser.matricule);
    };
    loadUser();
  }, []);

  useEffect(() => {
    const fetchOFs = async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/production/of?search=${encodeURIComponent(searchText)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setOrdresFabrication(data);
        }
      } catch (e) {
        console.error("Erreur réseau OF:", e);
      } finally {
        setLoading(false);
      }
    };
    const delayDebounce = setTimeout(() => { fetchOFs(); }, 300);
    return () => clearTimeout(delayDebounce);
  }, [searchText]);

  const ajouterLigne = () => {
    setPaletteGeneree(null);
    const nouvelleLigne: ProductionLine = {
      id: Math.random().toString(),
      lot: "",
      slot: "",
      quantite: "",
    };
    setLignesProduction([...lignesProduction, nouvelleLigne]);
  };

  const updateLigne = (id: string, champ: keyof ProductionLine, valeur: string) => {
    setLignesProduction(lignesProduction.map((ligne) =>
      ligne.id === id ? { ...ligne, [champ]: valeur } : { ...ligne }
    ));
  };

  const supprimerLigne = (id: string) => {
    setLignesProduction(lignesProduction.filter((l) => l.id !== id));
  };
const validerDeclaration = async () => {
    if (!selectedOF) {
      Alert.alert("Erreur", "Veuillez sélectionner un Ordre de Fabrication (OF).");
      return;
    }
    if (lignesProduction.length === 0) {
      Alert.alert("Erreur", "Veuillez ajouter au moins une ligne à la palette.");
      return;
    }
    if (!lignesProduction.every((l) => l.lot && l.slot && l.quantite)) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs (LOT, SLOT, Quantité).");
      return;
    }

    try {
      setLoading(true);
      const listBackend = lignesProduction.map((l) => ({
        slot: l.slot,
        qty: l.quantite,
        lot: l.lot,
        ZUOM: "CAR",
      }));

      const response = await fetch(`${API_URL}/api/production/declarer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ of: selectedOF, list: listBackend, matricule }),
      });

      const jsonResult = await response.json();

      if (response.ok && jsonResult.status === "success") {
        // 1. On stocke le numéro généré APART
        setPaletteGeneree(jsonResult.PALNUM);
        setDernierePaletteLignes(lignesProduction);
        Alert.alert("Succès", `Déclaration enregistrée ! Palette ${jsonResult.PALNUM} créée.`);
        
        // 2. On vide l'interface de saisie pour la palette suivante
        setLignesProduction([]);
        
        // REMARQUE : Ne vide PAS `selectedOF` ni `searchText` ici 
        // pour que la carte d'impression en bas puisse toujours afficher les infos de l'OF !
        
      } else {
        Alert.alert("Erreur Serveur", jsonResult.error || "Une erreur est survenue.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Erreur", "Impossible de contacter le serveur backend.");
    } finally {
      setLoading(false);
    }
  };
const imprimerPalette = async () => {
  if (!paletteGeneree) {
    Alert.alert("Erreur", "Aucune palette n'a été générée pour l'impression.");
    return;
  }

  const zpl = generateZplLabel({
    palette: paletteGeneree,
    of: selectedOF,
    designation: selectedOFData?.ZITMDES || selectedOF,
    matricule: matricule,
    lignes: dernierePaletteLignes, // ✅ Utilise la sauvegarde
    zpcu: selectedOFData?.ZPCU || "", // ✅ Nouvelle donnée
    zpcustucoe: selectedOFData?.ZPCUSTUCOE ? String(selectedOFData.ZPCUSTUCOE) : "", // ✅ Nouvelle donnée
    zshl: selectedOFData?.ZSHL ? String(selectedOFData.ZSHL) : "", // ✅ Nouvelle donnée
  });

  const succes = await sendToPrinter(zpl);

  if (succes) {
    Alert.alert("Succès", "Étiquette envoyée à l'imprimante ✅");
  } else {
    Alert.alert(
      "Échec d'impression",
      "Impossible de joindre l'imprimante.\nVérifie l'adresse IP dans les paramètres."
    );
  }
};

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
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
          <Text style={s.topbarTitle}>
            {activeTab === "declaration" ? "DÉCLARATION PRODUCTION" : "HISTORIQUE DES PALETTES"}
          </Text>
          <Text style={s.topbarSubTitle}>Dr. Oetker · Vanoise App</Text>
        </View>
        <View style={s.logoWrap}>
          <Image source={require("../../assets/favicon.png")} style={s.logo} resizeMode="contain" />
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
            {/* ════ DÉCLARATION ════ */}
            {activeTab === "declaration" && (
              <View>
                <View style={s.dateChip}>
                  <Text style={s.dateTxt}>{today}</Text>
                </View>

                <Divider label="ORDRE DE FABRICATION" />
                <View style={s.pickerCard}>
                  <Text style={s.inputLabel}>Rechercher et Sélectionner l'OF</Text>
                  <TextInput
                    style={s.input}
                    placeholder="Tapez pour filtrer (Ex: C...)"
                    value={selectedOF ? searchText : searchText}
                    onChangeText={(txt) => {
                      setSearchText(txt);
                      setSelectedOF("");
                      setSelectedOFData(null); // ← reset
                      setPaletteGeneree(null); // ← AJOUT : Efface l'ancienne palette imprimée dès qu'on change d'OF
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                  />

                  {showDropdown && ordresFabrication.length > 0 && (
                    <View style={s.dropdownContainer}>
                      <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 150 }}>
                        {ordresFabrication.map((of, idx) => (
                          <TouchableOpacity
                            key={idx}
                            style={s.dropdownItem}
                            onPress={() => {
                              setSelectedOF(of.ZITMREF);
                              setSelectedOFData(of); // ← AJOUT : stocke l'objet complet
                              setSearchText(`${of.ZITMREF} - ${of.ZITMDES}`);
                              setShowDropdown(false);
                            }}
                          >
                            <Text style={s.dropdownItemTxt}>
                              {of.ZITMREF} —{" "}
                              <Text style={{ color: C.inkLight }}>{of.ZITMDES}</Text>
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={s.tableHeaderRow}>
                  <Text style={s.sectionTitle}>Composition Palette</Text>
                  <TouchableOpacity style={s.addButton} onPress={ajouterLigne}>
                    <Text style={s.addButtonText}>+ Ajouter un lot</Text>
                  </TouchableOpacity>
                </View>

                {lignesProduction.length === 0 ? (
                  <Text style={s.emptyText}>
                    Aucun lot saisi. Cliquez sur + Ajouter pour configurer la palette.
                  </Text>
                ) : (
                  lignesProduction.map((ligne, index) => (
                    <View key={ligne.id} style={s.ligneCard}>
                      <Text style={s.ligneIndex}>Sous-lot #{index + 1}</Text>
                      <View style={s.formGrid}>
                        <View style={s.inputBox}>
                          <Text style={s.fieldLabel}>LOT</Text>
                          <TextInput
                            style={s.input}
                            placeholder="L2606"
                            value={ligne.lot}
                            onChangeText={(txt) => updateLigne(ligne.id, "lot", txt)}
                          />
                        </View>
                        <View style={s.inputBox}>
                          <Text style={s.fieldLabel}>SLOT</Text>
                          <TextInput
                            style={s.input}
                            placeholder="A-12"
                            value={ligne.slot}
                            onChangeText={(txt) => updateLigne(ligne.id, "slot", txt)}
                          />
                        </View>
                        <View style={s.inputBox}>
                          <Text style={s.fieldLabel}>QTY</Text>
                          <TextInput
                            style={s.input}
                            placeholder="Unités"
                            keyboardType="numeric"
                            value={ligne.quantite}
                            onChangeText={(txt) => updateLigne(ligne.id, "quantite", txt)}
                          />
                        </View>
                      </View>
                      <TouchableOpacity style={s.deleteBtn} onPress={() => supprimerLigne(ligne.id)}>
                        <Text style={s.deleteBtnTxt}>Supprimer la ligne</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}

                <View style={{ marginTop: 20 }}>
                  <TouchableOpacity style={s.validerBtn} onPress={validerDeclaration}>
                    <Text style={s.validerBtnTxt}>Enregistrer la Palette</Text>
                  </TouchableOpacity>
                </View>

                {paletteGeneree && (
                  <View style={s.paletteCard}>
                    <Text style={s.paletteLabel}>📦 NUMÉRO DE PALETTE UNIQUE GÉNÉRÉ :</Text>
                    <Text style={s.paletteCode}>{paletteGeneree}</Text>
                    <Text style={s.paletteSub}>Lié à l'OF : {selectedOF}</Text>
                    <TouchableOpacity style={s.printBtn} onPress={imprimerPalette}>
                      <Text style={s.printBtnTxt}>🖨️ Imprimer l'étiquette</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* ════ HISTORIQUE ════ */}
            {activeTab === "historique" && (
              <View style={{ paddingBottom: 30 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
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
                    <TouchableOpacity onPress={() => setSearchTerm("")} style={s.clearSearchContainer}>
                      <Text style={s.clearSearchText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {loadingHist ? (
                  <View style={{ marginVertical: 40 }}>
                    <ActivityIndicator size="small" color={C.red} />
                  </View>
                ) : historiquePalettes.length === 0 ? (
                  <Text style={s.emptyText}>Aucune palette trouvée dans l'historique.</Text>
                ) : (
                  <>
           {historiquePalettes.map((pal, idx) => (
  <View key={idx} style={s.histCard}>
    {/* En-tête de la palette unique */}
    <View style={s.histCardHeader}>
      <Text style={s.histPalNum}>{pal.palette || "N/A"}</Text>
      <Text style={s.histDate}>
        {pal.date_production
          ? new Date(pal.date_production).toLocaleDateString("fr-FR", {
              day: "2-digit", month: "2-digit", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })
          : ""}
      </Text>
    </View>

    <View style={{ marginTop: 8 }}>
      <Text style={[s.histInfo, { marginBottom: 6 }]}>
        📦 Article : <Text style={{ fontWeight: "700" }}>{pal.article || "Inconnu"}</Text>
      </Text>
      
      
      <Text style={[s.histInfo, { fontWeight: "700", color: C.inkMid, fontSize: 13, marginBottom: 4 }]}>
        📋 Composition de la palette :
      </Text>

      {/* Boucle interne pour afficher tous les slots/lots de cette même palette */}
      {pal.slots && pal.slots.length > 0 ? (
        pal.slots.map((subLot: any, subIdx: number) => (
          <View 
            key={subIdx} 
            style={{ 
              backgroundColor: C.surface, 
              padding: 8, 
              borderRadius: 6, 
              marginTop: 4,
              borderLeftWidth: 3,
              borderLeftColor: C.red
            }}
          >
            <Text style={{ fontSize: 12, color: C.inkLight, fontWeight: "600" }}>
              Sous-lot #{subIdx + 1}
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
              <Text style={s.histInfo}>
                🏷️ Lot : <Text style={{ fontWeight: "700", color: C.red }}>{subLot.lot}</Text>
              </Text>
              <Text style={s.histInfo}>📍 Slot : <Text style={{ fontWeight: "600" }}>{subLot.slot}</Text></Text>
              <Text style={s.histInfo}>⚖️ Qty : <Text style={{ fontWeight: "600" }}>{subLot.qty}</Text></Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={s.histInfo}>Aucun lot associé</Text>
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
                        <Text style={[s.pagBtnTxt, page === 1 && s.pagBtnTxtDisabled]}>◀ Précédent</Text>
                      </TouchableOpacity>
                      <View style={s.pageBadge}>
                        <Text style={s.pageBadgeTxt}>Page {page}</Text>
                      </View>
                      <TouchableOpacity
                        style={[s.pagBtn, !hasMore && s.pagBtnDisabled]}
                        onPress={handleNextPage}
                        disabled={!hasMore || loadingHist}
                      >
                        <Text style={[s.pagBtnTxt, !hasMore && s.pagBtnTxtDisabled]}>Suivant ▶</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* ── Footer ── */}
            <View style={s.footer}>
              <View style={s.footerDivider} />
              <Text style={s.copyright}>
                © 2026{" "}
                <Text style={s.copyrightLink} onPress={() => Linking.openURL("https://vanoiserie.tn/")}>
                  Dr. Oetker Vanoise
                </Text>
                {" "}Tous droits réservés.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Sidebar overlay ── */}
      {sidebarOpen && (
        <Animated.View style={[s.overlay, { opacity: overlayAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeSidebar} />
        </Animated.View>
      )}

      {/* ── Sidebar ── */}
      <Animated.View style={[s.sidebar, { transform: [{ translateX: slideAnim }] }]}>
        <View style={sb.stripe} />
        <View style={sb.logoBlock}>
          <Image source={require("../../assets/favicon.png")} style={sb.logoImg} resizeMode="contain" />
          <Text style={sb.brand}>DR. OETKER</Text>
          <Text style={sb.brandSub}>VANOISE PORTAL</Text>
        </View>
        <View style={sb.header}>
          <View style={sb.avatarLg}>
            <Text style={sb.avatarLgTxt}>{nom ? nom[0].toUpperCase() : "O"}</Text>
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
            onPress={() => { setActiveTab("declaration"); closeSidebar(); }}
          >
            <Text style={sb.itemIcon}>📦</Text>
            <Text style={[sb.itemLabel, activeTab === "declaration" && sb.itemLabelActive]}>
              Déclaration Prod.
            </Text>
            {activeTab === "declaration" && <View style={sb.pip} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[sb.item, activeTab === "historique" && sb.itemActive]}
            onPress={() => { setActiveTab("historique"); closeSidebar(); }}
          >
            <Text style={sb.itemIcon}>📜</Text>
            <Text style={[sb.itemLabel, activeTab === "historique" && sb.itemLabelActive]}>
              Historique
            </Text>
            {activeTab === "historique" && <View style={sb.pip} />}
          </TouchableOpacity>
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

  /* 🔄 STYLE UNIQUE POUR LE CHARGEMENT PAR LOGO PULSANT */
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
    marginBottom: 20,
  },
  dateTxt: { fontSize: 11, color: C.inkLight, fontWeight: "600" },

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

  /* 🔍 BARRE DE RECHERCHE */
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

  /* ⚙️ PAGINATION STRICTE */
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

  // Styles Historique
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
