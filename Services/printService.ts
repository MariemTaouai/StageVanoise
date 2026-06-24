import AsyncStorage from "@react-native-async-storage/async-storage";

export interface LigneProduction {
  slot: string;
  qty: string | number;
  
  LOT: string; // <-- Ici
  zuom?: string;
}

export interface ZplData {
  palette: string;
  of: string;
  numof?: string;
  designation: string;
  designation2?: string;
  matricule: string;
  quantiteLancee: string;
  lignes: LigneProduction[];
}

/**
 * Fonction ultra-simplifiée pour ne laisser passer que les caractères 
 * autorisés par l'imprimante Zebra (A-Z, 0-9, espaces, ponctuations simples).
 */
const cleanZpl = (str: string | number | undefined | null): string => {
  if (!str) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Supprime les accents
    .replace(/[^a-zA-Z0-9 :./-]/g, " ") // Remplace tout caractère suspect par un espace
    .replace(/\s+/g, " ") // Évite les doubles espaces
    .trim();
};
export const generateZplLabel = (data: ZplData): string => {
  const { palette, of: ofRef, numof, designation, quantiteLancee, lignes } = data;
  
  const now = new Date();
  const dateProd = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  
  const clean = (str: any) => String(str || "").replace(/[^a-zA-Z0-9 :./-]/g, " ").trim();
  const lotValue = (lignes && lignes.length > 0) 
    ? clean(lignes[0].LOT  || "N/A") 
    : "N/A";

  return (
    "^XA^CI28^PW831" +
    
    // 1. EN-TÊTE : TABLEAU 3 COLONNES
    "^FO20,20^GB790,130,3^FS" + 
    "^FO20,20^GB200,130,3^FS" +  
    "^FO220,20^GB400,130,3^FS" + 
    "^FO620,20^GB190,130,3^FS" + 
    
    // Logo : Décalé à X=25
    "^FO25,35^GFA,1932,1932,28,,:::::P07gNFD,N03gSFE,N03gQF4,,:K03LFCN07gNFE,S01LF,R03NF8,M01FF83PF03gGF,M03FC1QFE0gHF,P07RFC,O03TF,O0UFC,N01VF,N07VF8,N0LF8J07KFC,N0JFO01IFE,M01FFCR0FFE,M03FCT0FFJ03FF81F800FFI01FF,M03FU03FJ0JF1F801FFI07FFC,M03EU01FI03JF1F801FF800IFE,M03C3EI0F8I02K0F8007JF1F803FF801IFE,M03C3F801FC0063K0F800FF83F1F803FF801IFC,M03C338019C0063K07800FE0031F803FFC03F83C,M03C31DF38E7CFB3BE3E7801FCI01F807EFC03F008,M03C31DF38IEF3J7C7801F8I01F807EFE03F8,M03C31DC38EC663E63387801F8I01F807E7E03FF,M03C31D838EFF63C7FB07803FJ01F80FC7E01IF,M03C31D838EFF63E7FB07803F00FF1F80FC7F01IFC,M03C31D838EC063E60707803F01FF1F81F83F007FFE,M03C31D838EC663763307803F01FF1F81F83F801IF,M03C3F9B1DCE67337330F801F81FF1F81F8FF8003FF,M03C3F1B1F87E7B3BF70F801F803F1F83F1DFCI07F,M03EK02018J0801F001FC01F1F83F78FC0C03F,M03FU01FI0FF03F1F87FE0FC1E03F,M03F8L07CL03FI07JF1F87FC0FE3JF,M01FCK07DFCK07FI03JF1F87F807E7JF,M01FEJ03F07FJ01FEI01JF1F8FF007F3IFE,N0FF8I07F01F8I03FEJ0IFC1F8FE003F0IFC,N0FFEI0FF01FCI0FFCJ01FE01F8FC003F03FF,N07FF801FE01FE007FF8,N03IF01FE00FE03IF,N01JF1FF01FE3IFE,O0JFDFF07FEJFC,O07IFDFF87FEJF8,O01IFDFF87FEIFE,P0IFDFF01FEIFC,P03FFEFC00FDIF,P01IF78007BFFE,Q07FF9IFE7FF8,Q01FFCIFDFFC,R03FF8007FF,S07FFEIF,T03JF,,::::::::^FS" +
    
    // Titres colonne 2
    "^FO220,40^A0,30,30^FB400,1,0,C^FDFiche d identification Palette^FS" +
    "^FO220,85^A0,30,30^FB400,1,0,C^FDProduit Fini^FS" +

    // 2. CORPS
    "^FO30,190^A0,40,40^FDBT N : ^FS" +
    "^FO30,230^BY4,3,100^BCN,100,Y,N,N^FD" + clean(palette) + "^FS" +
    "^FO30,380^A0,60,60^FB770,1,0,C^FD" + clean(palette) + "^FS" +
    "^FO30,450^A0,50,50^FB770,1,0,C^FD" + clean(ofRef) + "^FS" +
    "^FO30,520^A0,45,45^FB770,1,0,C^FD" + clean(designation) + "^FS" +
    "^FO30,570^GB770,4,4^FS" +
    
    "^FO30,610^A0,40,40^FDN de l OF :^FS" + "^FO350,610^A0,40,40^FD" + clean(numof || ofRef) + "^FS" +
    "^FO30,680^A0,40,40^FDQuantite lancee :^FS" + "^FO350,680^A0,40,40^FD" + clean(quantiteLancee) + " CAR^FS" +
    "^FO30,750^A0,40,40^FDD.P. :^FS" + "^FO350,750^A0,40,40^FD" + dateProd + "^FS" +
    "^FO30,800^GB770,4,4^FS" +
    
    "^FO30,830^A0,45,45^FDLot n :^FS" + "^FO350,830^A0,45,45^FD" + lotValue + "^FS" +
    "^FO30,880^GB770,4,4^FS" +
    
    // 3. MATRICE
    lignes.slice(0, 4).map((item, idx) => {
      const y = 920 + (idx * 150);
      return (
        `^FO30,${y}^A0,45,45^FDSous Lot :^FS` +
        `^FO350,${y}^A0,45,45^FD${item.slot}^FS` +
        `^FO30,${y + 50}^A0,45,45^FDQte US :^FS` +
        `^FO350,${y + 50}^A0,45,45^FD${item.qty}^FS` +
        `^FO600,${y + 50}^A0,45,45^FD CAR^FS` +
        `^FO30,${y + 110}^GB770,1,1^FS`
      );
    }).join("") +
    
    "^XZ"
  );
};
export const sendToPrinter = async (zplCode: string): Promise<boolean> => {
  try {
    if (!zplCode) return false;

    const storedIp = await AsyncStorage.getItem("printer_ip") || "172.16.11.229:6101";
    // Note: Si vous utilisez le port 6101, le protocole n'est PAS http, 
    // mais le fetch peut échouer. Assurez-vous que l'imprimante est bien configurée.
    const printerUrl = `http://${storedIp}`;

    const response = await fetch(printerUrl, {
      method: "POST",
      body: zplCode,
    });

    return response.ok;
  } catch (error) {
    console.error("❌ Erreur impression:", error);
    return false;
  }
};