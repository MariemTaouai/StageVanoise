// Services/printService.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

export interface LigneProduction {
  slot: string;
  qty: string | number;
  LOT: string;
  zuom?: string;
  qteUVC?: number;
}

export interface ZplData {
  type: "P" | "S";
  palette: string;
  of: string;
  numof?: string;
  designation: string;
  designation2?: string;
  matricule: string;
  quantiteLancee: string;
  quantiteLanceeUVC?: number;
  lignes: LigneProduction[];
  dateExp?: string | null;
}

// ─── NETTOYAGE ──────────────────────────────────────────────────────────────
const cleanZpl = (str: string | number | undefined | null): string => {
  if (!str) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 :./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const clean = cleanZpl;
const fmt2 = (n: number) => n.toFixed(2);

// ─── FORMATER LA DATE ──────────────────────────────────────────────────────
const formatDateForLabel = (date: string | null | undefined): string => {
  if (date) {
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    }
  }
  const now = new Date();
  return `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
};

// ─── GÉNÉRATION ZPL ────────────────────────────────────────────────────────
export const generateZplLabel = (data: ZplData): string => {
  const {
    type,
    palette,
    of: ofRef,
    numof,
    designation,
    quantiteLancee,
    quantiteLanceeUVC,
    lignes,
    dateExp,
  } = data;

  const dateProd = formatDateForLabel(dateExp);

  const lotValue = lignes.length > 0 ? clean(lignes[0].LOT || "N/A") : "N/A";

  const totalQty = lignes.reduce(
    (acc, it) =>
      acc + (typeof it.qty === "number" ? it.qty : Number(it.qty || 0)),
    0,
  );

  const totalUVC =
    type === "S"
      ? lignes.reduce(
          (acc, it) =>
            acc +
            (typeof it.qteUVC === "number"
              ? it.qteUVC
              : Number(it.qteUVC || 0)),
          0,
        )
      : 0;

  const labelTitre =
    type === "P"
      ? "🏷️ IDENTIFICATION PRESTATAIRE"
      : "📦 FICHE IDENTIFICATION PALETTE";

  const labelMode = type === "P" ? "PRESTATAIRE" : "SALARIÉ";
  const labelQte = type === "P" ? "Qté" : "Qté (UVC)";

  const yDate = type === "S" ? 780 : 750;
  const yRule2 = type === "S" ? 830 : 800;
  const yLot = type === "S" ? 860 : 830;
  const yRule3 = type === "S" ? 910 : 880;
  const yStart = type === "S" ? 950 : 920;
  const nbLignes = Math.min(lignes.length, 4);
  const yTotal = yStart + nbLignes * 150 + 20;
  const yTotalUVC = yTotal + 60;

  return (
    "^XA^CI28^PW831" +
    "^FO20,20^GB790,130,3^FS" +
    "^FO20,20^GB200,130,3^FS" +
    "^FO220,20^GB400,130,3^FS" +
    "^FO620,20^GB190,130,3^FS" +
    "^FO25,35^GFA,1932,1932,28,,:::::P07gNFD,N03gSFE,N03gQF4,,:K03LFCN07gNFE,S01LF,R03NF8,M01FF83PF03gGF,M03FC1QFE0gHF,P07RFC,O03TF,O0UFC,N01VF,N07VF8,N0LF8J07KFC,N0JFO01IFE,M01FFCR0FFE,M03FCT0FFJ03FF81F800FFI01FF,M03FU03FJ0JF1F801FFI07FFC,M03EU01FI03JF1F801FF800IFE,M03C3EI0F8I02K0F8007JF1F803FF801IFE,M03C3F801FC0063K0F800FF83F1F803FFC03F83C,M03C338019C0063K07800FE0031F803FFC03F83C,M03C31DF38E7CFB3BE3E7801FCI01F807EFC03F008,M03C31DF38IEF3J7C7801F8I01F807EFE03F8,M03C31DC38EC663E63387801F8I01F807E7E03FF,M03C31D838EFF63C7FB07803FJ01F80FC7E01IF,M03C31D838EFF63E7FB07803F00FF1F80FC7F01IFC,M03C31D838EC063E60707803F01FF1F81F83F007FFE,M03C31D838EC663763307803F01FF1F81F83F801IF,M03C3F9B1DCE67337330F801F81FF1F81F8FF8003FF,M03C3F1B1F87E7B3BF70F801F803F1F83F1DFCI07F,M03EK02018J0801F001FC01F1F83F78FC0C03F,M03FU01FI0FF03F1F87FE0FC1E03F,M03F8L07CL03FI07JF1F87FC0FE3JF,M01FCK07DFCK07FI03JF1F87F807E7JF,M01FEJ03F07FJ01FEI01JF1F8FF007F3IFE,N0FF8I07F01F8I03FEJ0IFC1F8FE003F0IFC,N0FFEI0FF01FCI0FFCJ01FE01F8FC003F03FF,N07FF801FE01FE007FF8,N03IF01FE00FE03IF,N01JF1FF01FE3IFE,O0JFDFF07FEJFC,O07IFDFF87FEJF8,O01IFDFF87FEIFE,P0IFDFF01FEIFC,P03FFEFC00FDIF,P01IF78007BFFE,Q07FF9IFE7FF8,Q01FFCIFDFFC,R03FF8007FF,S07FFEIF,T03JF,,::::::::^FS" +
    "^FO220,40^A0,30,30^FB400,1,0,C^FD" +
    labelTitre +
    "^FS" +
    "^FO220,85^A0,30,30^FB400,1,0,C^FDProduit Fini^FS" +
    "^FO630,45^A0,25,25^FB170,1,0,C^FD" +
    labelMode +
    "^FS" +
    "^FO30,190^A0,40,40^FDBT N : ^FS" +
    "^FO30,230^BY4,3,100^BCN,100,Y,N,N^FD" +
    clean(palette) +
    "^FS" +
    "^FO30,380^A0,60,60^FB770,1,0,C^FD" +
    clean(palette) +
    "^FS" +
    "^FO30,450^A0,50,50^FB770,1,0,C^FD" +
    clean(ofRef) +
    "^FS" +
    "^FO30,520^A0,45,45^FB770,1,0,C^FD" +
    clean(designation) +
    "^FS" +
    "^FO30,570^GB770,4,4^FS" +
    "^FO30,610^A0,40,40^FDN° OF :^FS" +
    "^FO350,610^A0,40,40^FD" +
    clean(numof || ofRef) +
    "^FS" +
    "^FO30,670^A0,40,40^FDQte lancée :^FS" +
    "^FO350,670^A0,40,40^FD" +
    clean(quantiteLancee) +
    " CAR^FS" +
    (type === "S" &&
    quantiteLanceeUVC !== undefined &&
    quantiteLanceeUVC !== null
      ? "^FO30,720^A0,40,40^FDQte lancée UVC :^FS" +
        "^FO350,720^A0,40,40^FD" +
        clean(fmt2(quantiteLanceeUVC)) +
        " CAR^FS"
      : "") +
    `^FO30,${yDate}^A0,40,40^FDD.P. :^FS` +
    `^FO350,${yDate}^A0,40,40^FD` +
    dateProd +
    "^FS" +
    `^FO30,${yRule2}^GB770,4,4^FS` +
    `^FO30,${yLot}^A0,45,45^FDLot n° :^FS` +
    `^FO350,${yLot}^A0,45,45^FD` +
    lotValue +
    "^FS" +
    `^FO30,${yRule3}^GB770,4,4^FS` +
    lignes
      .slice(0, 4)
      .map((item, idx) => {
        const y = yStart + idx * 150;
        const qtyBrute =
          typeof item.qty === "number" ? item.qty : Number(item.qty || 0);

        const displayQty =
          type === "S" && item.qteUVC !== undefined && item.qteUVC !== null
            ? `${qtyBrute} (UVC: ${fmt2(item.qteUVC)})`
            : clean(String(qtyBrute));

        return (
          `^FO30,${y}^A0,45,45^FDSous-Lot ${idx + 1} :^FS` +
          `^FO350,${y}^A0,45,45^FD${clean(item.slot || "N/A")}^FS` +
          `^FO30,${y + 50}^A0,45,45^FD${labelQte} :^FS` +
          `^FO350,${y + 50}^A0,45,45^FD${displayQty}^FS` +
          `^FO600,${y + 50}^A0,45,45^FD CAR^FS` +
          `^FO30,${y + 110}^GB770,1,1^FS`
        );
      })
      .join("") +
    `^FO30,${yTotal}^GB770,4,4^FS` +
    `^FO30,${yTotal + 20}^A0,50,50^FDTotal Qté :^FS` +
    `^FO350,${yTotal + 20}^A0,50,50^FD${clean(fmt2(totalQty))} CAR^FS` +
    (type === "S" && totalUVC > 0
      ? `^FO30,${yTotalUVC}^GB770,4,4^FS` +
        `^FO30,${yTotalUVC + 20}^A0,50,50^FDTotal UVC :^FS` +
        `^FO350,${yTotalUVC + 20}^A0,50,50^FD${clean(fmt2(totalUVC))} CAR^FS`
      : "") +
    "^XZ"
  );
};

// ─── HTML POUR PDF ──────────────────────────────────────────────────────────
const buildLabelHtml = (data: ZplData): string => {
  const {
    type,
    palette,
    of: ofRef,
    numof,
    designation,
    quantiteLancee,
    quantiteLanceeUVC,
    lignes,
    dateExp,
  } = data;

  let dateDisplay = "Non renseignée";
  if (dateExp) {
    const d = new Date(dateExp);
    if (!isNaN(d.getTime())) {
      dateDisplay = d.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }

  const hasLignes = lignes && lignes.length > 0;

  const totalQty = hasLignes
    ? lignes.reduce(
        (acc, it) =>
          acc + (typeof it.qty === "number" ? it.qty : Number(it.qty || 0)),
        0,
      )
    : 0;

  const totalUVC =
    type === "S" && hasLignes
      ? lignes.reduce(
          (acc, it) =>
            acc +
            (typeof it.qteUVC === "number"
              ? it.qteUVC
              : Number(it.qteUVC || 0)),
          0,
        )
      : 0;

  const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(clean(palette))}&code=Code128&translate-esc=on`;

  const rows = hasLignes
    ? lignes
        .slice(0, 4)
        .map((item, idx) => {
          const qtyBrute =
            typeof item.qty === "number" ? item.qty : Number(item.qty || 0);
          const displayQty =
            type === "S" && item.qteUVC !== undefined && item.qteUVC !== null
              ? `${qtyBrute} (UVC: ${fmt2(item.qteUVC)})`
              : String(qtyBrute);

          return `<tr>
            <td style="padding:8px;border:1px solid #333;text-align:center;">Sous-lot ${idx + 1}</td>
            <td style="padding:8px;border:1px solid #333;text-align:center;">${clean(item.slot || "N/A")}</td>
            <td style="padding:8px;border:1px solid #333;text-align:center;">${displayQty}</td>
            <td style="padding:8px;border:1px solid #333;text-align:center;">${clean(item.zuom || "CAR")}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="4" style="padding:20px;text-align:center;color:#999;font-style:italic;">Aucun sous-lot enregistré</td></tr>`;

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h1 { font-size: 22px; color: #C0202A; margin: 0; }
          .header .subtitle { font-size: 14px; color: #666; margin: 5px 0; }
          .barcode { text-align: center; margin: 15px 0; }
          .barcode img { width: 250px; }
          .info { margin: 15px 0; padding: 15px; background: #f9f9f9; border-radius: 8px; }
          .info p { margin: 5px 0; font-size: 14px; }
          .info strong { color: #333; }
          .table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .table th { background: #C0202A; color: white; padding: 10px; text-align: center; }
          .table td { padding: 8px; border: 1px solid #ddd; text-align: center; }
          .total { margin-top: 20px; padding: 15px; background: #e8f5e9; border-radius: 8px; border-left: 4px solid #2E7D32; }
          .total p { margin: 5px 0; font-weight: bold; font-size: 14px; }
          .total-uvc { margin-top: 10px; padding: 15px; background: #e3f2fd; border-radius: 8px; border-left: 4px solid #1565C0; }
          .total-uvc p { margin: 5px 0; font-weight: bold; font-size: 14px; color: #1565C0; }
          .badge { display: inline-block; padding: 3px 12px; border-radius: 12px; color: white; font-size: 12px; }
          .badge-p { background: #2E7D32; }
          .badge-s { background: #2563EB; }
          .footer { margin-top: 20px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #ddd; padding-top: 10px; }
          .label { font-weight: 600; color: #333; }
          .value { font-weight: 700; }
          .value-red { color: #C0202A; }
          .value-green { color: #2E7D32; }
          .value-blue { color: #1565C0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${type === "P" ? "🏷️ IDENTIFICATION PRESTATAIRE" : "📦 FICHE IDENTIFICATION PALETTE"}</h1>
          <p class="subtitle">
            <span class="badge ${type === "P" ? "badge-p" : "badge-s"}">
              ${type === "P" ? "PRESTATAIRE" : "SALARIÉ"}
            </span>
          </p>
        </div>

        <div class="barcode">
          <img src="${barcodeUrl}" alt="Code barres" />
        </div>

        <div class="info">
          <p><span class="label">🔖 Code / Palette :</span> <span class="value value-red">${clean(palette)}</span></p>
          <p><span class="label">🏭 OF :</span> <span class="value">${clean(ofRef)}</span></p>
          <p><span class="label">📋 Num OF :</span> <span class="value">${clean(numof || ofRef)}</span></p>
          <p><span class="label">📦 Désignation :</span> <span class="value">${clean(designation)}</span></p>
          <p><span class="label">📊 Quantité lancée :</span> <span class="value value-green">${clean(quantiteLancee)} CAR</span></p>
          ${
            type === "S" &&
            quantiteLanceeUVC !== undefined &&
            quantiteLanceeUVC !== null
              ? `<p><span class="label">📊 Quantité lancée UVC :</span> <span class="value value-blue">${fmt2(quantiteLanceeUVC)} CAR</span></p>`
              : ""
          }
          <p><span class="label">📅 Date expédition :</span> <span class="value value-red">${dateDisplay}</span></p>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>📍 Sous-lot</th>
              <th>🏷️ Slot</th>
              <th>${type === "S" ? "📊 Qté (UVC)" : "📊 Qté"}</th>
              <th>📦 Unité</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="total">
          <p>📊 Total quantité : <span class="value value-green">${fmt2(totalQty)} CAR</span></p>
        </div>
        
        ${
          type === "S" && totalUVC > 0
            ? `
        <div class="total-uvc">
          <p>📊 Total UVC : <span class="value value-blue">${fmt2(totalUVC)} CAR</span></p>
        </div>
        `
            : ""
        }

        <div class="footer">
          <p>© 2026 Dr. Oetker Vanoise - Document généré automatiquement</p>
          <p>🕐 Généré le : ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
        </div>
      </body>
    </html>
  `;
};

// ─── EXPORT PDF ──────────────────────────────────────────────────────────────
// ─── EXPORT PDF ──────────────────────────────────────────────────────────────
export const downloadLabelPdf = async (data: ZplData): Promise<boolean> => {
  try {
    console.log("📄 [PDF] Début du téléchargement...");
    console.log("📄 [PDF] Données reçues:", {
      type: data.type,
      palette: data.palette,
      designation: data.designation,
      nbLignes: data.lignes?.length || 0,
      dateExp: data.dateExp,
      lignes: data.lignes,
    });

    // ✅ Vérification des données obligatoires
    if (!data.palette || data.palette === "N/A") {
      console.warn("⚠️ [PDF] Palette non définie");
    }

    if (!data.lignes || data.lignes.length === 0) {
      console.warn("⚠️ [PDF] Aucune ligne de production trouvée !");
      // ✅ On continue quand même, le PDF affichera "Aucun sous-lot"
    }

    const html = buildLabelHtml(data);
    console.log("📄 [PDF] HTML généré, longueur:", html.length);

    // ✅ Vérifier que le HTML n'est pas vide
    if (!html || html.length < 100) {
      console.error("❌ [PDF] HTML trop court ou vide");
      return false;
    }

    const { uri } = await Print.printToFileAsync({ html });
    console.log("📄 [PDF] Fichier créé avec succès:", uri);

    // ✅ Vérifier que le fichier existe
    if (!uri) {
      console.error("❌ [PDF] URI du fichier vide");
      return false;
    }

    if (Platform.OS === "web") {
      await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
    } else {
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Télécharger l'étiquette PDF",
        });
        console.log("✅ [PDF] Fichier partagé avec succès");
      } else {
        console.warn("⚠️ [PDF] Sharing non disponible sur cet appareil");
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error("❌ Erreur création PDF:", error);
    // ✅ Afficher plus de détails sur l'erreur
    if (error instanceof Error) {
      console.error("❌ Message:", error.message);
      console.error("❌ Stack:", error.stack);
    }
    return false;
  }
};

// ─── ENVOI À L'IMPRIMANTE ────────────────────────────────────────────────────
export const sendToPrinter = async (zplCode: string): Promise<boolean> => {
  try {
    if (!zplCode) {
      console.warn("⚠️ Code ZPL vide");
      return false;
    }

    const storedUrl =
      (await AsyncStorage.getItem("printer_url")) ||
      (await AsyncStorage.getItem("printer_ip"));
    if (!storedUrl) {
      console.warn("⚠️ URL imprimante non configurée");
      return false;
    }

    const printerUrl =
      storedUrl.startsWith("http://") || storedUrl.startsWith("https://")
        ? storedUrl
        : `http://${storedUrl}`;

    console.log(`🖨️ Envoi à l'imprimante ${printerUrl}`);
    const response = await fetch(printerUrl, {
      method: "POST",
      body: zplCode,
      headers: { "Content-Type": "text/plain" },
    });

    if (response.ok) {
      console.log("✅ Impression réussie");
      return true;
    } else {
      console.warn(`⚠️ Impression échouée: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error("❌ Erreur impression:", error);
    return false;
  }
};
