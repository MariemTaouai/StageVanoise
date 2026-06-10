import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, KeyboardAvoidingView,
  Platform, Image, ScrollView,Linking
} from 'react-native';

import { router } from 'expo-router';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {
    console.log('Connexion avec :', email);
    // router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>

        {/* ── Header rouge ── */}
        <View style={styles.header}>

        

          {/* Logo */}
          <View style={styles.logoWrapper}>
            <Image
              source={require('../../assets/favicon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.welcomeTitle}>Bienvenue</Text>
          <Text style={styles.welcomeSub}>Connectez-vous à votre espace</Text>
        </View>

        {/* ── Vague blanche ── */}
        <View style={styles.wave} />

        {/* ── Formulaire ── */}
        <View style={styles.form}>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Email */}
            <Text style={styles.label}>Adresse e-mail</Text>
            <View style={styles.inputBox}>
              <Text style={styles.inputIcon}>✉️</Text>
              <TextInput
                style={styles.input}
                placeholder="votre@email.com"
                placeholderTextColor="#bbb"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Mot de passe */}
            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.inputBox}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder="••••"
                placeholderTextColor="#bbb"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Text style={styles.inputIcon}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            {/* Mot de passe oublié */}
            <TouchableOpacity style={styles.forgotRow}>
              <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
            </TouchableOpacity>

            {/* Bouton Se connecter */}
            <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
              <Text style={styles.loginButtonText}>Se connecter  ›</Text>
            </TouchableOpacity>

     

          

          </KeyboardAvoidingView>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
  <Text style={styles.footerText}>
    Pas encore de compte ?
    <Text
      style={styles.footerLink}
      onPress={() => router.push('/(auth)/signup')}
    >
      {' '}Snscrire ›
    </Text>
  </Text>

  <Text style={styles.copyright}>
    © 2026{' '}
    <Text
      style={styles.copyrightLink}
      onPress={() => Linking.openURL('https://vanoiserie.tn/')}
    >
      Dr. Oetker Vanoise
    </Text>
    {' '}Tous droits réservés.
  </Text>
</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const RED = '#C0202A';
const RED_DARK = '#A01820';
const BG = '#FDF6F0';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1 },

  /* Header */
  header: {
    backgroundColor: RED,
    paddingTop: 20,
    paddingBottom: 60,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  langRow: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'center',
    marginBottom: 20,
    gap: 6,
  },
  langBtn: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  langActive: { color: '#fff', fontWeight: '700' },
  langSep: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  logoWrapper: {
    width: 90, height: 90,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    padding: 8,
  },
  logo: { width: 100, height: 120 },
  welcomeTitle: {
    fontSize: 17, fontWeight: '700',
    color: '#fff', marginBottom: 6,
  },
  welcomeSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },

  /* Vague */
  wave: {
    height: 40,
    backgroundColor: BG,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    marginTop: -40,
  },

  /* Formulaire */
  form: { paddingHorizontal: 24, paddingTop: 8, backgroundColor: BG },
  label: {
    fontSize: 13, fontWeight: '500',
    color: '#333', marginBottom: 8, marginTop: 4,
  },
  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1, borderColor: '#E8E0D8',
    paddingHorizontal: 14, height: 50,
    marginBottom: 16,
  },
  inputIcon: { fontSize: 16, marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: '#222' },
  forgotRow: { alignSelf: 'flex-end', marginBottom: 24 },
  forgotText: { fontSize: 13, color: RED, fontWeight: '500' },
  loginButton: {
    backgroundColor: RED,
    borderRadius: 30,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  loginButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  /* Séparateur */
  separatorRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 20, gap: 10,
  },
  separatorLine: { flex: 1, height: 1, backgroundColor: '#E0D8D0' },
  separatorText: { fontSize: 12, color: '#aaa' },

  /* Sociaux */
  socialRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  socialBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12, borderWidth: 1,
    borderColor: '#E0D8D0', height: 48,
  },
  socialIcon: { fontSize: 16, color: '#E34133', fontWeight: '800' },
  socialIconMs: { fontSize: 18, color: '#00A4EF' },
  socialText: { fontSize: 14, color: '#333', fontWeight: '500' },
copyrightLink: {
  color: RED,
  textDecorationLine: 'underline',
},
  /* Footer */
  footer: { alignItems: 'center', paddingBottom: 24, paddingTop: 8 },
  footerText: { fontSize: 13, color: '#666', marginBottom: 12 },
  footerLink: { color: RED, fontWeight: '600' },
  copyright: { fontSize: 11, color: '#bbb', textAlign: 'center' },
});