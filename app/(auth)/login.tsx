// app/(auth)/login.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, KeyboardAvoidingView,
  Platform, Image, ScrollView, Alert, Linking
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiUrl, setApiUrl] = useState('');

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

  // ✅ Fonction pour rediriger selon les rôles
  const redirectBasedOnRoles = (user: any) => {
    const roles = user.roles || [];
    
    console.log('🔑 Rôles de l\'utilisateur:', roles);
    
    if (roles.includes('Production Controller')) {
      router.replace('/(user)/DeclarationProduction');
      return;
    }
    
    if (roles.includes('GA sales Controller') || roles.includes('Commercial')) {
      router.replace('/(user)/SalesDashboard');
      return;
    }
    
    if (roles.includes('Expéditeur')) {
      router.replace('/(user)/ExpeditionScreen');
      return;
    }
    
    if (roles.includes('Réception')) {
      router.replace('/(user)/ReceptionScreen');
      return;
    }
    
    if (roles.length > 1) {
      router.replace('/(auth)/RoleSelectionScreen');
      return;
    }
    
    console.warn('⚠️ Aucun rôle reconnu, redirection vers dashboard');
    router.replace('/(user)');
  };

  const handleLogin = async () => {
    if (!apiUrl) {
      Alert.alert('Erreur', 'URL du serveur non configurée');
      router.replace('/ApiConfigScreen');
      return;
    }

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      Alert.alert('Erreur', 'Email et mot de passe obligatoires');
      return;
    }

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(cleanEmail)) {
      Alert.alert('Erreur', 'Email invalide ❌');
      return;
    }

    if (cleanPassword.length < 3) {
      Alert.alert('Erreur', 'Mot de passe doit contenir au moins 3 caractères');
      return;
    }

    try {
      setLoading(true);

      console.log('📡 Connexion à:', `${apiUrl}/login`);

      const response = await fetch(`${apiUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPassword,
        }),
      });

      const data = await response.json();
      console.log(' Réponse login:', JSON.stringify(data, null, 2));

      if (!response.ok) {
        Alert.alert('Erreur', data.message || 'Login échoué ❌');
        return;
      }

      // ✅ Vérifier les rôles
      if (!data.user.roles || data.user.roles.length === 0) {
        console.warn('⚠️ Aucun rôle trouvé, rôle par défaut: User');
        data.user.roles = ['User'];
      }

      // ✅ =============================================
      // ✅ STOCKER LE TOKEN D'ACCÈS (accessToken)
      // ✅ =============================================
      if (data.accessToken) {
        await AsyncStorage.setItem('access_token', data.accessToken);
        console.log('✅ Access token stocké:', data.accessToken.substring(0, 30) + '...');
      } else {
        console.warn('⚠️ PAS DE accessToken dans la réponse !');
        Alert.alert('Erreur', 'Le serveur n\'a pas retourné de token');
        setLoading(false);
        return;
      }

      // ✅ STOCKER LE REFRESH TOKEN
      if (data.refreshToken) {
        await AsyncStorage.setItem('refresh_token', data.refreshToken);
        console.log('✅ Refresh token stocké');
      } else {
        console.warn('⚠️ PAS DE refreshToken dans la réponse !');
      }

      await AsyncStorage.setItem('user', JSON.stringify(data.user));

      await AsyncStorage.setItem('user_roles', JSON.stringify(data.user.roles));

      // ✅ VÉRIFICATION : Lire les tokens stockés
      const savedAccessToken = await AsyncStorage.getItem('access_token');
      const savedRefreshToken = await AsyncStorage.getItem('refresh_token');
      const savedUser = await AsyncStorage.getItem('user');
      const savedRoles = await AsyncStorage.getItem('user_roles');
      
      console.log('🔍 VÉRIFICATION FINALE:');
      console.log('  - Access Token:', savedAccessToken ? '✅ PRÉSENT (' + savedAccessToken.substring(0, 30) + '...)' : '❌ ABSENT');
      console.log('  - Refresh Token:', savedRefreshToken ? '✅ PRÉSENT' : '❌ ABSENT');
      console.log('  - User:', savedUser ? '✅ PRÉSENT' : '❌ ABSENT');
      console.log('  - Roles:', savedRoles ? '✅ PRÉSENT' : '❌ ABSENT');

      const roleStr = data.user.roles.join(', ');
      Alert.alert(
        'Succès', 
        `Bienvenue ${data.user.nom} 👋\nRôles: ${roleStr}`
      );

      redirectBasedOnRoles(data.user);

    } catch (error) {
      console.error('❌ Erreur login:', error);
      Alert.alert('Erreur', 'Serveur inaccessible ❌');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <View style={styles.header}>
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

        <View style={styles.wave} />

        <View style={styles.form}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Text style={styles.label}>Adresse e-mail</Text>
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
              />
            </View>

            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.inputBox}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••"
                placeholderTextColor="#C4A882"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Text style={styles.inputIcon}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.forgotRow}
              onPress={() => router.push('/(auth)/forgot-password')}
            >
              <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.loginButton, loading && { opacity: 0.6 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.loginButtonText}>
                {loading ? 'Connexion...' : 'Se connecter'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.configButton}
              onPress={() => router.push('/ApiConfigScreen')}
            >
              <Text style={styles.configButtonText}>⚙️ Changer l'URL du serveur</Text>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Pas encore de compte ?{' '}
            <Text style={styles.footerLink} onPress={() => router.push('/(auth)/signup')}>
              S'inscrire ›
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


/* ── Couleurs ── */
const BROWN   = '#5C3317';
const RED     = '#C0202A';
const CREAM   = '#F5E6C8';
const CREAM2  = '#FDF6EE';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CREAM2 },
  scroll: {
    flexGrow: 1,
    paddingTop: 20,
  },
  /* Header */
  header: {
    backgroundColor: CREAM,
    paddingTop: 24,
    paddingBottom: 55,
    alignItems: 'center',
    paddingHorizontal: 24,
    borderBottomWidth: 0,
  },
  langRow: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'center',
    marginBottom: 16,
    gap: 6,
  },
  langBtn: { fontSize: 13, color: '#A0856A', fontWeight: '500' },
  langActive: { color: BROWN, fontWeight: '700' },
  langSep: { color: '#C4A882', fontSize: 13 },

  logoWrapper: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 280, height: 120 },

  welcomeTitle: {
    fontSize: 24, fontWeight: '700',
    color: BROWN, marginBottom: 4,
  },
  welcomeSub: { fontSize: 14, color: '#8B6347' },

  decorRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  decorHeart: { fontSize: 18 },

  /* Vague */
  wave: {
    height: 35,
    backgroundColor: CREAM2,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    marginTop: -35,
  },

  /* Formulaire */
  form: { paddingHorizontal: 24, paddingTop: 8 },

  label: {
    fontSize: 13, fontWeight: '600',
    color: BROWN, marginBottom: 7, marginTop: 6,
  },
  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E8D5BC',
    paddingHorizontal: 14, height: 52,
    marginBottom: 14,
    shadowColor: BROWN,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  inputIcon: { fontSize: 16, marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: '#3D1F0A' },

  forgotRow: { alignSelf: 'flex-end', marginBottom: 22 },
  forgotText: { fontSize: 13, color: RED, fontWeight: '500' },

  loginButton: {
    backgroundColor: BROWN,
    borderRadius: 30, height: 52,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    shadowColor: BROWN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  loginButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  configButton: {
    backgroundColor: CREAM2,
    borderRadius: 30,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: '#C8B8A8',
  },
  configButtonText: {
    color: '#7D6E65',
    fontSize: 14,
    fontWeight: '600',
  },

  /* Séparateur */
  separatorRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 18, gap: 10,
  },
  separatorLine: { flex: 1, height: 1, backgroundColor: '#E8D5BC' },
  separatorText: { fontSize: 12, color: '#B89A7A' },

  /* Sociaux */
  socialRow: { flexDirection: 'row', gap: 12, marginBottom: 30 },
  socialBtn: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E8D5BC', height: 48,
  },
  googleIcon: { fontSize: 16, color: '#E34133', fontWeight: '800' },
  msIcon: { fontSize: 18, color: '#00A4EF' },
  socialText: { fontSize: 14, color: BROWN, fontWeight: '500' },

  /* Footer */
  footer: { alignItems: 'center', paddingBottom: 24, paddingTop: 4 },
  footerText: { fontSize: 13, color: '#8B6347', marginBottom: 10 },
  footerLink: { color: RED, fontWeight: '600' },
  copyright: { fontSize: 11, color: '#B89A7A', textAlign: 'center' },
  copyrightLink: { color: BROWN, textDecorationLine: 'underline' },
});