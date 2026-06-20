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

export default function ResetPasswordScreen() {
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; code?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const code = typeof params.code === 'string' ? params.code : '';

const API_URL = 'http://192.168.1.16:3000';
  const handleResetPassword = async (): Promise<void> => {
    const pass = newPassword.trim();
    const confirm = confirmPassword.trim();

    if (!pass || !confirm) {
      Alert.alert('Erreur', 'Veuillez remplir les deux champs ✏️');
      return;
    }

    if (pass.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères ❌');
      return;
    }

    if (pass !== confirm) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas ❌');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword: pass }),
      });

      const responseText = await response.text();

      let data: BackendResponse = {};
      if (responseText) {
        try {
          data = JSON.parse(responseText) as BackendResponse;
        } catch (e) {
          console.warn("[RESET PASSWORD] ⚠️ La réponse n'est pas un JSON valide.");
        }
      }

      if (!response.ok) {
        Alert.alert('Erreur', data.message || `Erreur serveur (${response.status}). ❌`);
        return;
      }

      Alert.alert(
        'Succès',
        data.message || 'Mot de passe modifié avec succès ✅',
        [{ text: 'OK', onPress: () => router.replace('/login') }]
      );

    } catch (error) {
      console.error("[RESET PASSWORD] 💥 Erreur réseau :", error);
      Alert.alert(
        'Erreur de connexion',
        'Impossible de joindre le serveur. Vérifie le Wi-Fi ou l\'IP de ton PC. ❌'
      );
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
            <Text style={styles.title}>Nouveau mot de passe</Text>
            <Text style={styles.subtitle}>
              Choisissez un nouveau mot de passe pour votre compte.
            </Text>
          </View>

          {/* Formulaire */}
          <View style={styles.form}>

            {/* Nouveau mot de passe */}
            <Text style={styles.label}>Nouveau mot de passe</Text>
            <View style={styles.inputBox}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#C4A882"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!loading}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            {/* Confirmation */}
            <Text style={styles.label}>Confirmer le mot de passe</Text>
            <View style={styles.inputBox}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#C4A882"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!loading}
              />
            </View>

            <Text style={styles.hint}>
              Le mot de passe doit contenir au moins 6 caractères.
            </Text>

            {/* Bouton de validation */}
            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.6 }]}
              onPress={handleResetPassword}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Réinitialiser le mot de passe</Text>
              )}
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
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#E8D5BC', paddingHorizontal: 14, height: 52, marginBottom: 16 },
  inputIcon: { fontSize: 16, marginRight: 8 },
  eyeIcon: { fontSize: 16, marginLeft: 8 },
  input: { flex: 1, fontSize: 15, color: '#3D1F0A', minHeight: 40 },
  hint: { fontSize: 12, color: '#8B6347', marginBottom: 16, marginTop: -4 },
  button: { backgroundColor: BROWN, borderRadius: 30, height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 15, shadowColor: BROWN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 3 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backButton: { alignItems: 'center', marginTop: 10, paddingVertical: 5 },
  backButtonText: { color: RED, fontSize: 14, fontWeight: '600' }
});