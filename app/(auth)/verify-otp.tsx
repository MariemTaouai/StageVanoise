import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, KeyboardAvoidingView,
  Platform, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

interface BackendResponse {
  message?: string;
  error?: string;
}

export default function VerifyOtpScreen() {
  const [code, setCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';

const API_URL = 'http://10.197.21.178:3000';
  const handleVerifyOtp = async (): Promise<void> => {
    const cleanCode = code.trim();

    if (!cleanCode) {
      Alert.alert('Erreur', 'Veuillez saisir le code reçu par e-mail ✉️');
      return;
    }

    if (!/^\d{6}$/.test(cleanCode)) {
      Alert.alert('Erreur', 'Le code doit contenir 6 chiffres ❌');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: cleanCode }),
      });

      const responseText = await response.text();

      let data: BackendResponse = {};
      if (responseText) {
        try {
          data = JSON.parse(responseText) as BackendResponse;
        } catch (e) {
          console.warn("[VERIFY OTP] ⚠️ La réponse n'est pas un JSON valide.");
        }
      }

      if (!response.ok) {
        Alert.alert('Erreur', data.message || `Code invalide (${response.status}). ❌`);
        return;
      }

      Alert.alert(
        'Code vérifié ✅',
        data.message || 'Code valide. Vous pouvez maintenant choisir un nouveau mot de passe.',
        [{
          text: 'OK',
          onPress: () => router.push({
            pathname: '/reset-password',
            params: { email, code: cleanCode },
          }),
        }]
      );

    } catch (error) {
      console.error("[VERIFY OTP] 💥 Erreur réseau :", error);
      Alert.alert(
        'Erreur de connexion',
        'Impossible de joindre le serveur. Vérifie le Wi-Fi ou l\'IP de ton PC. ❌'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (): Promise<void> => {
    if (!email) {
      Alert.alert('Erreur', "Adresse e-mail manquante ❌");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const responseText = await response.text();
      let data: BackendResponse = {};
      if (responseText) {
        try {
          data = JSON.parse(responseText) as BackendResponse;
        } catch (e) {
          // ignore
        }
      }

      if (!response.ok) {
        Alert.alert('Erreur', data.message || 'Impossible de renvoyer le code ❌');
        return;
      }

      Alert.alert('Code renvoyé', 'Un nouveau code a été envoyé à votre adresse e-mail. 📬');

    } catch (error) {
      console.error("[RESEND OTP] 💥 Erreur réseau :", error);
      Alert.alert('Erreur de connexion', 'Impossible de joindre le serveur. ❌');
    } finally {
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
            <Text style={styles.title}>Vérification</Text>
            <Text style={styles.subtitle}>
              Saisissez le code à 6 chiffres envoyé à{'\n'}
              <Text style={{ fontWeight: '700' }}>{email}</Text>
            </Text>
          </View>

          {/* Formulaire */}
          <View style={styles.form}>
            <Text style={styles.label}>Code de vérification</Text>
            <View style={styles.inputBox}>
              <Text style={styles.inputIcon}>🔑</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="123456"
                placeholderTextColor="#C4A882"
                value={code}
                onChangeText={(text) => setCode(text.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={6}
                editable={!loading}
              />
            </View>

            {/* Bouton de validation */}
            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.6 }]}
              onPress={handleVerifyOtp}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Vérifier le code</Text>
              )}
            </TouchableOpacity>

            {/* Renvoyer le code */}
            <TouchableOpacity onPress={handleResend} disabled={loading} style={styles.resendButton}>
              <Text style={styles.resendText}>Renvoyer le code</Text>
            </TouchableOpacity>

            {/* Retour */}
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>‹ Retour</Text>
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
  codeInput: { fontSize: 20, fontWeight: '700', letterSpacing: 4, textAlign: 'center' },
  button: { backgroundColor: BROWN, borderRadius: 30, height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 15, shadowColor: BROWN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 3 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resendButton: { alignItems: 'center', marginTop: 5, paddingVertical: 5 },
  resendText: { color: BROWN, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  backButton: { alignItems: 'center', marginTop: 10, paddingVertical: 5 },
  backButtonText: { color: RED, fontSize: 14, fontWeight: '600' }
});