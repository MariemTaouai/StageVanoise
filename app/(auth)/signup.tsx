import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
} from 'react-native';
import { router } from 'expo-router';

export default function SignupScreen() {
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSignup = () => {
    console.log({
      nom,
      email,
      telephone,
      password,
      confirmPassword,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>‹ Retour</Text>
          </TouchableOpacity>

          <View style={styles.logoWrapper}>
            <Image
              source={require('../../assets/favicon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.welcomeTitle}>Créer un compte</Text>
          <Text style={styles.welcomeSub}>
            Rejoignez votre espace de travail
          </Text>
        </View>

        {/* Vague */}
        <View style={styles.wave} />

        {/* Formulaire */}
        <View style={styles.form}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Nom */}
            <Text style={styles.label}>Nom complet</Text>
            <View style={styles.inputBox}>
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput
                style={styles.input}
                placeholder="Prénom Nom"
                placeholderTextColor="#bbb"
                value={nom}
                onChangeText={setNom}
              />
            </View>

            {/* Email */}
            <Text style={styles.label}>Adresse e-mail</Text>
            <View style={styles.inputBox}>
              <Text style={styles.inputIcon}>📧</Text>
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

            {/* Téléphone */}
            <Text style={styles.label}>Numéro de téléphone</Text>
            <View style={styles.inputBox}>
              <Text style={styles.inputIcon}>📱</Text>
              <TextInput
                style={styles.input}
                placeholder="+216 XX XXX XXX"
                placeholderTextColor="#bbb"
                value={telephone}
                onChangeText={setTelephone}
                keyboardType="phone-pad"
              />
            </View>

            {/* Mot de passe */}
            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.inputBox}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#bbb"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.inputIcon}>
                  {showPassword ? '🙈' : '👁️'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Confirmation */}
            <Text style={styles.label}>Confirmer le mot de passe</Text>
            <View style={styles.inputBox}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#bbb"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
              />
            </View>

            {/* Bouton */}
            <TouchableOpacity
              style={styles.signupButton}
              onPress={handleSignup}
            >
              <Text style={styles.signupButtonText}>
                Sinscrire ›
              </Text>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Déjà un compte ?
            <Text
              style={styles.footerLink}
              onPress={() => router.back()}
            >
              {' '}Se connecter ›
            </Text>
          </Text>

          <Text style={styles.copyright}>
            © 2026{' '}
            <Text
              style={styles.copyrightLink}
              onPress={() =>
                Linking.openURL('https://vanoiserie.tn/')
              }
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
const BG = '#FDF6F0';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  scroll: {
    flexGrow: 1,
  },

  header: {
    backgroundColor: RED,
    paddingTop: 20,
    paddingBottom: 60,
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },

  backText: {
    color: '#fff',
    fontSize: 15,
  },

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




  welcomeSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },

  wave: {
    height: 40,
    backgroundColor: BG,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    marginTop: -40,
  },

  form: {
    paddingHorizontal: 24,
    backgroundColor: BG,
  },

  label: {
    fontSize: 13,
    color: '#333',
    marginBottom: 8,
    marginTop: 4,
    fontWeight: '500',
  },

  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E8E0D8',
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 14,
    marginBottom: 16,
  },

  inputIcon: {
    fontSize: 16,
    marginRight: 8,
  },

  input: {
    flex: 1,
    fontSize: 15,
    color: '#222',
  },

  signupButton: {
    backgroundColor: RED,
    height: 52,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 28,
  },

  signupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  footer: {
    alignItems: 'center',
    paddingBottom: 24,
  },

  footerText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },

  footerLink: {
    color: RED,
    fontWeight: '600',
  },

  copyright: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
  },

  copyrightLink: {
    color: RED,
    textDecorationLine: 'underline',
  },
});