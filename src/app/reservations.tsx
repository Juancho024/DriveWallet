import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    Platform,
    ActivityIndicator,
    Linking,
    Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Reservations() {
    const router = useRouter();
    const { darkMode } = useTheme();

    const [tabActiva, setTabActiva] = useState<'PENDIENTE' | 'CONFIRMADA' | 'COMPLETADA'>('PENDIENTE');
    const [reservas, setReservas] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Sistema de Alertas Personalizadas
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertConfig, setAlertConfig] = useState({
        title: '',
        message: '',
        type: 'info' as 'info' | 'error' | 'success' | 'confirm',
        onConfirm: () => {}
    });

    const mostrarAlerta = (title: string, message: string, type: 'info' | 'error' | 'success' | 'confirm' = 'info', onConfirm = () => {}) => {
        setAlertConfig({ title, message, type, onConfirm });
        setAlertVisible(true);
    };

    useEffect(() => {
        cargarReservas(tabActiva);
    }, [tabActiva]);

    const cargarReservas = async (estado: string) => {
        setIsLoading(true);
        try {
            const token = await AsyncStorage.getItem('user_token');
            if (!token) {
                mostrarAlerta("Sesión expirada", "Por favor inicia sesión nuevamente.", "error");
                return;
            }

            const API_URL = `https://www.jrtechnology.duckdns.org/drivewallet/api/privado/reservas?estado=${estado}`;

            const response = await fetch(API_URL, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setReservas(data);
            } else {
                setReservas([]);
            }
        } catch (error) {
            console.error("Error al cargar reservas:", error);
            mostrarAlerta("Error de red", "No se pudieron obtener las reservas del servidor.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const cambiarEstadoReserva = async (idReserva: number, nuevoEstado: string) => {
        try {
            const token = await AsyncStorage.getItem('user_token');
            const API_URL = `https://www.jrtechnology.duckdns.org/drivewallet/api/privado/reservas/${idReserva}/estado?nuevoEstado=${nuevoEstado}`;

            const response = await fetch(API_URL, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                mostrarAlerta("¡Éxito!", `La reserva ha sido marcada como ${nuevoEstado.toLowerCase()}.`, "success", () => {
                    cargarReservas(tabActiva);
                });
            } else {
                const errorText = await response.text();
                mostrarAlerta("Aviso", errorText || "No se pudo actualizar el estado.", "error");
            }
        } catch (error) {
            console.error("Error al actualizar estado:", error);
            mostrarAlerta("Error", "Error de conexión con el servidor.", "error");
        }
    };

    const formatearFecha = (fechaStr: string) => {
        if (!fechaStr) return 'Fecha programada';
        try {
            const fecha = new Date(fechaStr);
            return fecha.toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch (e) {
            return fechaStr;
        }
    };

    // --- FUNCIÓN NATIVA PARA ABRIR EL SELECTOR DE MAPAS (Waze, Google Maps, etc.) ---
    const abrirNavegacion = (lat?: number, lon?: number, nombreLugar?: string) => {
        const label = encodeURIComponent(nombreLugar || 'Ubicación DriveWallet');

        let url = '';
        if (lat && lon) {
            // Protocolo geo universal que despliega el selector nativo de apps de mapas en Android/iOS
            url = Platform.select({
                ios: `maps://app?q=${label}&ll=${lat},${lon}`,
                android: `geo:${lat},${lon}?q=${lat},${lon}(${label})`
            }) || `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
        } else if (nombreLugar) {
            url = Platform.select({
                ios: `maps://app?q=${label}`,
                android: `geo:0,0?q=${label}`
            }) || `https://www.google.com/maps/search/?api=1&query=${label}`;
        } else {
            mostrarAlerta("Aviso", "No hay información de ubicación disponible.", "error");
            return;
        }

        Linking.openURL(url).catch(() => {
            // Fallback web de emergencia si falla el protocolo de app
            const fallbackQuery = (lat && lon) ? `${lat},${lon}` : (nombreLugar || '');
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackQuery)}`);
        });
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: darkMode ? '#121212' : '#F5F7FA' }]}>
            {/* Cabecera */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={darkMode ? '#FFF' : '#000'} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: darkMode ? '#FFF' : '#000' }]}>Gestión de Reservas</Text>
            </View>

            {/* Pestañas de Navegación por Estado */}
            <View style={[styles.tabContainer, { backgroundColor: darkMode ? '#1E1E1E' : '#E0E0E0' }]}>
                <TouchableOpacity
                    style={[styles.tabBtn, tabActiva === 'PENDIENTE' && styles.tabBtnActive]}
                    onPress={() => setTabActiva('PENDIENTE')}
                >
                    <Text style={[styles.tabText, { color: tabActiva === 'PENDIENTE' ? '#FFF' : (darkMode ? '#888' : '#555') }]}>Pendientes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabBtn, tabActiva === 'CONFIRMADA' && styles.tabBtnActive]}
                    onPress={() => setTabActiva('CONFIRMADA')}
                >
                    <Text style={[styles.tabText, { color: tabActiva === 'CONFIRMADA' ? '#FFF' : (darkMode ? '#888' : '#555') }]}>Confirmadas</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabBtn, tabActiva === 'COMPLETADA' && styles.tabBtnActive]}
                    onPress={() => setTabActiva('COMPLETADA')}
                >
                    <Text style={[styles.tabText, { color: tabActiva === 'COMPLETADA' ? '#FFF' : (darkMode ? '#888' : '#555') }]}>Completadas</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {isLoading ? (
                    <View style={{ marginTop: 50, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={darkMode ? '#FFF' : '#1E1E1E'} />
                        <Text style={{ color: darkMode ? '#888' : '#666', marginTop: 10 }}>Cargando reservas...</Text>
                    </View>
                ) : reservas.length === 0 ? (
                    <View style={{ marginTop: 60, alignItems: 'center' }}>
                        <Ionicons name="calendar-clear-outline" size={50} color={darkMode ? '#555' : '#AAA'} />
                        <Text style={{ color: darkMode ? '#888' : '#666', marginTop: 10, fontSize: 15 }}>No hay reservas {tabActiva.toLowerCase()}s.</Text>
                    </View>
                ) : (
                    reservas.map((item, index) => (
                        <View key={item.id || index} style={[styles.reservationCard, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                            <View style={styles.resHeader}>
                                <Text style={[styles.clientName, { color: darkMode ? '#FFF' : '#000' }]}>
                                    {item.cliente_nombre || 'Cliente DriveWallet'}
                                </Text>
                                <Text style={[styles.statusBadge, {
                                    backgroundColor: tabActiva === 'PENDIENTE' ? (darkMode ? '#332211' : '#FFF3E0') :
                                        tabActiva === 'CONFIRMADA' ? (darkMode ? '#1A3320' : '#E8F5E9') : (darkMode ? '#222233' : '#E3F2FD'),
                                    color: tabActiva === 'PENDIENTE' ? '#FF9800' : tabActiva === 'CONFIRMADA' ? '#4CAF50' : '#2196F3'
                                }]}>
                                    {tabActiva}
                                </Text>
                            </View>

                            <Text style={[styles.resDetails, { color: darkMode ? '#A0A0A0' : '#666' }]}>
                                <Ionicons name="calendar-outline" size={16} /> {formatearFecha(item.fecha_realizacion)}
                            </Text>

                            <Text style={[styles.resDetails, { color: darkMode ? '#A0A0A0' : '#666' }]}>
                                <Ionicons name="radio-button-on" size={16} color="#4CAF50" /> <Text style={{ fontWeight: '600' }}>Recogida:</Text> {item.recogida_nombre || 'No especificado'}
                            </Text>

                            <Text style={[styles.resDetails, { color: darkMode ? '#A0A0A0' : '#666' }]}>
                                <Ionicons name="location" size={16} color="#F44336" /> <Text style={{ fontWeight: '600' }}>Destino:</Text> {item.destino_nombre || 'No especificado'}
                            </Text>

                            {/* --- ACCIONES SEGÚN EL ESTADO --- */}
                            {tabActiva === 'PENDIENTE' && (
                                <View style={styles.actionRow}>
                                    <TouchableOpacity
                                        style={[styles.btn, styles.btnReject, { backgroundColor: darkMode ? '#3A1A1A' : '#FFEBEE' }]}
                                        onPress={() => {
                                            mostrarAlerta("Rechazar Reserva", "¿Estás seguro de que deseas rechazar esta solicitud?", "confirm", () => {
                                                cambiarEstadoReserva(item.id, 'RECHAZADA');
                                            });
                                        }}
                                    >
                                        <Text style={styles.btnTextReject}>Rechazar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.btn, { backgroundColor: darkMode ? '#FFF' : '#1E1E1E' }]}
                                        onPress={() => cambiarEstadoReserva(item.id, 'CONFIRMADA')}
                                    >
                                        <Text style={[styles.btnTextApprove, { color: darkMode ? '#000' : '#FFF' }]}>Aprobar</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* --- DOS BOTONES LIMPIOS Y PROFESIONALES (RECOGIDA Y DESTINO) --- */}
                            {tabActiva === 'CONFIRMADA' && (
                                <View style={{ marginTop: 15 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                                        {/* Botón de Recogida */}
                                        <TouchableOpacity
                                            style={[styles.btnNavigationClean, { backgroundColor: '#4CAF50', marginRight: 5 }]}
                                            onPress={() => abrirNavegacion(item.recogida_latitud, item.recogida_longitud, item.recogida_nombre)}
                                        >
                                            <Ionicons name="navigate" size={18} color="#FFF" style={{ marginRight: 6 }} />
                                            <Text style={styles.btnNavText}>Ir a Recogida</Text>
                                        </TouchableOpacity>

                                        {/* Botón de Destino */}
                                        <TouchableOpacity
                                            style={[styles.btnNavigationClean, { backgroundColor: '#2196F3', marginLeft: 5 }]}
                                            onPress={() => abrirNavegacion(item.destino_latitud, item.destino_longitud, item.destino_nombre)}
                                        >
                                            <Ionicons name="location" size={18} color="#FFF" style={{ marginRight: 6 }} />
                                            <Text style={styles.btnNavText}>Ir a Destino</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Botón para Finalizar el Viaje */}
                                    <TouchableOpacity
                                        style={[styles.btnFinishFull, { backgroundColor: darkMode ? '#333' : '#1E1E1E', marginTop: 4 }]}
                                        onPress={() => {
                                            mostrarAlerta("Completar Viaje", "¿Confirmas que el viaje ha finalizado con éxito?", "confirm", () => {
                                                cambiarEstadoReserva(item.id, 'COMPLETADA');
                                            });
                                        }}
                                    >
                                        <Ionicons name="checkmark-done" size={18} color="#FFF" style={{ marginRight: 6 }} />
                                        <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Finalizar Viaje</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {tabActiva === 'COMPLETADA' && (
                                <View style={styles.completedInfoBox}>
                                    <Ionicons name="checkmark-circle" size={18} color="#4CAF50" style={{ marginRight: 6 }} />
                                    <Text style={{ color: darkMode ? '#888' : '#666', fontSize: 13, fontWeight: '500' }}>Servicio ejecutado correctamente</Text>
                                </View>
                            )}
                        </View>
                    ))
                )}
            </ScrollView>

            {/* Modal de Alerta Unificada */}
            <Modal animationType="fade" transparent={true} visible={alertVisible}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.customAlertBox, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                        <View style={[styles.alertIconContainer, {
                            backgroundColor: alertConfig.type === 'error' || alertConfig.type === 'confirm' ? (darkMode ? '#3A1A1A' : '#FFEBEE') : (darkMode ? '#1A3320' : '#E8F5E9')
                        }]}>
                            <Ionicons
                                name={alertConfig.type === 'error' ? 'alert-circle' : alertConfig.type === 'confirm' ? 'help-circle' : 'checkmark-circle'}
                                size={32}
                                color={alertConfig.type === 'error' || alertConfig.type === 'confirm' ? '#F44336' : '#4CAF50'}
                            />
                        </View>
                        <Text style={[styles.customAlertTitle, { color: darkMode ? '#FFF' : '#000' }]}>{alertConfig.title}</Text>
                        <Text style={[styles.customAlertMessage, { color: darkMode ? '#A0A0A0' : '#666' }]}>{alertConfig.message}</Text>

                        <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
                            {alertConfig.type === 'confirm' && (
                                <TouchableOpacity
                                    style={[styles.alertBtn, { backgroundColor: darkMode ? '#2A2A2A' : '#FFEBEE', flex: 1, marginRight: 5 }] }
                                    onPress={() => setAlertVisible(false)}
                                >
                                    <Text style={{ color: '#F44336', fontWeight: 'bold' }}>Cancelar</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={[styles.alertBtn, { backgroundColor: darkMode ? '#FFF' : '#1E1E1E', flex: 1, marginLeft: alertConfig.type === 'confirm' ? 5 : 0 }]}
                                onPress={() => {
                                    setAlertVisible(false);
                                    if (alertConfig.onConfirm) {
                                        alertConfig.onConfirm();
                                    }
                                }}
                            >
                                <Text style={{ color: darkMode ? '#000' : '#FFF', fontWeight: 'bold' }}>Aceptar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 15,
        paddingBottom: 15
    },
    backBtn: { marginRight: 15 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    tabContainer: {
        flexDirection: 'row',
        marginHorizontal: 20,
        borderRadius: 12,
        padding: 4,
        marginBottom: 15
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 10
    },
    tabBtnActive: {
        backgroundColor: '#2196F3'
    },
    tabText: { fontSize: 13, fontWeight: '600' },
    scrollContent: { padding: 20, paddingBottom: 40 },
    reservationCard: { borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, marginBottom: 15 },
    resHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    clientName: { fontSize: 18, fontWeight: 'bold' },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 11, fontWeight: 'bold' },
    resDetails: { fontSize: 14, marginBottom: 8 },
    actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
    btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginHorizontal: 5 },
    btnReject: {},
    btnTextReject: { color: '#F44336', fontWeight: 'bold' },
    btnTextApprove: { fontWeight: 'bold' },
    btnNavigationClean: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center'
    },
    btnNavText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
    btnFinishFull: {
        flexDirection: 'row',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center'
    },
    completedInfoBox: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#333' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
    customAlertBox: { padding: 25, borderRadius: 24, alignItems: 'center', elevation: 10 },
    alertIconContainer: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
    customAlertTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    customAlertMessage: { fontSize: 14, textAlign: 'center', marginBottom: 25, lineHeight: 20 },
    alertBtn: { padding: 14, borderRadius: 12, alignItems: 'center' }
});