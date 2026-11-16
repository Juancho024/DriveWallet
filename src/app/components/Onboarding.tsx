import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AudioModule } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/context/ThemeContext';

const { width } = Dimensions.get('window');

const slides = [
    {
        id: '1',
        title: 'Bienvenido a DriveWallet 🚘',
        description: 'Toma el control absoluto de tus ingresos, gastos y el mantenimiento de tu vehículo en un solo lugar.',
        icon: 'car-sport',
        color: '#4CAF50'
    },
    {
        id: '2',
        title: 'Tu Copiloto Inteligente ✨',
        description: 'Nuestra Inteligencia Artificial (Gemini) analizará tus finanzas, te dará consejos de ahorro y preparará tus reportes mensuales.',
        icon: 'hardware-chip',
        color: '#9C27B0'
    },
    {
        id: '3',
        title: 'Registra Hablando 🎙️',
        description: 'Usa el asistente por voz para registrar múltiples gastos o ingresos al instante con solo dictarle lo que gastaste.',
        icon: 'mic',
        color: '#2196F3'
    },
    {
        id: '4',
        title: 'Escanea con la Cámara 📷',
        description: 'Tómale foto a tus facturas, recibos o comprobantes de transferencia. La IA extraerá los montos y los guardará por ti.',
        icon: 'camera',
        color: '#E91E63'
    },
    {
        id: '5',
        title: 'Mantente Informado 🔔',
        description: 'Para que la magia funcione y recibas tus alertas a las 4:00 a. m. o avisos de mantenimiento, necesitamos habilitar los permisos.',
        icon: 'notifications',
        color: '#FF9800'
    }
];

export default function Onboarding() {
    const { darkMode } = useTheme();
    const [isVisible, setIsVisible] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        const checkFirstLaunch = async () => {
            try {
                const hasSeen = await AsyncStorage.getItem('has_seen_onboarding');
                if (hasSeen !== 'true') {
                    setIsVisible(true);
                }
            } catch (error) {
                console.log("Error revisando onboarding", error);
            }
        };
        checkFirstLaunch();
    }, []);

    const handleNext = async () => {
        if (currentSlide < slides.length - 1) {
            // Avanza a la siguiente diapositiva
            setCurrentSlide(currentSlide + 1);
        } else {
            // 🔥 LLEGAMOS A LA ÚLTIMA PANTALLA: AQUÍ PEDIMOS TODOS LOS PERMISOS

            // 1. Permisos de Notificaciones
            const { status: notifStatus } = await Notifications.getPermissionsAsync();
            if (notifStatus !== 'granted') {
                await Notifications.requestPermissionsAsync();
            }

            // 2. Permisos de Micrófono (Audio)
            try {
                await AudioModule.requestRecordingPermissionsAsync();
            } catch (e) {
                console.log("Error pidiendo permiso de audio", e);
            }

            // 3. Permisos de Galería / Cámara
            try {
                await ImagePicker.requestMediaLibraryPermissionsAsync();
            } catch (e) {
                console.log("Error pidiendo permiso de galería", e);
            }

            // Terminó el tutorial, lo guardamos para que no vuelva a salir
            await AsyncStorage.setItem('has_seen_onboarding', 'true');
            setIsVisible(false);
        }
    };

    if (!isVisible) return null;

    const slide = slides[currentSlide];

    return (
        <Modal animationType="fade" transparent={false} visible={isVisible}>
            <View style={[styles.container, { backgroundColor: darkMode ? '#121212' : '#F5F7FA' }]}>

                {/* Contenido Central */}
                <View style={styles.content}>
                    <View style={[styles.iconRing, { borderColor: slide.color }]}>
                        <View style={[styles.iconCircle, { backgroundColor: slide.color + '20' }]}>
                            <Ionicons name={slide.icon as any} size={80} color={slide.color} />
                        </View>
                    </View>

                    <Text style={[styles.title, { color: darkMode ? '#FFF' : '#000' }]}>{slide.title}</Text>
                    <Text style={[styles.description, { color: darkMode ? '#A0A0A0' : '#666' }]}>
                        {slide.description}
                    </Text>
                </View>

                {/* Footer con Puntos y Botón */}
                <View style={styles.footer}>
                    {/* Indicadores (Puntitos) */}
                    <View style={styles.pagination}>
                        {slides.map((_, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.dot,
                                    currentSlide === index ? [styles.dotActive, { backgroundColor: slide.color }] : { backgroundColor: darkMode ? '#333' : '#DDD' }
                                ]}
                            />
                        ))}
                    </View>

                    {/* Botón Siguiente / Finalizar */}
                    <TouchableOpacity
                        style={[styles.btn, { backgroundColor: slide.color }]}
                        activeOpacity={0.8}
                        onPress={handleNext}
                    >
                        <Text style={styles.btnText}>
                            {currentSlide === slides.length - 1 ? '¡Empezar a usar!' : 'Siguiente'}
                        </Text>
                        <Ionicons
                            name={currentSlide === slides.length - 1 ? "checkmark-done" : "arrow-forward"}
                            size={20}
                            color="#FFF"
                            style={{ marginLeft: 8 }}
                        />
                    </TouchableOpacity>
                </View>

            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'space-between' },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
    iconRing: { width: 180, height: 180, borderRadius: 90, borderWidth: 2, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
    iconCircle: { width: 140, height: 140, borderRadius: 70, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
    description: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
    footer: { paddingHorizontal: 30, paddingBottom: Platform.OS === 'ios' ? 90 : 60 },
    pagination: { flexDirection: 'row', justifyContent: 'center', marginBottom: 30 },
    dot: { width: 10, height: 10, borderRadius: 5, marginHorizontal: 6 },
    dotActive: { width: 25 },
    btn: { flexDirection: 'row', paddingVertical: 18, borderRadius: 16, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
    btnText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' }
});