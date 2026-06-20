import { View, Image, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { router } from 'expo-router';

export default function Splash() {
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/(auth)/login');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/favicon.png')}
        style={{ width: 140, height: 140 }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5E6C8',
    justifyContent: 'center',
    alignItems: 'center',
  },
});