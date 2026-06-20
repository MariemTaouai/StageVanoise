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
  Alert
} from 'react-native';

import { router } from 'expo-router';

export default function SignupScreen() {

  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // ⚠️ CHANGE IP selon emulator / téléphone
const API_URL = 'http://192.168.1.16:3000';
const isValidEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};
  const handleSignup = async () => {

    // 1. validation
    if (!nom || !email || !telephone || !password || !confirmPassword) {
      Alert.alert('Erreur', 'Tous les champs sont obligatoires');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }


  if (!isValidEmail(email)) {
    Alert.alert('Erreur', 'Email invalide ❌');
    return;
  }
    try {
      setLoading(true);

      // 2. call backend
      const response = await fetch(`${API_URL}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nom,
          email,
          telephone,
          password,
        }),
      });

      const data = await response.json();

      console.log('Signup response:', data);

      // 3. error backend
      if (!response.ok) {
        Alert.alert('Erreur', data.message || 'Signup échoué');
        return;
      }

      // 4. success
      Alert.alert('Succès', 'Compte créé avec succès ✅');

      // retour login
      router.back();

    } catch (error) {
      console.log(error);
      Alert.alert('Erreur', 'Serveur inaccessible ❌');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
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
          <Text style={styles.welcomeSub}>Rejoignez votre espace</Text>
        </View>

        <View style={styles.wave} />

        {/* FORM */}
        <View style={styles.form}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

            {/* NOM */}
            <Text style={styles.label}>Nom complet</Text>
            <View style={styles.inputBox}>
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput
                style={styles.input}
                value={nom}
                onChangeText={setNom}
                placeholder="Nom"
              />
            </View>

            {/* EMAIL */}
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputBox}>
              <Text style={styles.inputIcon}>📧</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="email@gmail.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* TELEPHONE */}
            <Text style={styles.label}>Téléphone</Text>
            <View style={styles.inputBox}>
              <Text style={styles.inputIcon}>📱</Text>
              <TextInput
                style={styles.input}
                value={telephone}
                onChangeText={setTelephone}
                placeholder="+216"
                keyboardType="phone-pad"
              />
            </View>

            {/* PASSWORD */}
            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.inputBox}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Text style={styles.inputIcon}>
                  {showPassword ? '🙈' : '👁️'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* CONFIRM */}
            <Text style={styles.label}>Confirmation</Text>
            <View style={styles.inputBox}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
              />
            </View>

            {/* BUTTON */}
            <TouchableOpacity
              style={[styles.signupButton, loading && { opacity: 0.6 }]}
              onPress={handleSignup}
              disabled={loading}
            >
              <Text style={styles.signupButtonText}>
                {loading ? 'Chargement...' : 'S’inscrire ›'}
              </Text>
            </TouchableOpacity>

          </KeyboardAvoidingView>
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Déjà un compte ?
            <Text style={styles.footerLink} onPress={() => router.back()}>
              {' '}Se connecter ›
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
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}


/* ================= STYLE ================= */

const BROWN = '#5C3317';
const RED = '#C0202A';
const CREAM = '#F5E6C8';
const CREAM2 = '#FDF6EE';

const styles = StyleSheet.create({
container: {
  flex: 1,
  backgroundColor: CREAM2,
},  scroll: { flexGrow: 1 },

header: {
  backgroundColor: CREAM,
  paddingTop: 24,
  paddingBottom: 55,
  alignItems: 'center',
  paddingHorizontal: 24,
},

  backBtn: { alignSelf: 'flex-start', marginLeft: 20 },
backText: {
  color: BROWN,
  fontSize: 14,
  fontWeight: '600',
},

welcomeTitle: {
  fontSize: 24,
  fontWeight: '700',
  color: BROWN,
  marginBottom: 4,
},

welcomeSub: {
  fontSize: 14,
  color: '#8B6347',
},

 wave: {
  height: 35,
  backgroundColor: CREAM2,
  borderTopLeftRadius: 40,
  borderTopRightRadius: 40,
  marginTop: -35,
},
  logoWrapper: {
    width: 100, height: 100,

    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 280, height: 120 },


  form: { padding: 20 },

label: {
  fontSize: 13,
  fontWeight: '600',
  color: BROWN,
  marginBottom: 7,
  marginTop: 6,
},
 inputBox: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#fff',
  borderRadius: 14,
  borderWidth: 1.5,
  borderColor: '#E8D5BC',
  paddingHorizontal: 14,
  height: 52,
  marginBottom: 14,
  shadowColor: BROWN,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 4,
  elevation: 2,
},
input: {
  flex: 1,
  fontSize: 15,
  color: '#3D1F0A',
},

inputIcon: {
  fontSize: 16,
  marginRight: 8,
},
signupButton: {
  backgroundColor: BROWN,
  borderRadius: 30,
  height: 52,
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 20,
  shadowColor: BROWN,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 5,
},
signupButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '700',
},

  footer: { alignItems: 'center', marginTop: 20 },

  footerText: { color: '#666' },

  footerLink: { color: RED },

  copyright: { fontSize: 11, marginTop: 10 },

  copyrightLink: { color: RED },
});