// app/(user)/index.tsx
import { useEffect } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

export default function UserIndex() {
  useEffect(() => {
    const redirect = async () => {
      try {
        console.log('🔀 [INDEX] Redirection depuis index...');
        
        // ✅ 1. Récupérer le rôle sélectionné (prioritaire)
        const selectedRole = await AsyncStorage.getItem('selected_role');
        console.log('🔑 [INDEX] Rôle sélectionné:', selectedRole);
        
        // ✅ 2. Récupérer l'utilisateur
        const userJson = await AsyncStorage.getItem('user');
        if (!userJson) {
          console.log('⚠️ [INDEX] Aucun utilisateur, redirection vers login');
          router.replace('/login');
          return;
        }
        
        const user = JSON.parse(userJson);
        const roles = user.roles || [];
        console.log('📋 [INDEX] Rôles disponibles:', roles);
        
        // ✅ 3. SI UN RÔLE EST SÉLECTIONNÉ, REDIRIGER VERS LE BON ÉCRAN
        if (selectedRole) {
          console.log('🎯 [INDEX] Rôle sélectionné trouvé:', selectedRole);
          redirectToRole(selectedRole);
          return;
        }
        
        // ✅ 4. Si l'utilisateur n'a qu'un seul rôle
        if (roles.length === 1) {
          const role = roles[0];
          console.log('🎯 [INDEX] Un seul rôle:', role);
          redirectToRole(role);
          return;
        }
        
        // ✅ 5. Si l'utilisateur a plusieurs rôles mais aucun sélectionné
        if (roles.length > 1) {
          console.log('🔄 [INDEX] Plusieurs rôles, redirection vers RoleSelectionScreen');
          router.replace('/(auth)/RoleSelectionScreen');
          return;
        }
        
        // ✅ 6. Fallback
        console.log('🔀 [INDEX] Fallback vers SalesDashboard');
        router.replace('/(user)/SalesDashboard');
        
      } catch (error) {
        console.error('❌ [INDEX] Erreur de redirection:', error);
        router.replace('/(user)/SalesDashboard');
      }
    };
    
    redirect();
  }, []);

  const redirectToRole = (roleName: string) => {
    console.log('🔀 [INDEX] Redirection vers le rôle:', roleName);
    
    switch (roleName) {
      case 'Expéditeur':
        console.log('📦 [INDEX] → ExpeditionScreen');
        router.replace('/(user)/ExpeditionScreen');
        break;
      case 'Commercial':
      case 'GA sales Controller':
        console.log('📊 [INDEX] → SalesDashboard');
        router.replace('/(user)/SalesDashboard');
        break;
      case 'Production Controller':
        console.log('🏭 [INDEX] → DeclarationProduction');
        router.replace('/(user)/DeclarationProduction');
        break;
      case 'Réception':
        console.log('📥 [INDEX] → ReceptionScreen');
        router.replace('/(user)/ReceptionScreen');
        break;
   
      default:
        console.log('🔀 [INDEX] → SalesDashboard (default)');
        router.replace('/(user)/SalesDashboard');
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#C0202A" />
      <Text style={styles.text}>Chargement...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  text: {
    marginTop: 12,
    fontSize: 14,
    color: '#7D6E65',
  },
});