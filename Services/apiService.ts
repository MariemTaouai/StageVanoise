import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export const getApiUrl = async (): Promise<string> => {
  const url = await AsyncStorage.getItem("api_url");
  if (!url) {
    throw new Error("URL API non configurée");
  }
  return url;
};

export const setApiUrl = async (url: string): Promise<void> => {
  await AsyncStorage.setItem("api_url", url);
};

// Hook pour les composants
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