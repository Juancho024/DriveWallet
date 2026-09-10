import { Stack } from 'expo-router';
import { ThemeProvider } from '@/context/ThemeContext';
import { initDatabase } from '@/db/database';
import {useEffect, useState} from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { revisarTodasLasFechas } from '@/services/notificacionesService';

export default function RootLayout() {
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        initDatabase(); // Crea la tabla SQLite al arrancar
        verificarSeguridadBiometrica();
        revisarTodasLasFechas();
    }, []);

    const verificarSeguridadBiometrica = async () => {
        try {
            const biometricsEnabled = await AsyncStorage.getItem('app_biometrics');

            if (biometricsEnabled === 'true') {
                const resultado = await LocalAuthentication.authenticateAsync({
                    promptMessage: 'Desbloquea DriveWallet',
                    fallbackLabel: 'Usar PIN',
                    cancelLabel: 'Salir'
                });

                if (resultado.success) {
                    setIsAuthorized(true);
                } else {
                    // Si cancela o falla, intentamos de nuevo o cerramos
                    Alert.alert("Autenticación requerida", "Debes identificarte para usar la aplicación.", [
                        { text: "Reintentar", onPress: () => verificarSeguridadBiometrica() }
                    ]);
                }
            } else {
                setIsAuthorized(true);
            }
        } catch (error) {
            console.error(error);
            setIsAuthorized(true);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
            </View>
        );
    }

    return (
        <ThemeProvider>
            <Stack screenOptions={{ headerShown: false }}>
                {/* Esto carga tu archivo de pestañas que me enviaste */}
                <Stack.Screen name="(tabs)" />
            </Stack>
        </ThemeProvider>
    );

}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#121212'
    }
});