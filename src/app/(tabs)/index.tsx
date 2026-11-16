import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import BalanceCard from '../components/BalanceCard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { programarNotificacionPospuesta, RecordatorioGarage } from '@/services/notificacionesService';
import {
    Movimiento,
    obtenerUltimosMovimientos,
    sumarIngresosDelMes,
    sumarGastosDelMes,
    debugDatabase,
    insertarMovimientoRapido
} from '@/db/database';

interface MetaItem {
    id: string;
    titulo: string;
    monto: string;
    acumulado: string;
    fecha: string;
}

export default function Home() {
    const router = useRouter();
    const { darkMode } = useTheme();

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [nombreConductor, setNombreConductor] = useState('Conductor');
    const [avatarUri, setAvatarUri] = useState<string | null>(null);

    const [neto, setNeto] = useState(0);
    const [metaMensual, setMetaMensual] = useState(15000);
    const [porcentajeMeta, setPorcentajeMeta] = useState(0);
    const [ultimosMovimientos, setUltimosMovimientos] = useState<Movimiento[]>([]);

    // Estados para Metas Adicionales
    const [metasList, setMetasList] = useState<MetaItem[]>([]);
    const [modalAbonarMetaVisible, setModalAbonarMetaVisible] = useState(false);
    const [metaEditId, setMetaEditId] = useState<string | null>(null);
    const [abonoInput, setAbonoInput] = useState('');
    const [metaActivaTitulo, setMetaActivaTitulo] = useState('');

    // --- ESTADOS MODAL RECORDATORIOS DEL DÍA ---
    const [recordatoriosHoy, setRecordatoriosHoy] = useState<RecordatorioGarage[]>([]);
    const [modalRecordatoriosVisible, setModalRecordatoriosVisible] = useState(false);

    const [reservaReciente, setReservaReciente] = useState<any>(null);

    const [modalMetaVisible, setModalMetaVisible] = useState(false);
    const [metaInput, setMetaInput] = useState('');

    const [modalRapidoVisible, setModalRapidoVisible] = useState(false);
    const [tipoRapido, setTipoRapido] = useState<'INGRESO' | 'GASTO'>('GASTO');
    const [montoRapido, setMontoRapido] = useState('');
    const [notaRapida, setNotaRapida] = useState('');

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

    const obtenerFechaLocalYYYYMMDD = () => {
        const hoy = new Date();
        const y = hoy.getFullYear();
        const m = String(hoy.getMonth() + 1).padStart(2, '0');
        const d = String(hoy.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    useFocusEffect(
        useCallback(() => {
            verificarSesionActiva();
            cargarDatosFinancieros();
            cargarMetasAdicionales();
            verificarRecordatoriosDelDia();
        }, [])
    );

    useEffect(() => {
        const handleDeepLink = (event: { url: string }) => {
            let data = Linking.parse(event.url);
            if (data.path === 'add' || data.hostname === 'add') {
                const tipo = data.queryParams?.tipo as 'INGRESO' | 'GASTO';
                if (tipo) {
                    setTipoRapido(tipo);
                    setModalRapidoVisible(true);
                }
            }
        };

        const subscription = Linking.addEventListener('url', handleDeepLink);
        Linking.getInitialURL().then((url) => {
            if (url) handleDeepLink({ url });
        });

        return () => {
            subscription.remove();
        };
    }, []);

    // 🔥 DETECTOR DE RECORDATORIOS AL ABRIR LA APP
    const verificarRecordatoriosDelDia = async () => {
        try {
            const stored = await AsyncStorage.getItem('lista_recordatorios_garage');
            if (!stored) {
                setRecordatoriosHoy([]);
                return;
            }

            const lista: RecordatorioGarage[] = JSON.parse(stored);
            const hoyDiaSemana = new Date().getDay(); // 0 (Dom) a 6 (Sáb)
            const hoyStr = obtenerFechaLocalYYYYMMDD();
            const ahoraMs = Date.now();

            const pendientes = lista.filter(r => {
                const tocaHoy = r.frecuencia === 'DIARIO' || Number(r.frecuencia) === hoyDiaSemana;
                const noCompletadoHoy = r.ultimoCheck !== hoyStr;
                const noPospuestoActivamente = !r.pospuestoHasta || ahoraMs >= r.pospuestoHasta;
                return tocaHoy && noCompletadoHoy && noPospuestoActivamente;
            });

            setRecordatoriosHoy(pendientes);
            if (pendientes.length > 0) {
                setModalRecordatoriosVisible(true);
            }
        } catch (e) {
            console.log("Error verificando recordatorios:", e);
        }
    };

    // ✅ MARCAR RECORDATORIO COMO HECHO
    const handleCheckRecordatorio = async (id: string) => {
        try {
            const stored = await AsyncStorage.getItem('lista_recordatorios_garage');
            if (!stored) return;

            const hoyStr = obtenerFechaLocalYYYYMMDD();
            const lista: RecordatorioGarage[] = JSON.parse(stored);

            const nuevaLista = lista.map(r => {
                if (r.id === id) {
                    return { ...r, ultimoCheck: hoyStr, pospuestoHasta: undefined };
                }
                return r;
            });

            await AsyncStorage.setItem('lista_recordatorios_garage', JSON.stringify(nuevaLista));

            const restantes = recordatoriosHoy.filter(r => r.id !== id);
            setRecordatoriosHoy(restantes);

            if (restantes.length === 0) {
                setModalRecordatoriosVisible(false);
            }
        } catch (e) {
            console.log(e);
        }
    };

    // ⏳ POSPONER RECORDATORIO POR 3 HORAS + NOTIFICACIÓN DE RESCATE
    const handlePosponerRecordatorio = async (item: RecordatorioGarage) => {
        try {
            const stored = await AsyncStorage.getItem('lista_recordatorios_garage');
            if (!stored) return;

            const tresHorasMs = 3 * 60 * 60 * 1000;
            const nuevoTiempo = Date.now() + tresHorasMs;

            const lista: RecordatorioGarage[] = JSON.parse(stored);
            const nuevaLista = lista.map(r => {
                if (r.id === item.id) {
                    return { ...r, pospuestoHasta: nuevoTiempo };
                }
                return r;
            });

            await AsyncStorage.setItem('lista_recordatorios_garage', JSON.stringify(nuevaLista));

            // Programamos alerta para dentro de 3 horas
            await programarNotificacionPospuesta(item.titulo, 3);

            const restantes = recordatoriosHoy.filter(r => r.id !== item.id);
            setRecordatoriosHoy(restantes);

            if (restantes.length === 0) {
                setModalRecordatoriosVisible(false);
            }
        } catch (e) {
            console.log(e);
        }
    };

    const verificarSesionActiva = async () => {
        try {
            const token = await AsyncStorage.getItem('user_token');
            const nombreGuardado = await AsyncStorage.getItem('conductor_nombre');
            const fotoGuardada = await AsyncStorage.getItem('conductor_foto');

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
            setUltimosMovimientos(obtenerUltimosMovimientos());

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

    const cargarMetasAdicionales = async () => {
        try {
            const stored = await AsyncStorage.getItem('lista_metas_adicionales');
            if (stored) setMetasList(JSON.parse(stored));
        } catch (e) {
            console.log(e);
        }
    };

    const openAbonarMeta = (meta: MetaItem) => {
        setMetaEditId(meta.id);
        setMetaActivaTitulo(meta.titulo);
        setAbonoInput('');
        setModalAbonarMetaVisible(true);
    };

    const handleAbonarMeta = async () => {
        if (!abonoInput || isNaN(Number(abonoInput))) {
            mostrarAlerta('Error', 'Ingresa un monto válido para abonar.', 'error');
            return;
        }

        const montoAbono = Number(abonoInput);
        let metaCompletada = false;

        const nuevaLista = metasList.map(m => {
            if (m.id === metaEditId) {
                const nuevoAcumulado = Number(m.acumulado || 0) + montoAbono;
                if (nuevoAcumulado >= Number(m.monto)) {
                    metaCompletada = true;
                }
                return { ...m, acumulado: String(nuevoAcumulado) };
            }
            return m;
        });

        await AsyncStorage.setItem('lista_metas_adicionales', JSON.stringify(nuevaLista));
        setMetasList(nuevaLista);
        setModalAbonarMetaVisible(false);

        if (metaCompletada) {
            mostrarAlerta('¡Felicidades!', `¡Has logrado tu meta: ${metaActivaTitulo}! Eres un maestro del ahorro.`, 'success');
        } else {
            mostrarAlerta('Abono Exitoso', `Se sumaron $${montoAbono} a tu meta. ¡Sigue así!`, 'success');
        }
    };

    const guardarMovimientoRapido = () => {
        if (!montoRapido || isNaN(Number(montoRapido))) {
            mostrarAlerta("Error", "Ingresa un monto válido.", "error"); return;
        }
        insertarMovimientoRapido(tipoRapido, parseFloat(montoRapido), notaRapida || (tipoRapido === 'INGRESO' ? 'Ingreso rápido' : 'Gasto rápido'));
        setMontoRapido(''); setNotaRapida(''); setModalRapidoVisible(false);
        cargarDatosFinancieros();
        mostrarAlerta("¡Éxito!", "Movimiento guardado correctamente.", "success");
    };

    const cargarReservaReciente = async (token: string) => {
        try {
            const response = await fetch('https://www.jrtechnology.duckdns.org/drivewallet/api/privado/reservas?estado=PENDIENTE', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                if (data && data.length > 0) setReservaReciente(data[0]);
                else setReservaReciente(null);
            }
        } catch (error) {
            console.error("Error al cargar reserva reciente:", error);
        }
    };

    const handleGuardarMetaMensual = async () => {
        if (!metaInput || isNaN(Number(metaInput))) return;
        const nuevaMeta = parseFloat(metaInput);
        await AsyncStorage.setItem('meta_mensual', nuevaMeta.toString());
        setModalMetaVisible(false);
        cargarDatosFinancieros();
    };

    const fechaActual = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const fechaFormateada = fechaActual.charAt(0).toUpperCase() + fechaActual.slice(1);

    const formatMoney = (val: number | string) => {
        return `$${Number(val).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: darkMode ? '#121212' : '#F5F7FA' }]}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

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

                {/* Banner rápido si cerró el modal con la X pero aún tiene chequeos hoy */}
                {recordatoriosHoy.length > 0 && !modalRecordatoriosVisible && (
                    <TouchableOpacity
                        style={[styles.reminderBanner, { backgroundColor: darkMode ? '#1A2E35' : '#E0F7FA', borderColor: '#00BCD4' }]}
                        onPress={() => setModalRecordatoriosVisible(true)}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Ionicons name="car-sport" size={22} color="#00BCD4" style={{ marginRight: 10 }} />
                            <Text style={{ color: darkMode ? '#FFF' : '#006064', fontWeight: '600', fontSize: 13, flex: 1 }}>
                                Tienes {recordatoriosHoy.length} {recordatoriosHoy.length === 1 ? 'chequeo pendiente' : 'chequeos pendientes'} hoy
                            </Text>
                        </View>
                        <Text style={{ color: '#00BCD4', fontWeight: 'bold', fontSize: 12 }}>Ver</Text>
                    </TouchableOpacity>
                )}

                <BalanceCard amount={formatMoney(neto)} onMovimientoGuardado={cargarDatosFinancieros} />

                <TouchableOpacity activeOpacity={0.8} onPress={() => setModalMetaVisible(true)}>
                    <View style={[styles.metaCard, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={[styles.metaTitulo, { color: darkMode ? '#FFF' : '#000' }]}>Meta Ganancia Mensual</Text>
                                <Ionicons name="pencil-outline" size={14} color="#888" style={{ marginLeft: 6 }} />
                            </View>
                            <Text style={{ color: '#4CAF50', fontWeight: 'bold' }}>{porcentajeMeta}%</Text>
                        </View>
                        <View style={styles.progressBarBackground}>
                            <View style={[styles.progressBarFill, { width: `${porcentajeMeta}%` }]} />
                        </View>
                        <Text style={[styles.metaSub, { color: darkMode ? '#888' : '#666' }]}>Meta global: {formatMoney(metaMensual)} (Toca para editar)</Text>
                    </View>
                </TouchableOpacity>

                {/* --- SECCIÓN CARRUSEL OTRAS METAS CON BARRA DE PROGRESO --- */}
                <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionTitle, { color: darkMode ? '#FFF' : '#000', marginTop: 0, marginBottom: 0 }]}>Mis Metas Adicionales</Text>
                </View>

                {metasList.length === 0 ? (
                    <Text style={{ color: '#888', fontSize: 13, marginTop: 5, marginBottom: 20 }}>No tienes metas extras configuradas. Créalas en tu Garage.</Text>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                        {metasList.map((item) => {
                            const acumulado = Number(item.acumulado || 0);
                            const metaTotal = Number(item.monto || 1);
                            let porcentaje = Math.round((acumulado / metaTotal) * 100);
                            if (porcentaje > 100) porcentaje = 100;

                            return (
                                <TouchableOpacity key={item.id} activeOpacity={0.8} onPress={() => openAbonarMeta(item)}>
                                    <View style={[styles.metaExtraCard, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <View style={[styles.iconContainer, { backgroundColor: '#9C27B020', padding: 8, borderRadius: 10, marginRight: 0 }]}>
                                                <Ionicons name="star" size={20} color="#9C27B0" />
                                            </View>
                                            <Text style={{ color: '#9C27B0', fontWeight: 'bold', fontSize: 13, marginTop: 5 }}>{porcentaje}%</Text>
                                        </View>
                                        <Text style={[styles.metaExtraTitle, { color: darkMode ? '#FFF' : '#000' }]} numberOfLines={1}>{item.titulo}</Text>
                                        <Text style={[styles.metaExtraMonto, { color: '#9C27B0' }]}>{formatMoney(acumulado)}</Text>

                                        <View style={styles.miniProgressBarBg}>
                                            <View style={[styles.miniProgressBarFill, { width: `${porcentaje}%` }]} />
                                        </View>

                                        <Text style={styles.metaExtraFecha} numberOfLines={1}>Objetivo: {formatMoney(metaTotal)}</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}

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

            {/* 🔥 MODAL AUTOMÁTICO DE RECORDATORIOS DEL DÍA (AL ABRIR LA APP) */}
            <Modal animationType="fade" transparent={true} visible={modalRecordatoriosVisible}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF', paddingBottom: 20 }]}>
                        {/* Cabecera con botón X */}
                        <View style={styles.recModalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={styles.recHeaderIcon}>
                                    <Ionicons name="car-sport" size={22} color="#00BCD4" />
                                </View>
                                <View>
                                    <Text style={[styles.recModalTitle, { color: darkMode ? '#FFF' : '#000' }]}>Chequeo de Hoy</Text>
                                    <Text style={{ color: '#888', fontSize: 12 }}>Antes de salir a rodar</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => setModalRecordatoriosVisible(false)} style={styles.closeModalBtn}>
                                <Ionicons name="close" size={24} color={darkMode ? '#AAA' : '#666'} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 300, marginVertical: 10 }} showsVerticalScrollIndicator={false}>
                            {recordatoriosHoy.map((item) => (
                                <View key={item.id} style={[styles.recModalItem, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA' }]}>
                                    <Text style={[styles.recModalItemText, { color: darkMode ? '#FFF' : '#000' }]}>
                                        {item.titulo}
                                    </Text>
                                    <View style={styles.recModalActions}>
                                        {/* Botón Posponer 3h */}
                                        <TouchableOpacity
                                            style={[styles.snoozeBtn, { backgroundColor: darkMode ? '#332B1A' : '#FFF3E0' }]}
                                            onPress={() => handlePosponerRecordatorio(item)}
                                        >
                                            <Ionicons name="time-outline" size={16} color="#FF9800" />
                                            <Text style={styles.snoozeBtnText}>3h</Text>
                                        </TouchableOpacity>

                                        {/* Botón Check */}
                                        <TouchableOpacity
                                            style={styles.checkBtn}
                                            onPress={() => handleCheckRecordatorio(item.id)}
                                        >
                                            <Ionicons name="checkmark" size={20} color="#FFF" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>

                        <Text style={{ color: '#888', fontSize: 11, textAlign: 'center', marginTop: 6 }}>
                            Marca con ✓ lo que ya revisaste o posponlo 3 horas con el reloj.
                        </Text>
                    </View>
                </View>
            </Modal>

            {/* MODAL: DEFINIR META MENSUAL */}
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
                            <TouchableOpacity style={[styles.btn, { backgroundColor: darkMode ? '#FFF' : '#1E1E1E' }]} onPress={handleGuardarMetaMensual}><Text style={[styles.btnTextSave, { color: darkMode ? '#000' : '#FFF' }]}>Actualizar</Text></TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* MODAL: ABONAR A META ADICIONAL */}
            <Modal animationType="slide" transparent={true} visible={modalAbonarMetaVisible}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                        <Text style={[styles.modalTitle, { color: darkMode ? '#FFF' : '#000', marginBottom: 5 }]}>Abonar a tu Meta</Text>
                        <Text style={{ color: darkMode ? '#888' : '#666', textAlign: 'center', marginBottom: 20 }}>{metaActivaTitulo}</Text>

                        <TextInput
                            style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE', fontSize: 24, textAlign: 'center', paddingVertical: 18 }]}
                            placeholder="RD$ 0.00"
                            placeholderTextColor="#A0A0A0"
                            keyboardType="numeric"
                            value={abonoInput}
                            onChangeText={setAbonoInput}
                        />

                        <View style={[styles.modalButtons, { marginTop: 15 }]}>
                            <TouchableOpacity style={[styles.btn, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F5F5' }]} onPress={() => setModalAbonarMetaVisible(false)}>
                                <Text style={[styles.btnTextCancel, { color: darkMode ? '#AAA' : '#666' }]}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btn, { backgroundColor: '#9C27B0' }]} onPress={handleAbonarMeta}>
                                <Text style={[styles.btnTextSave, { color: '#FFF' }]}>Abonar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* --- MODAL DE REGISTRO RÁPIDO (WIDGET) --- */}
            <Modal animationType="slide" transparent={true} visible={modalRapidoVisible}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                        <Text style={[styles.modalTitle, { color: darkMode ? '#FFF' : '#000' }]}>Registro Rápido</Text>

                        <View style={{ flexDirection: 'row', marginBottom: 15, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#444' }}>
                            <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: tipoRapido === 'INGRESO' ? '#4CAF50' : 'transparent', alignItems: 'center' }} onPress={() => setTipoRapido('INGRESO')}>
                                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Ingreso</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: tipoRapido === 'GASTO' ? '#E57373' : 'transparent', alignItems: 'center' }} onPress={() => setTipoRapido('GASTO')}>
                                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Gasto</Text>
                            </TouchableOpacity>
                        </View>

                        <TextInput style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]} placeholder="Monto (Ej. 350)" placeholderTextColor="#A0A0A0" keyboardType="numeric" value={montoRapido} onChangeText={setMontoRapido} />
                        <TextInput style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]} placeholder="Comentario / Nota (Opcional)" placeholderTextColor="#A0A0A0" value={notaRapida} onChangeText={setNotaRapida} />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setModalRapidoVisible(false)}>
                                <Text style={styles.btnTextCancel}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btn, { backgroundColor: darkMode ? '#FFF' : '#1E1E1E' }]} onPress={guardarMovimientoRapido}>
                                <Text style={[styles.btnTextSave, { color: darkMode ? '#000' : '#FFF' }]}>Guardar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Modal de Alerta Unificada */}
            <Modal animationType="fade" transparent={true} visible={alertVisible}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.customAlertBox, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                        {alertConfig.type !== 'confirm' && (
                            <View style={[styles.iconContainer, { backgroundColor: alertConfig.type === 'error' ? (darkMode ? '#3A1A1A' : '#FFEBEE') : (darkMode ? '#1A3320' : '#E8F5E9') }]}>
                                <Ionicons name={alertConfig.type === 'error' ? 'alert-circle' : 'checkmark-circle'} size={32} color={alertConfig.type === 'error' ? '#F44336' : '#4CAF50'} />
                            </View>
                        )}
                        <Text style={[styles.customAlertTitle, { color: darkMode ? '#FFF' : '#000' }]}>{alertConfig.title}</Text>
                        <Text style={[styles.customAlertMessage, { color: darkMode ? '#A0A0A0' : '#666' }]}>{alertConfig.message}</Text>

                        {alertConfig.type === 'confirm' ? (
                            <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
                                <TouchableOpacity style={[styles.alertBtn, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F5F5', flex: 1, marginRight: 10 }]} onPress={() => setAlertVisible(false)}>
                                    <Text style={{ color: darkMode ? '#AAA' : '#666', fontWeight: 'bold', textAlign: 'center' }}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.alertBtn, { backgroundColor: '#F44336', flex: 1 }]} onPress={() => { setAlertVisible(false); if (alertConfig.onConfirm) alertConfig.onConfirm(); }}>
                                    <Text style={{ color: '#FFF', fontWeight: 'bold', textAlign: 'center' }}>Sí, eliminar</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity style={[styles.alertBtn, { backgroundColor: darkMode ? '#FFF' : '#1E1E1E', width: '100%' }]} onPress={() => { setAlertVisible(false); if (alertConfig.onConfirm) alertConfig.onConfirm(); }}>
                                <Text style={{ color: darkMode ? '#000' : '#FFF', fontWeight: 'bold' }}>Aceptar</Text>
                            </TouchableOpacity>
                        )}
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
    profileAvatarImage: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#4CAF50' },

    reminderBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 18 },

    metaCard: { borderRadius: 16, padding: 15, marginBottom: 20 },
    metaTitulo: { fontSize: 15, fontWeight: 'bold' },
    progressBarBackground: { height: 8, backgroundColor: '#333', borderRadius: 4, overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 4 },
    metaSub: { fontSize: 11, marginTop: 8 },

    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, marginBottom: 15 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 15, marginBottom: 15 },

    metaExtraCard: { width: 180, padding: 15, borderRadius: 16, marginRight: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
    metaExtraTitle: { fontSize: 15, fontWeight: 'bold', marginTop: 12, marginBottom: 4 },
    metaExtraMonto: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
    metaExtraFecha: { fontSize: 11, color: '#888', marginTop: 8 },
    miniProgressBarBg: { height: 6, backgroundColor: '#EEE', borderRadius: 3, overflow: 'hidden' },
    miniProgressBarFill: { height: '100%', backgroundColor: '#9C27B0', borderRadius: 3 },

    pendingCard: { flexDirection: 'row', padding: 15, borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 },
    iconContainer: { padding: 10, borderRadius: 12, marginRight: 15 },
    pendingInfo: { flex: 1 },
    pendingTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    pendingDesc: { fontSize: 13, color: '#FF9800' },

    movimientoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 14, marginBottom: 8 },
    movNota: { fontSize: 14, fontWeight: '600' },
    movFecha: { fontSize: 11, color: '#888' },
    movMonto: { fontSize: 15, fontWeight: 'bold' },

    // Estilos Modal de Recordatorios
    recModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    recHeaderIcon: { backgroundColor: '#00BCD420', padding: 10, borderRadius: 12, marginRight: 12 },
    recModalTitle: { fontSize: 18, fontWeight: 'bold' },
    closeModalBtn: { padding: 6, borderRadius: 20 },
    recModalItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 14, marginBottom: 10 },
    recModalItemText: { fontSize: 14, fontWeight: '600', flex: 1, marginRight: 10 },
    recModalActions: { flexDirection: 'row', alignItems: 'center' },
    snoozeBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, marginRight: 8 },
    snoozeBtnText: { color: '#FF9800', fontWeight: 'bold', fontSize: 12, marginLeft: 4 },
    checkBtn: { backgroundColor: '#4CAF50', width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { padding: 25, borderRadius: 20 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    input: { padding: 14, borderRadius: 10, marginBottom: 15, fontSize: 15, borderWidth: 1 },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    btn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginHorizontal: 8 },
    btnCancel: {},
    btnTextCancel: { color: '#F44336', fontWeight: 'bold' },
    btnTextSave: { fontWeight: 'bold' },
    customAlertBox: { padding: 25, borderRadius: 24, alignItems: 'center', elevation: 10 },
    customAlertTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    customAlertMessage: { fontSize: 14, textAlign: 'center', marginBottom: 25, lineHeight: 20 },
    alertBtn: { padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }
});