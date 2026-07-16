// app/(auth)/RoleSelectionScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Role {
  id: number;
  nom: string;
  description: string;
}

export default function RoleSelectionScreen() {
  const [user, setUser] = useState<any>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userJson = await AsyncStorage.getItem('user');
      if (!userJson) {
        Alert.alert('Erreur', 'Utilisateur non trouvé');
        router.replace('/login');
        return;
      }

      const userData = JSON.parse(userJson);
      setUser(userData);
      
      if (userData.roles_details && userData.roles_details.length > 0) {
        setRoles(userData.roles_details);
      } else if (userData.roles && userData.roles.length > 0) {
        const roleNames = userData.roles.map((name: string) => ({
          id: 0,
          nom: name,
          description: `Rôle: ${name}`,
        }));
        setRoles(roleNames);
      }

      setLoading(false);
    } catch (error) {
      console.error('❌ Erreur chargement données:', error);
      Alert.alert('Erreur', 'Impossible de charger les données');
      router.replace('/login');
    }
  };

  // ✅ FONCTION CORRIGÉE - Redirection selon le rôle
  const navigateToRole = (roleName: string) => {
    console.log('🔄 Rôle choisi:', roleName);
    
    // Sauvegarder le rôle sélectionné
    AsyncStorage.setItem('selected_role', roleName);
    
    // ✅ Redirection selon le rôle
    switch (roleName) {
      case 'Expéditeur':
        console.log('📦 Redirection vers ExpeditionScreen');
        router.replace('/(user)/ExpeditionScreen');
        break;
        
      case 'Commercial':
      case 'GA sales Controller':
        console.log('📊 Redirection vers SalesDashboard');
        router.replace('/(user)/SalesDashboard');
        break;
        
      case 'Production Controller':
        console.log('🏭 Redirection vers DeclarationProduction');
        router.replace('/(user)/DeclarationProduction');
        break;
        
      case 'Réception':
        console.log('📥 Redirection vers ReceptionScreen');
        router.replace('/(user)/ReceptionScreen');
        break;
        
    
        
    
        
      default:
        console.log('🔀 Redirection par défaut vers (user)');
        router.replace('/(user)');
    }
  };

  // ✅ Fonction de déconnexion CORRIGÉE (ne supprime pas l'URL)
  const handleLogout = async () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: async () => {
            try {
              // ✅ Sauvegarder l'URL avant de tout supprimer
              const apiUrl = await AsyncStorage.getItem('api_url');
              const printerIp = await AsyncStorage.getItem('printer_ip');
              
              // ✅ Supprimer uniquement les données utilisateur
              await AsyncStorage.multiRemove(['user', 'selected_role']);
              
              // ✅ Restaurer les configurations
              if (apiUrl) await AsyncStorage.setItem('api_url', apiUrl);
              if (printerIp) await AsyncStorage.setItem('printer_ip', printerIp);
              
              router.replace('/login');
            } catch (error) {
              console.error('❌ Erreur déconnexion:', error);
              router.replace('/login');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#C0202A" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Image
            source={require('../../assets/favicon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Sélectionnez votre rôle</Text>
          <Text style={styles.subtitle}>
            Bonjour {user?.nom}, vous avez plusieurs rôles. 
            Choisissez celui avec lequel vous voulez travailler.
          </Text>
        </View>

        <View style={styles.rolesContainer}>
          {roles.map((role) => (
            <TouchableOpacity
              key={role.id || role.nom}
              style={styles.roleCard}
              onPress={() => navigateToRole(role.nom)}
            >
              <View style={styles.roleIconContainer}>
                <Text style={styles.roleIcon}>
                  {getRoleIcon(role.nom)}
                </Text>
              </View>
              <View style={styles.roleInfo}>
                <Text style={styles.roleName}>{role.nom}</Text>
                <Text style={styles.roleDescription}>
                  {role.description || getRoleDescription(role.nom)}
                </Text>
              </View>
              <Text style={styles.roleArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Vous pouvez changer de rôle à tout moment depuis le menu.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Helpers ──────────────────────────────────────────────────
const getRoleIcon = (roleName: string): string => {
  const icons: Record<string, string> = {
    'Admin': '👑',
    'Production Controller': '🏭',
    'GA sales Controller': '📊',
    'Commercial': '💼',
    'Expéditeur': '📦',
    'Réception': '📥',
    'Manager': '📋',
    'User': '👤',
  };
  return icons[roleName] || '🔹';
};

const getRoleDescription = (roleName: string): string => {
  const descriptions: Record<string, string> = {
    'Admin': 'Accès total à toutes les fonctionnalités',
    'Production Controller': 'Gestion de la production et des OF',
    'GA sales Controller': 'Tableau de bord des ventes et analyses',
    'Commercial': 'Accès aux ventes et clients',
    'Expéditeur': 'Gestion des expéditions et palettes',
    'Réception': 'Gestion des palettes reçues',
    'Manager': 'Accès aux rapports et statistiques',
    'User': 'Accès standard',
  };
  return descriptions[roleName] || 'Accès au module';
};

// ─── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDF6EE',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#5C3317',
    marginTop: 12,
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 30,
  },
  logo: {
    width: 120,
    height: 50,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#5C3317',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#8B6347',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  rolesContainer: {
    gap: 12,
    marginBottom: 30,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8D5BC',
    shadowColor: '#5C3317',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  roleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5E6C8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  roleIcon: {
    fontSize: 24,
  },
  roleInfo: {
    flex: 1,
  },
  roleName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5C3317',
    marginBottom: 2,
  },
  roleDescription: {
    fontSize: 12,
    color: '#8B6347',
  },
  roleArrow: {
    fontSize: 20,
    color: '#C4A882',
  },
  actionsContainer: {
    marginTop: 10,
    marginBottom: 20,
  },
  logoutButton: {
    backgroundColor: '#C0202A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 12,
    color: '#B89A7A',
    textAlign: 'center',
  },
});