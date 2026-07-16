import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, KeyboardAvoidingView,
  Platform, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface BackendResponse {
  message?: string;
  error?: string;
}

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [apiUrl, setApiUrl] = useState<string>('');
  const router = useRouter();

  // ✅ Récupérer l'URL sauvegardée au chargement
  useEffect(() => {
    const loadApiUrl = async () => {
      try {
        const url = await AsyncStorage.getItem('api_url');
        if (url) {
          setApiUrl(url);
          console.log('✅ URL chargée:', url);
        } else {
          console.warn('⚠️ Aucune URL trouvée, redirection vers configuration');
          router.replace('/ApiConfigScreen');
        }
      } catch (error) {
        console.error('❌ Erreur chargement URL:', error);
        router.replace('/ApiConfigScreen');
      }
    };
    loadApiUrl();
  }, []);

  const handleForgotPassword = async (): Promise<void> => {
    console.log("[DEBUG] Bouton cliqué - handleForgotPassword appelée");

    // ✅ Vérifier que l'URL est chargée
    if (!apiUrl) {
      Alert.alert('Erreur', 'URL du serveur non configurée');
      router.replace('/ApiConfigScreen');
      return;
    }

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      console.log("[DEBUG] Email vide");
      Alert.alert('Erreur', 'Veuillez saisir votre adresse e-mail ✉️');
      return;
    }

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(cleanEmail)) {
      console.log("[DEBUG] Format email invalide:", cleanEmail);
      Alert.alert('Erreur', 'Format de l\'e-mail invalide ❌');
      return;
    }

    try {
      setLoading(true);
      console.log("[DEBUG] Avant fetch vers:", `${apiUrl}/forgot-password`);

      const response = await fetch(`${apiUrl}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      console.log("[DEBUG] Après fetch, statut HTTP:", response.status);

      const responseText = await response.text();
      console.log("[DEBUG] Contenu brut de la réponse:", responseText);

      let data: BackendResponse = {};
      if (responseText) {
        try {
          data = JSON.parse(responseText) as BackendResponse;
        } catch (e) {
          console.warn("[FORGOT PASSWORD] ⚠️ La réponse n'est pas un JSON valide.");
        }
      }

      console.log("[DEBUG] response.ok:", response.ok, "| data:", JSON.stringify(data));

      if (!response.ok) {
        console.log("[DEBUG] -> Branche ERREUR, affichage Alert 'Erreur'");
        Alert.alert('Erreur', data.message || `Erreur serveur (${response.status}). ❌`);
        return;
      }

      console.log("[DEBUG] -> Branche SUCCÈS, affichage Alert 'E-mail envoyé !'");
      Alert.alert(
        'E-mail envoyé !',
        data.message || 'Un code de vérification a été envoyé à votre adresse e-mail. 📬',
        [{
          text: 'OK',
          onPress: () => {
            console.log("[DEBUG] OK cliqué -> redirection vers /verify-otp avec email:", cleanEmail);
            router.push({
              pathname: '/verify-otp',
              params: { email: cleanEmail },
            });
          },
        }]
      );

    } catch (error) {
      console.log("[DEBUG] -> EXCEPTION catch:", error);
      Alert.alert(
        'Erreur de connexion',
        'Impossible de joindre le serveur. Vérifie le Wi-Fi ou l\'IP de ton PC. ❌'
      );
    } finally {
      console.log("[DEBUG] Fin handleForgotPassword, setLoading(false)");
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Mot de passe oublié</Text>
            <Text style={styles.subtitle}>
              Saisissez votre adresse e-mail pour recevoir un code de vérification.
            </Text>
          </View>

          {/* Formulaire */}
          <View style={styles.form}>
            <Text style={styles.label}>Adresse e-mail du compte</Text>
            <View style={styles.inputBox}>
              <Text style={styles.inputIcon}>✉️</Text>
              <TextInput
                style={styles.input}
                placeholder="votre@email.com"
                placeholderTextColor="#C4A882"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.6 }]}
              onPress={handleForgotPassword}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Vérifier et envoyer</Text>
              )}
            </TouchableOpacity>

            {/* Retour au Login */}
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>‹ Retour à la connexion</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const BROWN  = '#5C3317';
const RED    = '#C0202A';
const CREAM2 = '#FDF6EE';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CREAM2 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 20 },
  header: { alignItems: 'center', marginBottom: 30 },
  title: { fontSize: 24, fontWeight: '700', color: BROWN, marginBottom: 10 },
  subtitle: { fontSize: 14, color: '#8B6347', textAlign: 'center', lineHeight: 20 },
  form: { backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: BROWN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  label: { fontSize: 13, fontWeight: '600', color: BROWN, marginBottom: 7 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#E8D5BC', paddingHorizontal: 14, height: 52, marginBottom: 20 },
  inputIcon: { fontSize: 16, marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: '#3D1F0A', minHeight: 40 },
  button: { backgroundColor: BROWN, borderRadius: 30, height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 15, shadowColor: BROWN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 3 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backButton: { alignItems: 'center', marginTop: 10, paddingVertical: 5 },
  backButtonText: { color: RED, fontSize: 14, fontWeight: '600' },
});