import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import BalanceCard from '../components/BalanceCard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    Movimiento,
    obtenerUltimosMovimientos,
    sumarIngresosDelMes,
    sumarGastosDelMes,
    debugDatabase
} from '@/db/database';

export default function Home() {
    const router = useRouter();
    const { darkMode } = useTheme();

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loginModalVisible, setLoginModalVisible] = useState(false);
    const [alias, setAlias] = useState('');
    const [password, setPassword] = useState('');
    const [nombreConductor, setNombreConductor] = useState('Conductor');
    const [avatarUri, setAvatarUri] = useState<string | null>(null); // Estado para la foto en Home
    const [isLoadingLogin, setIsLoadingLogin] = useState(false);

    // Estados financieros reales desde SQLite
    const [neto, setNeto] = useState(0);
    const [metaMensual, setMetaMensual] = useState(15000);
    const [porcentajeMeta, setPorcentajeMeta] = useState(0);
    const [ultimosMovimientos, setUltimosMovimientos] = useState<Movimiento[]>([]);

    // Estado para la Reserva Pendiente más reciente
    const [reservaReciente, setReservaReciente] = useState<any>(null);

    // Estados para el Modal de Editar Meta Mensual
    const [modalMetaVisible, setModalMetaVisible] = useState(false);
    const [metaInput, setMetaInput] = useState('');

    // Sistema de Alertas Personalizadas unificado
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

    useFocusEffect(
        useCallback(() => {
            verificarSesionActiva();
            cargarDatosFinancieros();
        }, [])
    );

    const verificarSesionActiva = async () => {
        try {
            const token = await AsyncStorage.getItem('user_token');
            const nombreGuardado = await AsyncStorage.getItem('conductor_nombre');
            const fotoGuardada = await AsyncStorage.getItem('conductor_foto'); // Recuperar foto

            if (token && nombreGuardado) {
                setIsLoggedIn(true);
                setNombreConductor(nombreGuardado);
                if (fotoGuardada) setAvatarUri(fotoGuardada);
                cargarReservaReciente(token);
            } else {
                setIsLoggedIn(false);
                setNombreConductor('Conductor');
                setAvatarUri(null);
                setReservaReciente(null);
            }
        } catch (error) {
            setIsLoggedIn(false);
        }
    };

    const cargarDatosFinancieros = async () => {
        try {
            debugDatabase();

            const now = new Date();
            const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0).getTime();
            const finMes = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();

            const totalIngresos = sumarIngresosDelMes(inicioMes, finMes);
            const totalGastos = sumarGastosDelMes(inicioMes, finMes);
            const calculoNeto = totalIngresos - totalGastos;

            setNeto(calculoNeto);
            const ultimos = obtenerUltimosMovimientos();
            setUltimosMovimientos(ultimos);

            const metaGuardada = await AsyncStorage.getItem('meta_mensual');
            const meta = metaGuardada ? parseFloat(metaGuardada) : 15000;
            setMetaMensual(meta);
            setMetaInput(meta.toString());

            if (meta > 0) {
                let p = Math.round((calculoNeto / meta) * 100);
                if (p > 100) p = 100;
                if (p < 0) p = 0;
                setPorcentajeMeta(p);
            }
        } catch (error) {
            console.error("Error al cargar cuadre:", error);
        }
    };

    const cargarReservaReciente = async (token: string) => {
        try {
            const response = await fetch('https://www.jrtechnology.duckdns.org/drivewallet/api/privado/reservas?estado=PENDIENTE', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                if (data && data.length > 0) {
                    setReservaReciente(data[0]);
                } else {
                    setReservaReciente(null);
                }
            }
        } catch (error) {
            console.error("Error al cargar reserva reciente:", error);
        }
    };

    const handleGuardarMeta = async () => {
        if (!metaInput || isNaN(Number(metaInput))) return;
        const nuevaMeta = parseFloat(metaInput);
        await AsyncStorage.setItem('meta_mensual', nuevaMeta.toString());
        setModalMetaVisible(false);
        cargarDatosFinancieros();
    };

    const fechaActual = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const fechaFormateada = fechaActual.charAt(0).toUpperCase() + fechaActual.slice(1);

    const formatMoney = (val: number) => {
        return `$${val.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: darkMode ? '#121212' : '#F5F7FA' }]}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Cabecera Condicional con Avatar Real */}
                <View style={styles.header}>
                    <View style={{flex: 1}}>
                        {isLoggedIn ? (
                            <>
                                <Text style={[styles.greeting, { color: darkMode ? '#A0A0A0' : '#666' }]}>Bienvenido,</Text>
                                <Text style={[styles.driverName, { color: darkMode ? '#FFF' : '#000' }]}>{nombreConductor}</Text>
                            </>
                        ) : (
                            <>
                                <Text style={[styles.greeting, { color: darkMode ? '#A0A0A0' : '#666' }]}>Fecha de hoy</Text>
                                <Text style={[styles.driverName, { color: darkMode ? '#FFF' : '#000' }]}>{fechaFormateada}</Text>
                            </>
                        )}
                    </View>

                    {isLoggedIn && (
                        <TouchableOpacity style={styles.profileIcon} onPress={() => router.push('/profile' as any)}>
                            {avatarUri ? (
                                <Image source={{ uri: avatarUri }} style={styles.profileAvatarImage} />
                            ) : (
                                <Ionicons name="person-circle" size={42} color={darkMode ? '#FFF' : '#1E1E1E'} />
                            )}
                        </TouchableOpacity>
                    )}
                </View>

                {/* BalanceCard con QuickActions integrados y conectados a SQLite */}
                <BalanceCard
                    amount={formatMoney(neto)}
                    onMovimientoGuardado={cargarDatosFinancieros}
                />

                {/* Barra de Meta Mensual Interactiva */}
                <TouchableOpacity activeOpacity={0.8} onPress={() => setModalMetaVisible(true)}>
                    <View style={[styles.metaCard, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={[styles.metaTitulo, { color: darkMode ? '#FFF' : '#000' }]}>Meta Mensual</Text>
                                <Ionicons name="pencil-outline" size={14} color="#888" style={{ marginLeft: 6 }} />
                            </View>
                            <Text style={{ color: '#4CAF50', fontWeight: 'bold' }}>{porcentajeMeta}%</Text>
                        </View>
                        <View style={styles.progressBarBackground}>
                            <View style={[styles.progressBarFill, { width: `${porcentajeMeta}%` }]} />
                        </View>
                        <Text style={[styles.metaSub, { color: darkMode ? '#888' : '#666' }]}>Meta actual: RD$ {metaMensual.toLocaleString()} (Toca para cambiar)</Text>
                    </View>
                </TouchableOpacity>

                {/* --- SECCIÓN DE RESERVAS PENDIENTES --- */}
                {isLoggedIn && (
                    <>
                        <Text style={[styles.sectionTitle, { color: darkMode ? '#FFF' : '#000' }]}>Reservas Pendientes</Text>
                        {reservaReciente ? (
                            <View style={[styles.pendingCard, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                                <View style={[styles.iconContainer, { backgroundColor: darkMode ? '#332211' : '#FFF3E0' }]}>
                                    <Ionicons name="time" size={24} color="#FF9800" />
                                </View>
                                <View style={styles.pendingInfo}>
                                    <Text style={[styles.pendingTitle, { color: darkMode ? '#FFF' : '#000' }]}>
                                        {reservaReciente.destino ? `Destino: ${reservaReciente.destino}` : 'Nueva Solicitud de Reserva'}
                                    </Text>
                                    <Text style={styles.pendingDesc} numberOfLines={1}>
                                        {reservaReciente.fecha || 'Pendiente'} • {reservaReciente.origen ? `Desde: ${reservaReciente.origen}` : 'Ver detalles'}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => router.push('/reservations' as any)}>
                                    <Ionicons name="arrow-forward-circle" size={28} color={darkMode ? '#FFF' : '#1E1E1E'} />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={[styles.pendingCard, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF', justifyContent: 'center', paddingVertical: 18 }]}>
                                <Text style={{ color: darkMode ? '#888' : '#666', fontSize: 14 }}>No hay solicitudes de reserva pendientes.</Text>
                            </View>
                        )}
                    </>
                )}

                {/* Últimos Movimientos */}
                <Text style={[styles.sectionTitle, { color: darkMode ? '#FFF' : '#000' }]}>Últimos Movimientos</Text>
                {ultimosMovimientos.length === 0 ? (
                    <Text style={{ color: '#888', fontSize: 13, marginTop: 5 }}>No hay movimientos registrados este mes.</Text>
                ) : (
                    ultimosMovimientos.map((item) => (
                        <View key={item.id} style={[styles.movimientoRow, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons
                                    name={item.tipo === 'INGRESO' ? 'arrow-down-circle' : 'arrow-up-circle'}
                                    size={24}
                                    color={item.tipo === 'INGRESO' ? '#4CAF50' : '#E57373'}
                                    style={{ marginRight: 10 }}
                                />
                                <View>
                                    <Text style={[styles.movNota, { color: darkMode ? '#FFF' : '#000' }]}>{item.nota || item.categoria}</Text>
                                    <Text style={styles.movFecha}>{new Date(item.fechaTimestamp).toLocaleDateString()}</Text>
                                </View>
                            </View>
                            <Text style={[styles.movMonto, { color: item.tipo === 'INGRESO' ? '#4CAF50' : '#E57373' }]}>
                                {item.tipo === 'INGRESO' ? '+' : '-'} {formatMoney(item.monto)}
                            </Text>
                        </View>
                    ))
                )}

            </ScrollView>

            {/* Modal para Cambiar la Meta Mensual */}
            <Modal animationType="slide" transparent={true} visible={modalMetaVisible}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                        <Text style={[styles.modalTitle, { color: darkMode ? '#FFF' : '#000' }]}>Definir Meta Mensual</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]}
                            placeholder="Ej. 25000"
                            placeholderTextColor="#A0A0A0"
                            keyboardType="numeric"
                            value={metaInput}
                            onChangeText={setMetaInput}
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setModalMetaVisible(false)}><Text style={styles.btnTextCancel}>Cancelar</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.btn, { backgroundColor: darkMode ? '#FFF' : '#1E1E1E' }]} onPress={handleGuardarMeta}><Text style={[styles.btnTextSave, { color: darkMode ? '#000' : '#FFF' }]}>Actualizar</Text></TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Modal de Alerta Unificada */}
            <Modal animationType="fade" transparent={true} visible={alertVisible}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.customAlertBox, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                        <Text style={[styles.customAlertTitle, { color: darkMode ? '#FFF' : '#000' }]}>{alertConfig.title}</Text>
                        <Text style={[styles.customAlertMessage, { color: darkMode ? '#A0A0A0' : '#666' }]}>{alertConfig.message}</Text>
                        <TouchableOpacity style={[styles.alertBtn, { backgroundColor: darkMode ? '#FFF' : '#1E1E1E', width: '100%' }]} onPress={() => { setAlertVisible(false); if (alertConfig.onConfirm) alertConfig.onConfirm(); }}>
                            <Text style={{ color: darkMode ? '#000' : '#FFF', fontWeight: 'bold' }}>Aceptar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 100 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 0, marginBottom: 25 },
    greeting: { fontSize: 13, marginBottom: 2 },
    driverName: { fontSize: 18, fontWeight: 'bold' },
    profileIcon: { padding: 2 },
    profileAvatarImage: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#4CAF50' }, // Estilo para la foto en Home
    metaCard: { borderRadius: 16, padding: 15, marginBottom: 20 },
    metaTitulo: { fontSize: 15, fontWeight: 'bold' },
    progressBarBackground: { height: 8, backgroundColor: '#333', borderRadius: 4, overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 4 },
    metaSub: { fontSize: 11, marginTop: 8 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 15, marginBottom: 15 },
    pendingCard: { flexDirection: 'row', padding: 15, borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 },
    iconContainer: { padding: 10, borderRadius: 12, marginRight: 15 },
    pendingInfo: { flex: 1 },
    pendingTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    pendingDesc: { fontSize: 13, color: '#FF9800' },
    movimientoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 14, marginBottom: 8 },
    movNota: { fontSize: 14, fontWeight: '600' },
    movFecha: { fontSize: 11, color: '#888' },
    movMonto: { fontSize: 15, fontWeight: 'bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { padding: 25, borderRadius: 20 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    input: { padding: 14, borderRadius: 10, marginBottom: 15, fontSize: 15, borderWidth: 1 },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    btn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', marginHorizontal: 5 },
    btnCancel: {},
    btnTextCancel: { color: '#F44336', fontWeight: 'bold' },
    btnTextSave: { fontWeight: 'bold' },
    customAlertBox: { padding: 25, borderRadius: 24, alignItems: 'center', elevation: 10 },
    customAlertTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    customAlertMessage: { fontSize: 14, textAlign: 'center', marginBottom: 25, lineHeight: 20 },
    alertBtn: { padding: 14, borderRadius: 12, alignItems: 'center' }
});