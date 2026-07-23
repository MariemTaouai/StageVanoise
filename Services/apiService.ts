import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

// ─── RÉCUPÉRATION DES URLs ──────────────────────────────────────────────

export const getApiUrl = async (useSecondary = false): Promise<string> => {
  const key = useSecondary ? "api_url_2" : "api_url";
  const url = await AsyncStorage.getItem(key);
  if (!url) {
    throw new Error(
      `URL API ${useSecondary ? "secondaire" : "principale"} non configurée`,
    );
  }
  return url;
};

export const getConfiguredApiUrl = async (): Promise<string> => {
  const primaryUrl = await AsyncStorage.getItem("api_url");
  if (primaryUrl) return primaryUrl;
  const secondaryUrl = await AsyncStorage.getItem("api_url_2");
  if (secondaryUrl) return secondaryUrl;
  throw new Error("Aucune URL API configurée");
};

export const getApiUrls = async (): Promise<{
  primary: string | null;
  secondary: string | null;
}> => ({
  primary: await AsyncStorage.getItem("api_url"),
  secondary: await AsyncStorage.getItem("api_url_2"),
});

export const setApiUrl = async (
  url: string,
  useSecondary = false,
): Promise<void> => {
  const key = useSecondary ? "api_url_2" : "api_url";
  await AsyncStorage.setItem(key, url);
};

// ─── TOKEN AUTH ──────────────────────────────────────────────────────────

const getToken = async (): Promise<string | null> => {
  return await AsyncStorage.getItem("access_token");
};

const refreshToken = async (): Promise<string | null> => {
  try {
    const refreshToken = await AsyncStorage.getItem("refresh_token");
    if (!refreshToken) return null;

    const url = await getApiUrl(false);
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
  } catch {
    return null;
  }
};

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  let token = await getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    const newToken = await refreshToken();
    if (newToken) {
      const retryHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${newToken}`,
        ...options.headers,
      };
      response = await fetch(url, { ...options, headers: retryHeaders });
    } else {
      throw new Error("Session expirée");
    }
  }

  return response;
};

// ─── 🔄 FETCH AVEC FALLBACK AUTOMATIQUE ────────────────────────────────


export const fetchWithFallback = async (
  path: string,
  options: RequestInit = {},
): Promise<Response> => {
  try {
    // 1️⃣ ESSAYER BACKEND PRINCIPAL
    console.log(`📡 [BACKEND 1] Tentative: ${path}`);
    const primaryUrl = await getApiUrl(false);
    const response = await fetchWithAuth(`${primaryUrl}${path}`, options);
    
    if (response.ok) {
      console.log(`✅ [BACKEND 1] Succès: ${path}`);
      return response;
    }
    
    console.warn(`⚠️ [BACKEND 1] Erreur ${response.status}: ${path}`);
    throw new Error(`Backend 1: ${response.status}`);
    
  } catch (error) {
    // 2️⃣ FALLBACK VERS BACKEND SECONDAIRE
    console.warn(`🔄 [FALLBACK] Tentative sur Backend 2: ${path}`);
    
    try {
      const secondaryUrl = await getApiUrl(true);
      const response = await fetchWithAuth(`${secondaryUrl}${path}`, options);
      
      if (response.ok) {
        console.log(`✅ [BACKEND 2] Succès: ${path}`);
        return response;
      }
      
      console.error(`❌ [BACKEND 2] Erreur ${response.status}: ${path}`);
      throw new Error(`Backend 2: ${response.status}`);
      
    } catch (fallbackError) {
      console.error(`❌ [ALL] Les deux backends ont échoué pour: ${path}`);
      throw new Error(`Aucun backend disponible pour ${path}`);
    }
  }
};


export const getApiUrlForFeature = async (
  feature: "production" | "reception" | "expedition" | "sales",
): Promise<string> => {
  const primaryUrl = await AsyncStorage.getItem("api_url");
  const secondaryUrl = await AsyncStorage.getItem("api_url_2");

  if (feature === "expedition" || feature === "sales") {
    if (secondaryUrl) return secondaryUrl;
    if (primaryUrl) return primaryUrl;
    throw new Error("Aucune URL API secondaire ou principale configurée");
  }

  if (primaryUrl) return primaryUrl;
  if (secondaryUrl) return secondaryUrl;
  throw new Error("Aucune URL API principale ou secondaire configurée");
};

// ✅ fetchFromFeature - Gardée (utilise getApiUrlForFeature)
export const fetchFromFeature = async (
  feature: "production" | "reception" | "expedition" | "sales",
  path: string,
  options?: RequestInit,
): Promise<Response> => {
  const url = await getApiUrlForFeature(feature);
  return fetch(`${url}${path}`, options);
};

// ✅ Toutes les fonctions existantes sont conservées

// Backend 1 (Express)
export const fetchProductionFeature = async (
  path: string,
  options?: RequestInit,
): Promise<Response> => fetchFromFeature("production", path, options);

export const fetchReceptionFeature = async (
  path: string,
  options?: RequestInit,
): Promise<Response> => fetchFromFeature("reception", path, options);

export const fetchExpeditionFeature = async (
  path: string,
  options?: RequestInit,
): Promise<Response> => fetchFromFeature("expedition", path, options);

export const fetchSalesFeature = async (
  path: string,
  options?: RequestInit,
): Promise<Response> => fetchFromFeature("sales", path, options);

// ✅ fetchProductionAndExpedition - Gardée
export const fetchProductionAndExpedition = async (
  productionPath: string,
  expeditionPath: string,
  productionOptions?: RequestInit,
  expeditionOptions?: RequestInit,
): Promise<[Response, Response]> =>
  Promise.all([
    fetchProductionFeature(productionPath, productionOptions),
    fetchExpeditionFeature(expeditionPath, expeditionOptions),
  ]);

// ✅ fetchFromPrimary - Gardée
export const fetchFromPrimary = async (
  path: string,
  options?: RequestInit,
): Promise<Response> => {
  const url = await getApiUrl(false);
  return fetch(`${url}${path}`, options);
};

// ✅ fetchFromSecondary - Gardée
export const fetchFromSecondary = async (
  path: string,
  options?: RequestInit,
): Promise<Response> => {
  const url = await getApiUrl(true);
  return fetch(`${url}${path}`, options);
};

// ✅ fetchBoth - Gardée (mais améliorée avec Promise.allSettled)
export interface FetchBothResult {
  primary: { success: boolean; response?: Response; error?: string };
  secondary: { success: boolean; response?: Response; error?: string };
}

export const fetchBoth = async (
  primaryPath: string,
  secondaryPath: string,
  primaryOptions?: RequestInit,
  secondaryOptions?: RequestInit,
): Promise<FetchBothResult> => {
  const [primaryResult, secondaryResult] = await Promise.allSettled([
    fetchFromPrimary(primaryPath, primaryOptions),
    fetchFromSecondary(secondaryPath, secondaryOptions),
  ]);

  return {
    primary:
      primaryResult.status === "fulfilled"
        ? { success: true, response: primaryResult.value }
        : {
            success: false,
            error: primaryResult.reason?.message || "Backend principal indisponible",
          },
    secondary:
      secondaryResult.status === "fulfilled"
        ? { success: true, response: secondaryResult.value }
        : {
            success: false,
            error:
              secondaryResult.reason?.message || "Backend secondaire indisponible",
          },
  };
};

// ─── HOOK ──────────────────────────────────────────────────────────────

export const useApiUrl = () => {
  const [url, setUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUrl = async () => {
      try {
        const stored = await getApiUrl();
        setUrl(stored);
      } catch (error) {
        setUrl("");
      } finally {
        setLoading(false);
      }
    };
    loadUrl();
  }, []);

  return { url, loading };
};