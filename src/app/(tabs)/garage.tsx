import React, { useState, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform,
    AppState
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { insertarMovimientoRapido } from '@/db/database';
import { sincronizarNotificaciones4AM, RecordatorioGarage } from '@/services/notificacionesService';

interface PagoItem {
    id: string;
    tipo: string;
    monto: string;
    fecha: string;
    banco: string;
    cuenta: string;
}

interface MetaItem {
    id: string;
    titulo: string;
    monto: string;
    acumulado: string;
    fecha: string;
}

const DIAS_OPCIONES = [
    { label: 'Lun', value: '1' },
    { label: 'Mar', value: '2' },
    { label: 'Mié', value: '3' },
    { label: 'Jue', value: '4' },
    { label: 'Vie', value: '5' },
    { label: 'Sáb', value: '6' },
    { label: 'Dom', value: '0' },
    { label: 'Diario', value: 'DIARIO' },
];

const PLANTILLAS_RAPIDAS = [
    'Chequear agua/coolant',
    'Nivel de aceite',
    'Presión de gomas',
    'Líquido de frenos'
];

export default function Garage() {
    const { darkMode } = useTheme();
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedItem, setSelectedItem] = useState('');

    const [vehiculoTexto, setVehiculoTexto] = useState('Cargando...');
    const [placaVehiculo, setPlacaVehiculo] = useState('--');
    const [kilometraje, setKilometraje] = useState('0 km');

    const [subAceite, setSubAceite] = useState('Sin configurar');
    const [subTransmision, setSubTransmision] = useState('Sin configurar');
    const [subSeguro, setSubSeguro] = useState('Sin configurar');

    const [pagosList, setPagosList] = useState<PagoItem[]>([]);
    const [pagoEditId, setPagoEditId] = useState<string | null>(null);

    const [metasList, setMetasList] = useState<MetaItem[]>([]);
    const [metaEditId, setMetaEditId] = useState<string | null>(null);

    // --- ESTADOS RECORDATORIOS RÁPIDOS (1 LÍNEA) ---
    const [recordatoriosList, setRecordatoriosList] = useState<RecordatorioGarage[]>([]);
    const [nuevoRecTexto, setNuevoRecTexto] = useState('');
    const [diaIndex, setDiaIndex] = useState(0); // 0 = Lunes por defecto

    const [input1, setInput1] = useState('');
    const [input2, setInput2] = useState('');
    const [input3, setInput3] = useState('');
    const [input4, setInput4] = useState('');
    const [input5, setInput5] = useState('');
    const [inputTipoPago, setInputTipoPago] = useState('Préstamo');

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
            cargarDatosGarage();
        }, [])
    );

    // Recarga los datos automáticamente cuando la app vuelve del fondo (Background -> Active)
    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active') {
                cargarDatosGarage();
            }
        });
        return () => subscription.remove();
    }, []);

    const cargarDatosGarage = async () => {
        try {
            const brand = await AsyncStorage.getItem('vehicle_brand') || 'Toyota';
            const model = await AsyncStorage.getItem('vehicle_model') || 'Sonata';
            const year = await AsyncStorage.getItem('vehicle_year') || '2016';
            const plate = await AsyncStorage.getItem('vehicle_plate') || 'A123456';

            const aceiteKm = await AsyncStorage.getItem('aceite_km');
            const kmGeneral = await AsyncStorage.getItem('vehiculo_kilometraje');
            const kmFinal = aceiteKm ? `${Number(aceiteKm).toLocaleString()} km` : (kmGeneral || '125,000 km');

            setVehiculoTexto(`${brand} ${model} ${year}`);
            setPlacaVehiculo(plate);
            setKilometraje(kmFinal);

            const aceiteTipo = await AsyncStorage.getItem('aceite_tipo');
            const aceiteFecha = await AsyncStorage.getItem('aceite_fecha');
            if (aceiteTipo || aceiteKm || aceiteFecha) {
                setSubAceite(`Tipo: ${aceiteTipo || 'N/D'} | Meta: ${aceiteKm ? Number(aceiteKm).toLocaleString() + ' km' : 'N/D'} | Próx: ${aceiteFecha || 'N/D'}`);
            } else {
                setSubAceite('Toca para configurar tipo y próximo cambio');
            }

            const transFecha = await AsyncStorage.getItem('transmision_fecha');
            const transNotas = await AsyncStorage.getItem('transmision_notas');
            if (transFecha || transNotas) {
                setSubTransmision(`Próximo: ${transFecha || 'N/D'} | ${transNotas || ''}`);
            } else {
                setSubTransmision('Toca para configurar fecha y observaciones');
            }

            const seguroComp = await AsyncStorage.getItem('seguro_compania');
            const seguroVenc = await AsyncStorage.getItem('seguro_vencimiento');
            if (seguroComp || seguroVenc) {
                setSubSeguro(`Aseguradora: ${seguroComp || 'N/D'} | Vence: ${seguroVenc || 'N/D'}`);
            } else {
                setSubSeguro('Toca para configurar aseguradora y vencimiento');
            }

            const pagosGuardados = await AsyncStorage.getItem('lista_pagos_pendientes');
            setPagosList(pagosGuardados ? JSON.parse(pagosGuardados) : []);

            const metasGuardadas = await AsyncStorage.getItem('lista_metas_adicionales');
            setMetasList(metasGuardadas ? JSON.parse(metasGuardadas) : []);

            const recGuardados = await AsyncStorage.getItem('lista_recordatorios_garage');
            setRecordatoriosList(recGuardados ? JSON.parse(recGuardados) : []);

        } catch (error) {
            console.error("Error al cargar garage:", error);
        }
    };

    const handleAgregarRecordatorioRapido = async () => {
        const textoOriginal = nuevoRecTexto.trim();
        if (!textoOriginal) {
            mostrarAlerta("Campo vacío", "Escribe o selecciona un recordatorio rápido.", "error");
            return;
        }

        const frecuenciaElegida = DIAS_OPCIONES[diaIndex].value;
        const nombreDiaElegido = DIAS_OPCIONES[diaIndex].label;
        const textoNormalizado = textoOriginal.toLowerCase();

        const duplicado = recordatoriosList.find(r => {
            const mismoTexto = r.titulo.trim().toLowerCase() === textoNormalizado;
            if (!mismoTexto) return false;

            return (
                r.frecuencia === frecuenciaElegida ||
                r.frecuencia === 'DIARIO' ||
                frecuenciaElegida === 'DIARIO'
            );
        });

        if (duplicado) {
            const motivo = duplicado.frecuencia === 'DIARIO'
                ? 'ya está activo en modo Diario (todos los días).'
                : frecuenciaElegida === 'DIARIO'
                    ? `ya existe para los ${obtenerNombreFrecuencia(duplicado.frecuencia)}. Elimínalo primero si quieres pasarlo a Diario.`
                    : `ya está registrado para los ${nombreDiaElegido}.`;

            mostrarAlerta("Ya existe", `El chequeo "${textoOriginal}" ${motivo}`, "error");
            return;
        }

        const nuevoItem: RecordatorioGarage = {
            id: Date.now().toString(),
            titulo: textoOriginal,
            frecuencia: frecuenciaElegida,
        };

        const nuevaLista = [...recordatoriosList, nuevoItem];
        await AsyncStorage.setItem('lista_recordatorios_garage', JSON.stringify(nuevaLista));
        setRecordatoriosList(nuevaLista);
        setNuevoRecTexto('');

        await sincronizarNotificaciones4AM(nuevaLista);
    };

    const handleEliminarRecordatorio = async (id: string) => {
        const nuevaLista = recordatoriosList.filter(r => r.id !== id);
        await AsyncStorage.setItem('lista_recordatorios_garage', JSON.stringify(nuevaLista));
        setRecordatoriosList(nuevaLista);
        await sincronizarNotificaciones4AM(nuevaLista);
    };

    const rotarDia = () => {
        setDiaIndex((prev) => (prev + 1) % DIAS_OPCIONES.length);
    };

    const obtenerNombreFrecuencia = (frec: string) => {
        const encontrado = DIAS_OPCIONES.find(d => d.value === frec);
        return encontrado ? encontrado.label : 'Lun';
    };

    const openEdit = async (title: string) => {
        setSelectedItem(title);
        setInput1(''); setInput2(''); setInput3(''); setInput4(''); setInput5('');

        if (title === 'Aceite de Motor') {
            setInput1(await AsyncStorage.getItem('aceite_tipo') || '');
            setInput2(await AsyncStorage.getItem('aceite_km') || '');
            setInput3(await AsyncStorage.getItem('aceite_fecha') || '');
        } else if (title === 'Transmisión') {
            setInput1(await AsyncStorage.getItem('transmision_fecha') || '');
            setInput2(await AsyncStorage.getItem('transmision_notas') || '');
        } else if (title === 'Seguro del Vehículo') {
            setInput1(await AsyncStorage.getItem('seguro_compania') || '');
            setInput2(await AsyncStorage.getItem('seguro_vencimiento') || '');
        }
        setModalVisible(true);
    };

    const openNuevoPago = () => {
        setSelectedItem('Pago Pendiente');
        setPagoEditId(null);
        setInputTipoPago('Préstamo');
        setInput1(''); setInput2(''); setInput3(''); setInput4('');
        setModalVisible(true);
    };

    const openEditarPago = (pago: PagoItem) => {
        setSelectedItem('Pago Pendiente');
        setPagoEditId(pago.id);
        setInputTipoPago(pago.tipo);
        setInput1(pago.monto); setInput2(pago.fecha); setInput3(pago.banco); setInput4(pago.cuenta);
        setModalVisible(true);
    };

    const handleEliminarPago = () => {
        mostrarAlerta("Eliminar Pago", "¿Estás seguro de que deseas eliminar este pago?", "confirm", async () => {
            const nuevaLista = pagosList.filter(p => p.id !== pagoEditId);
            await AsyncStorage.setItem('lista_pagos_pendientes', JSON.stringify(nuevaLista));
            setPagosList(nuevaLista);
            setModalVisible(false);
            mostrarAlerta("Eliminado", "El pago ha sido borrado de tus registros.", "success");
        });
    };

    const handlePagarCuota = () => {
        if (!pagoEditId) return;

        const pagoIndex = pagosList.findIndex(p => p.id === pagoEditId);
        if (pagoIndex === -1) return;
        const pago = pagosList[pagoIndex];

        const partes = pago.fecha.split('/');
        if (partes.length !== 3) {
            mostrarAlerta("Error de Fecha", "La fecha debe estar en formato DD/MM/AAAA para poder avanzar el mes.", "error");
            return;
        }

        mostrarAlerta("Registrar Pago", `¿Confirmas que pagaste los $${pago.monto} de este mes? Se registrará como gasto y la fecha avanzará.`, "confirm", async () => {
            let d = Number(partes[0]);
            let m = Number(partes[1]);
            let y = Number(partes[2]);

            m += 1;
            if (m > 12) {
                m = 1;
                y += 1;
            }

            const daysInNextMonth = new Date(y, m, 0).getDate();
            if (d > daysInNextMonth) {
                d = daysInNextMonth;
            }

            const nuevaFecha = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;

            const nuevaLista = [...pagosList];
            nuevaLista[pagoIndex].fecha = nuevaFecha;

            await AsyncStorage.setItem('lista_pagos_pendientes', JSON.stringify(nuevaLista));
            setPagosList(nuevaLista);

            insertarMovimientoRapido('GASTO', Number(pago.monto), `Cuota ${pago.tipo}: ${pago.banco}`);

            setModalVisible(false);
            mostrarAlerta("Pago Exitoso", `Gasto registrado. Próximo cobro movido al ${nuevaFecha}.`, "success");
        });
    };

    const openNuevaMeta = () => {
        setSelectedItem('Meta Adicional');
        setMetaEditId(null);
        setInput1(''); setInput2(''); setInput3(''); setInput5('0');
        setModalVisible(true);
    };

    const openEditarMeta = (meta: MetaItem) => {
        setSelectedItem('Meta Adicional');
        setMetaEditId(meta.id);
        setInput1(meta.titulo); setInput2(meta.monto); setInput3(meta.fecha); setInput5(meta.acumulado || '0');
        setModalVisible(true);
    };

    const handleEliminarMeta = () => {
        mostrarAlerta("Eliminar Meta", "¿Estás seguro de que deseas eliminar esta meta?", "confirm", async () => {
            const nuevaLista = metasList.filter(m => m.id !== metaEditId);
            await AsyncStorage.setItem('lista_metas_adicionales', JSON.stringify(nuevaLista));
            setMetasList(nuevaLista);
            setModalVisible(false);
            mostrarAlerta("Eliminada", "La meta ha sido borrada de tus registros.", "success");
        });
    };

    const handleGuardar = async () => {
        try {
            if (selectedItem === 'Aceite de Motor') {
                await AsyncStorage.setItem('aceite_tipo', input1);
                await AsyncStorage.setItem('aceite_km', input2);
                await AsyncStorage.setItem('aceite_fecha', input3);
                if (input2) await AsyncStorage.setItem('vehiculo_kilometraje', `${input2} km`);
            } else if (selectedItem === 'Transmisión') {
                await AsyncStorage.setItem('transmision_fecha', input1);
                await AsyncStorage.setItem('transmision_notas', input2);
            } else if (selectedItem === 'Seguro del Vehículo') {
                await AsyncStorage.setItem('seguro_compania', input1);
                await AsyncStorage.setItem('seguro_vencimiento', input2);
            } else if (selectedItem === 'Pago Pendiente') {
                if (!input1 || !input2) {
                    mostrarAlerta("Error", "El monto y la fecha son obligatorios.", "error"); return;
                }
                const nuevoPago: PagoItem = {
                    id: pagoEditId || Date.now().toString(),
                    tipo: inputTipoPago, monto: input1, fecha: input2, banco: input3, cuenta: input4
                };
                const nuevaLista = pagoEditId ? pagosList.map(p => p.id === pagoEditId ? nuevoPago : p) : [...pagosList, nuevoPago];
                await AsyncStorage.setItem('lista_pagos_pendientes', JSON.stringify(nuevaLista));
                setPagosList(nuevaLista);
            } else if (selectedItem === 'Meta Adicional') {
                if (!input1 || !input2) {
                    mostrarAlerta("Error", "El título y el monto son obligatorios.", "error"); return;
                }
                const nuevaMeta: MetaItem = {
                    id: metaEditId || Date.now().toString(),
                    titulo: input1, monto: input2, fecha: input3 || 'Sin fecha', acumulado: input5 || '0'
                };
                const nuevaLista = metaEditId ? metasList.map(m => m.id === metaEditId ? nuevaMeta : m) : [...metasList, nuevaMeta];
                await AsyncStorage.setItem('lista_metas_adicionales', JSON.stringify(nuevaLista));
                setMetasList(nuevaLista);
            }

            setModalVisible(false);
            mostrarAlerta("¡Éxito!", "Información guardada correctamente.", "success");
            cargarDatosGarage();
        } catch (error) {
            mostrarAlerta("Error", "No se pudo guardar la información.", "error");
        }
    };

    const formatMoney = (val: string) => {
        const numero = Number(val);
        if (isNaN(numero)) return val;
        return numero.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: darkMode ? '#121212' : '#F5F7FA' }]}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={[styles.headerTitle, { color: darkMode ? '#FFF' : '#000' }]}>Mi Vehículo</Text>

                <View style={[styles.carCard, { backgroundColor: darkMode ? '#1A1A1A' : '#1E1E1E' }]}>
                    <View style={styles.carIconBg}>
                        <Ionicons name="car" size={32} color="#FFF" />
                    </View>
                    <View style={styles.carInfo}>
                        <Text style={styles.carName}>{vehiculoTexto}</Text>
                        <Text style={styles.carKm}>Placa: <Text style={{ color: '#FF9800', fontWeight: 'bold' }}>{placaVehiculo}</Text></Text>
                        <Text style={styles.carKm}>Kilometraje: <Text style={styles.kmHighlight}>{kilometraje}</Text></Text>
                    </View>
                </View>

                {/* MANTENIMIENTOS */}
                <Text style={[styles.sectionTitle, { color: darkMode ? '#FFF' : '#000' }]}>Mantenimiento y Control</Text>
                <MaintenanceItem icon="build" title="Aceite de Motor" subtitle={subAceite} color="#4CAF50" onPress={() => openEdit('Aceite de Motor')} darkMode={darkMode} />
                <MaintenanceItem icon="settings" title="Transmisión" subtitle={subTransmision} color="#FF9800" onPress={() => openEdit('Transmisión')} darkMode={darkMode} />
                <MaintenanceItem icon="shield-checkmark" title="Seguro del Vehículo" subtitle={subSeguro} color="#2196F3" onPress={() => openEdit('Seguro del Vehículo')} darkMode={darkMode} />

                {/* --- NUEVA SECCIÓN: RUTINA DE CHEQUEO EN 1 LÍNEA (4:00 AM) --- */}
                <View style={styles.sectionHeaderRow}>
                    <View>
                        <Text style={[styles.sectionTitle, { color: darkMode ? '#FFF' : '#000', marginBottom: 2 }]}>Rutina de Chequeo Rápido</Text>
                    </View>
                </View>

                {/* Chips de 1 toque */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                    {PLANTILLAS_RAPIDAS.map((plantilla, idx) => (
                        <TouchableOpacity
                            key={idx}
                            style={[styles.chipQuick, { backgroundColor: darkMode ? '#1E1E1E' : '#E0F7FA', borderColor: '#00BCD440' }]}
                            onPress={() => setNuevoRecTexto(plantilla)}
                        >
                            <Text style={{ color: darkMode ? '#00BCD4' : '#00838F', fontSize: 12, fontWeight: '600' }}>{plantilla}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Barra de creación en 1 sola línea */}
                <View style={[styles.oneLineBar, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF', borderColor: darkMode ? '#333' : '#E0E0E0' }]}>
                    <TextInput
                        style={[styles.oneLineInput, { color: darkMode ? '#FFF' : '#000' }]}
                        placeholder="Ej. Chequear agua antes de salir....."
                        placeholderTextColor="#888"
                        value={nuevoRecTexto}
                        onChangeText={setNuevoRecTexto}
                    />
                    <TouchableOpacity style={styles.daySelectorBtn} onPress={rotarDia}>
                        <Ionicons name="repeat" size={14} color="#00BCD4" style={{ marginRight: 3 }} />
                        <Text style={styles.daySelectorText}>{DIAS_OPCIONES[diaIndex].label}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.addOneLineBtn} onPress={handleAgregarRecordatorioRapido}>
                        <Ionicons name="add" size={22} color="#FFF" />
                    </TouchableOpacity>
                </View>

                {/* Lista compacta de recordatorios activos */}
                {recordatoriosList.length === 0 ? (
                    <Text style={{ color: '#888', fontSize: 13, marginBottom: 15 }}>No tienes chequeos semanales activos.</Text>
                ) : (
                    <View style={{ marginBottom: 15 }}>
                        {recordatoriosList.map((rec) => {
                            // 🔥 CORRECCIÓN: Usamos la hora local exacta del dispositivo, no la global (UTC)
                            const hoy = new Date();
                            const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
                            const completadoHoy = rec.ultimoCheck === hoyStr;

                            return (
                                <View
                                    key={rec.id}
                                    style={[
                                        styles.recRowCard,
                                        {
                                            backgroundColor: darkMode ? '#1E1E1E' : '#FFF',
                                            opacity: completadoHoy ? 0.6 : 1
                                        }
                                    ]}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                        <View style={[styles.recBadge, completadoHoy && { backgroundColor: '#4CAF5020' }]}>
                                            <Text style={[styles.recBadgeText, completadoHoy && { color: '#4CAF50' }]}>
                                                {obtenerNombreFrecuencia(rec.frecuencia)}
                                            </Text>
                                        </View>
                                        <Text
                                            style={[
                                                styles.recTitleText,
                                                {
                                                    color: darkMode ? '#FFF' : '#000',
                                                    textDecorationLine: completadoHoy ? 'line-through' : 'none'
                                                }
                                            ]}
                                            numberOfLines={1}
                                        >
                                            {rec.titulo} {completadoHoy ? ' (Completado ✓)' : ''}
                                        </Text>
                                    </View>

                                    <TouchableOpacity onPress={() => handleEliminarRecordatorio(rec.id)} style={{ padding: 6 }}>
                                        <Ionicons name="close-circle" size={20} color="#E57373" />
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* PAGOS PENDIENTES */}
                <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionTitle, { color: darkMode ? '#FFF' : '#000', marginTop: 0, marginBottom: 0 }]}>Mis Pagos Recurrentes</Text>
                    <TouchableOpacity onPress={openNuevoPago}>
                        <Ionicons name="add-circle" size={28} color="#E91E63" />
                    </TouchableOpacity>
                </View>

                {pagosList.length === 0 ? (
                    <Text style={{ color: '#888', fontSize: 13, marginBottom: 15 }}>No hay pagos registrados. Toca el botón (+) para agregar uno.</Text>
                ) : (
                    pagosList.map(pago => (
                        <MaintenanceItem
                            key={pago.id}
                            icon="card"
                            title={`${pago.tipo} ${pago.banco ? `(${pago.banco})` : ''}`}
                            subtitle={`Cuota: $${formatMoney(pago.monto)} | Próx: ${pago.fecha}`}
                            color="#E91E63"
                            onPress={() => openEditarPago(pago)}
                            darkMode={darkMode}
                        />
                    ))
                )}

                {/* METAS ADICIONALES (GARAGE) */}
                <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionTitle, { color: darkMode ? '#FFF' : '#000', marginTop: 0, marginBottom: 0 }]}>Mis Metas de Ahorro</Text>
                    <TouchableOpacity onPress={openNuevaMeta}>
                        <Ionicons name="add-circle" size={28} color="#9C27B0" />
                    </TouchableOpacity>
                </View>

                {metasList.length === 0 ? (
                    <Text style={{ color: '#888', fontSize: 13, marginBottom: 15 }}>No hay metas adicionales. Toca el botón (+) para crear una.</Text>
                ) : (
                    metasList.map(meta => {
                        const porcentaje = meta.acumulado && meta.monto ? Math.min(100, Math.round((Number(meta.acumulado) / Number(meta.monto)) * 100)) : 0;
                        return (
                            <MaintenanceItem
                                key={meta.id}
                                icon="star"
                                title={meta.titulo}
                                subtitle={`Ahorrado: $${formatMoney(meta.acumulado || '0')} de $${formatMoney(meta.monto)} (${porcentaje}%)`}
                                color="#9C27B0"
                                onPress={() => openEditarMeta(meta)}
                                darkMode={darkMode}
                            />
                        );
                    })
                )}

            </ScrollView>

            <Modal animationType="slide" transparent={true} visible={modalVisible}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF', maxHeight: '85%' }]}>
                        <ScrollView contentContainerStyle={{ paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
                            <Text style={[styles.modalTitle, { color: darkMode ? '#FFF' : '#000', marginBottom: 20 }]}>
                                {selectedItem === 'Pago Pendiente' && pagoEditId ? 'Editar Pago' : selectedItem === 'Meta Adicional' && metaEditId ? 'Editar Meta' : `Configurar ${selectedItem}`}
                            </Text>

                            {selectedItem === 'Aceite de Motor' && (
                                <>
                                    <TextInput style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]} placeholder="Tipo de Aceite (ej. 10W30)" placeholderTextColor="#A0A0A0" value={input1} onChangeText={setInput1} />
                                    <TextInput style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]} placeholder="Kilometraje objetivo / actual" keyboardType="numeric" placeholderTextColor="#A0A0A0" value={input2} onChangeText={setInput2} />
                                    <TextInput style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]} placeholder="Fecha Próximo Cambio (DD/MM/AAAA)" placeholderTextColor="#A0A0A0" value={input3} onChangeText={setInput3} />
                                </>
                            )}

                            {selectedItem === 'Transmisión' && (
                                <>
                                    <TextInput style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]} placeholder="Fecha Próxima (DD/MM/AAAA)" placeholderTextColor="#A0A0A0" value={input1} onChangeText={setInput1} />
                                    <TextInput style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]} placeholder="Observaciones o Notas" placeholderTextColor="#A0A0A0" value={input2} onChangeText={setInput2} />
                                </>
                            )}

                            {selectedItem === 'Seguro del Vehículo' && (
                                <>
                                    <TextInput style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]} placeholder="Compañía Aseguradora" placeholderTextColor="#A0A0A0" value={input1} onChangeText={setInput1} />
                                    <TextInput style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]} placeholder="Fecha de Vencimiento (DD/MM/AAAA)" placeholderTextColor="#A0A0A0" value={input2} onChangeText={setInput2} />
                                </>
                            )}

                            {selectedItem === 'Pago Pendiente' && (
                                <>
                                    <View style={styles.tagsContainer}>
                                        <TouchableOpacity style={[styles.tag, inputTipoPago === 'Préstamo' ? styles.tagActive : { backgroundColor: darkMode ? '#2A2A2A' : '#EEE' }]} onPress={() => setInputTipoPago('Préstamo')}>
                                            <Text style={[styles.tagText, inputTipoPago === 'Préstamo' ? styles.tagTextActive : { color: darkMode ? '#AAA' : '#666' }]}>Préstamo</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.tag, inputTipoPago === 'Tarjeta' ? styles.tagActive : { backgroundColor: darkMode ? '#2A2A2A' : '#EEE' }]} onPress={() => setInputTipoPago('Tarjeta')}>
                                            <Text style={[styles.tagText, inputTipoPago === 'Tarjeta' ? styles.tagTextActive : { color: darkMode ? '#AAA' : '#666' }]}>Tarjeta</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <TextInput style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]} placeholder="Monto de la Cuota (Ej. 12500)" keyboardType="numeric" placeholderTextColor="#A0A0A0" value={input1} onChangeText={setInput1} />
                                    <TextInput style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]} placeholder="Fecha de cobro (DD/MM/AAAA)" placeholderTextColor="#A0A0A0" value={input2} onChangeText={setInput2} />
                                    <TextInput style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]} placeholder={`Banco o Entidad ${inputTipoPago === 'Tarjeta' ? 'Emisora' : 'Financiera'}`} placeholderTextColor="#A0A0A0" value={input3} onChangeText={setInput3} />
                                    <TextInput style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]} placeholder="No. de Cuenta / RNC / Empresa" placeholderTextColor="#A0A0A0" value={input4} onChangeText={setInput4} />

                                    {pagoEditId && (
                                        <TouchableOpacity style={[styles.btn, { backgroundColor: '#4CAF50', marginBottom: 15, paddingVertical: 16 }]} onPress={handlePagarCuota}>
                                            <Text style={{ color: '#FFF', fontWeight: 'bold', textAlign: 'center', fontSize: 16 }}>Registrar Pago y Avanzar Mes</Text>
                                        </TouchableOpacity>
                                    )}
                                </>
                            )}

                            {selectedItem === 'Meta Adicional' && (
                                <>
                                    <TextInput style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]} placeholder="¿Qué deseas lograr? (Ej. Gomas nuevas)" placeholderTextColor="#A0A0A0" value={input1} onChangeText={setInput1} />
                                    <TextInput style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]} placeholder="Monto total a alcanzar" keyboardType="numeric" placeholderTextColor="#A0A0A0" value={input2} onChangeText={setInput2} />
                                    <TextInput style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]} placeholder="Monto ahorrado actualmente" keyboardType="numeric" placeholderTextColor="#A0A0A0" value={input5} onChangeText={setInput5} />
                                    <TextInput style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]} placeholder="Fecha límite (Opcional)" placeholderTextColor="#A0A0A0" value={input3} onChangeText={setInput3} />
                                </>
                            )}

                            <View style={[styles.modalButtons, { marginTop: 5 }]}>
                                {((selectedItem === 'Pago Pendiente' && pagoEditId) || (selectedItem === 'Meta Adicional' && metaEditId)) && (
                                    <TouchableOpacity style={[styles.btn, { backgroundColor: darkMode ? '#3A1A1A' : '#FFEBEE', flex: 0.35, marginRight: 8 }]} onPress={selectedItem === 'Pago Pendiente' ? handleEliminarPago : handleEliminarMeta}>
                                        <Ionicons name="trash" size={24} color="#F44336" />
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity style={[styles.btn, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F5F5' }]} onPress={() => setModalVisible(false)}>
                                    <Text style={[styles.btnTextCancel, { color: darkMode ? '#AAA' : '#666' }]}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.btn, { backgroundColor: darkMode ? '#FFF' : '#1E1E1E' }]} onPress={handleGuardar}>
                                    <Text style={[styles.btnTextSave, { color: darkMode ? '#000' : '#FFF' }]}>Guardar</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Modal de Alerta */}
            <Modal animationType="fade" transparent={true} visible={alertVisible}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.customAlertBox, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                        {alertConfig.type !== 'confirm' && (
                            <View style={[styles.alertIconContainer, { backgroundColor: alertConfig.type === 'error' ? (darkMode ? '#3A1A1A' : '#FFEBEE') : (darkMode ? '#1A3320' : '#E8F5E9') }]}>
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
                                <TouchableOpacity style={[styles.alertBtn, { backgroundColor: '#F44336', flex: 1 }]} onPress={() => { setAlertVisible(false); alertConfig.onConfirm(); }}>
                                    <Text style={{ color: '#FFF', fontWeight: 'bold', textAlign: 'center' }}>Confirmar</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity style={[styles.alertBtn, { backgroundColor: darkMode ? '#FFF' : '#1E1E1E', width: '100%' }]} onPress={() => { setAlertVisible(false); alertConfig.onConfirm(); }}>
                                <Text style={{ color: darkMode ? '#000' : '#FFF', fontWeight: 'bold' }}>Aceptar</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const MaintenanceItem = ({ icon, title, subtitle, color, onPress, darkMode }: any) => (
    <TouchableOpacity style={[styles.maintenanceCard, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]} onPress={onPress}>
        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
            <Ionicons name={icon} size={22} color={color} />
        </View>
        <View style={styles.maintenanceInfo}>
            <Text style={[styles.maintenanceTitle, { color: darkMode ? '#FFF' : '#000' }]}>{title}</Text>
            <Text style={[styles.maintenanceDate, { color: darkMode ? '#A0A0A0' : '#666' }]} numberOfLines={1}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={darkMode ? '#555' : '#A0A0A0'} />
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 100 },
    headerTitle: { fontSize: 28, fontWeight: 'bold', marginTop: 20, marginBottom: 20 },
    carCard: { flexDirection: 'row', padding: 20, borderRadius: 20, alignItems: 'center', marginBottom: 25 },
    carIconBg: { backgroundColor: '#333', padding: 12, borderRadius: 14, marginRight: 15 },
    carInfo: { flex: 1 },
    carName: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
    carKm: { color: '#A0A0A0', fontSize: 13, marginBottom: 2 },
    kmHighlight: { color: '#4CAF50', fontWeight: 'bold' },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, marginBottom: 12 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
    maintenanceCard: { flexDirection: 'row', padding: 16, borderRadius: 16, alignItems: 'center', marginBottom: 12, elevation: 2 },
    iconContainer: { padding: 10, borderRadius: 12, marginRight: 15 },
    maintenanceInfo: { flex: 1 },
    maintenanceTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    maintenanceDate: { fontSize: 12 },

    // Estilos Rutina 1 Línea
    chipQuick: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1 },
    oneLineBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, marginBottom: 12 },
    oneLineInput: { flex: 1, fontSize: 14, paddingVertical: 8, paddingRight: 8, textAlign: 'left' },
    daySelectorBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#00BCD420', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, marginRight: 8 },
    daySelectorText: { color: '#00BCD4', fontWeight: 'bold', fontSize: 12 },
    addOneLineBtn: { backgroundColor: '#00BCD4', width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    recRowCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, marginBottom: 8, elevation: 1 },
    recBadge: { backgroundColor: '#00BCD420', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginRight: 10 },
    recBadgeText: { color: '#00BCD4', fontWeight: 'bold', fontSize: 11 },
    recTitleText: { fontSize: 14, fontWeight: '500', flex: 1 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
    modalContent: { padding: 25, borderRadius: 24, elevation: 5 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    tagsContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 15 },
    tag: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, marginHorizontal: 5 },
    tagActive: { backgroundColor: '#E91E63' },
    tagText: { fontWeight: 'bold' },
    tagTextActive: { color: '#FFF' },
    input: { padding: 14, borderRadius: 10, marginBottom: 15, fontSize: 15, borderWidth: 1 },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    btn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginHorizontal: 8 },
    btnTextCancel: { fontWeight: 'bold' },
    btnTextSave: { fontWeight: 'bold' },
    customAlertBox: { padding: 25, borderRadius: 24, alignItems: 'center', elevation: 10 },
    alertIconContainer: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
    customAlertTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    customAlertMessage: { fontSize: 14, textAlign: 'center', marginBottom: 25, lineHeight: 20 },
    alertBtn: { padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }
});