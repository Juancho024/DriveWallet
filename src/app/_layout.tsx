import { Stack } from 'expo-router';
import { ThemeProvider } from '@/context/ThemeContext';
import { initDatabase } from '@/db/database';
import { useEffect, useState } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { View, ActivityIndicator, StyleSheet, Alert, Platform } from 'react-native';
import {
    revisarTodasLasFechas,
    sincronizarNotificaciones4AM,
    verificarNotificacionEnFrio,
    configurarEscuchaAccionesNotificacion
} from '@/services/notificacionesService';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { QuickAddWidget } from "@/app/components/Widget";

// ⚠️ Manejador de tareas del widget estructurado correctamente
if (Platform.OS === 'android') {
    registerWidgetTaskHandler(async (task) => {
        switch (task.widgetAction) {
            case 'WIDGET_ADDED':
            case 'WIDGET_UPDATE':
            case 'WIDGET_RESIZED':
            case 'WIDGET_CLICK':
                if (task.widgetInfo.widgetName === 'QuickAddWidget') {
                    task.renderWidget(<QuickAddWidget/>);
                }
                break;
            case 'WIDGET_DELETED':
                break;
        }
    });
}

export default function RootLayout() {
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (Platform.OS !== 'web') {
            initDatabase(); // Solo carga SQLite si NO estamos en la web
        }

        // 🔥 1. Ejecutamos las notificaciones de inmediato (antes del bloqueo biométrico)
        verificarNotificacionEnFrio();
        const subscription = configurarEscuchaAccionesNotificacion();
        sincronizarNotificaciones4AM();
        revisarTodasLasFechas();

        // 2. Verificamos huella/PIN
        verificarSeguridadBiometrica();

        return () => subscription.remove();
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

    if (isLoading || !isAuthorized) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
            </View>
        );
    }

    return (
        <ThemeProvider>
            <Stack screenOptions={{ headerShown: false }}>
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