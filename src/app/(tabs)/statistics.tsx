import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useFocusEffect } from 'expo-router';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
    Movimiento,
    obtenerMovimientosDelMes,
    sumarIngresosDelMes,
    sumarGastosDelMes,
    actualizarMovimiento,
    borrarMovimiento
} from '@/db/database';

export default function Statistics() {
    const { darkMode } = useTheme();
    const [modalVisible, setModalVisible] = useState(false);

    // Estados para el selector de mes
    const [mesSeleccionado, setMesSeleccionado] = useState(new Date());
    const [mesActualTexto, setMesActualTexto] = useState('Este Mes');

    // Datos financieros
    const [ingresos, setIngresos] = useState(0);
    const [gastos, setGastos] = useState(0);
    const [neto, setNeto] = useState(0);
    const [movimientosMes, setMovimientosMes] = useState<Movimiento[]>([]);

    // Estados para el Modal de Editar Movimiento
    const [modalEdicionVisible, setModalEdicionVisible] = useState(false);
    const [movimientoSeleccionado, setMovimientoSeleccionado] = useState<Movimiento | null>(null);
    const [editMonto, setEditMonto] = useState('');
    const [editNota, setEditNota] = useState('');
    const [editTipo, setEditTipo] = useState<'INGRESO' | 'GASTO'>('INGRESO');

    // --- ESTADOS PARA EL NUEVO SISTEMA DE ALERTAS PERSONALIZADAS ---
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

    const generarUltimos12Meses = () => {
        const lista = [];
        const fechaTemp = new Date();
        for (let i = 0; i < 12; i++) {
            const anio = fechaTemp.getFullYear();
            const mesIndex = fechaTemp.getMonth();
            const nombreMes = fechaTemp.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
            lista.push({
                texto: nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1),
                fecha: new Date(anio, mesIndex, 1)
            });
            fechaTemp.setMonth(fechaTemp.getMonth() - 1);
        }
        return lista;
    };

    const ultimos12Meses = generarUltimos12Meses();

    useFocusEffect(
        useCallback(() => {
            cargarDatosPorMes(mesSeleccionado);
        }, [mesSeleccionado])
    );

    const cargarDatosPorMes = (fechaMeta: Date) => {
        try {
            const anio = fechaMeta.getFullYear();
            const mes = fechaMeta.getMonth();

            const inicioMes = new Date(anio, mes, 1, 0, 0, 0).getTime();
            const finMes = new Date(anio, mes + 1, 0, 23, 59, 59).getTime();

            const totalIngresos = sumarIngresosDelMes(inicioMes, finMes);
            const totalGastos = sumarGastosDelMes(inicioMes, finMes);
            const listaMovs = obtenerMovimientosDelMes(inicioMes, finMes);

            setIngresos(totalIngresos);
            setGastos(totalGastos);
            setNeto(totalIngresos - totalGastos);
            setMovimientosMes(listaMovs);

            const hoy = new Date();
            if (mes === hoy.getMonth() && anio === hoy.getFullYear()) {
                setMesActualTexto('Este Mes');
            } else {
                const nombre = fechaMeta.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
                setMesActualTexto(nombre.charAt(0).toUpperCase() + nombre.slice(1));
            }
        } catch (error) {
            console.error("Error al cargar estadísticas:", error);
        }
    };

    const abrirModalEdicion = (item: Movimiento) => {
        setMovimientoSeleccionado(item);
        setEditMonto(item.monto.toString());
        setEditNota(item.nota || '');
        setEditTipo(item.tipo);
        setModalEdicionVisible(true);
    };

    const handleActualizarMovimiento = () => {
        if (!movimientoSeleccionado?.id || !editMonto || isNaN(Number(editMonto))) {
            mostrarAlerta("Atención", "Por favor ingresa un monto válido.", "error");
            return;
        }

        actualizarMovimiento(
            movimientoSeleccionado.id,
            editTipo,
            parseFloat(editMonto),
            editNota || (editTipo === 'INGRESO' ? 'Ingreso' : 'Gasto')
        );

        setModalEdicionVisible(false);
        cargarDatosPorMes(mesSeleccionado);
    };

    const handleEliminarMovimiento = () => {
        if (!movimientoSeleccionado?.id) return;

        mostrarAlerta(
            "Eliminar Movimiento",
            "¿Estás seguro de que deseas borrar este registro de forma permanente?",
            "confirm",
            () => {
                borrarMovimiento(movimientoSeleccionado.id!);
                setModalEdicionVisible(false);
                cargarDatosPorMes(mesSeleccionado);
            }
        );
    };

    const guardarPdfEnDispositivo = async () => {
        if (movimientosMes.length === 0) {
            mostrarAlerta("Aviso", "No hay movimientos en este período para exportar.", "info");
            return;
        }

        const filasHtml = movimientosMes.map(m => {
            const fechaFormateada = new Date(m.fechaTimestamp).toLocaleDateString();
            const concepto = m.nota || m.categoria;
            const signo = m.tipo === 'INGRESO' ? '+' : '-';
            const claseCss = m.tipo === 'INGRESO' ? 'ingreso' : 'gasto';
            const montoFormateado = m.monto.toLocaleString();

            return `
                <tr>
                    <td>${fechaFormateada}</td>
                    <td>${concepto}</td>
                    <td>${m.tipo}</td>
                    <td class="${claseCss}">${signo} RD$ ${montoFormateado}</td>
                </tr>
            `;
        }).join('');

        const htmlContent = `
            <html>
                <head>
                    <style>
                        body { font-family: 'Helvetica', sans-serif; color: #333; padding: 20px; }
                        h1 { color: #1E1E1E; margin-bottom: 0; }
                        .subtitle { color: #666; font-size: 14px; margin-bottom: 20px; }
                        .summary { display: flex; justify-content: space-between; background: #F5F7FA; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
                        .summary-item { text-align: center; }
                        .summary-val { font-size: 16px; font-weight: bold; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
                        th { background-color: #1E1E1E; color: white; }
                        .ingreso { color: #2E7D32; font-weight: bold; }
                        .gasto { color: #C62828; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <h1>DriveWallet - Reporte Financiero</h1>
                    <div class="subtitle">Período: ${mesActualTexto}</div>
                    
                    <div class="summary">
                        <div class="summary-item"><div>Ingresos</div><div class="summary-val ingreso">RD$ ${ingresos.toLocaleString()}</div></div>
                        <div class="summary-item"><div>Gastos</div><div class="summary-val gasto">RD$ ${gastos.toLocaleString()}</div></div>
                        <div class="summary-item"><div>Neto</div><div class="summary-val">RD$ ${neto.toLocaleString()}</div></div>
                    </div>

                    <h3>Historial de Movimientos</h3>
                    <table>
                        <tr>
                            <th>Fecha</th>
                            <th>Concepto</th>
                            <th>Tipo</th>
                            <th>Monto</th>
                        </tr>
                        ${filasHtml}
                    </table>
                </body>
            </html>
        `;

        try {
            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            const nombreArchivo = `DriveWallet_Reporte_${mesActualTexto.replace(/\s+/g, '_')}.pdf`;
            const docDir = FileSystem.documentDirectory;
            const destinationUri = `${docDir}${nombreArchivo}`;

            const fileInfo = await FileSystem.getInfoAsync(destinationUri);
            if (fileInfo.exists) {
                await FileSystem.deleteAsync(destinationUri);
            }

            await FileSystem.moveAsync({ from: uri, to: destinationUri });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(destinationUri, {
                    mimeType: 'application/pdf',
                    dialogTitle: 'Guardar o Compartir Reporte PDF',
                    UTI: 'com.adobe.pdf'
                });
            } else {
                mostrarAlerta("¡Éxito!", `PDF guardado en: ${destinationUri}`, "success");
            }
        } catch (error) {
            console.error(error);
            mostrarAlerta("Error", "No se pudo generar o guardar el archivo PDF.", "error");
        }
    };

    const formatMoney = (val: number) => {
        return `$${val.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: darkMode ? '#121212' : '#F5F7FA' }]}>
            <ScrollView contentContainerStyle={styles.scrollContent}>

                <View style={styles.header}>
                    <Text style={[styles.headerTitle, { color: darkMode ? '#FFF' : '#000' }]}>Resumen Mensual</Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity
                            style={[styles.pdfButton, { backgroundColor: darkMode ? '#2A2A2A' : '#E0E0E0' }]}
                            onPress={guardarPdfEnDispositivo}
                        >
                            <Ionicons name="cloud-download-outline" size={18} color={darkMode ? '#4CAF50' : '#333'} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.monthButton, { backgroundColor: darkMode ? '#1E2F23' : '#E8F5E9', marginLeft: 8 }]}
                            onPress={() => setModalVisible(true)}
                        >
                            <Text style={styles.changeMonthText}>{mesActualTexto}</Text>
                            <Ionicons name="chevron-down" size={14} color="#4CAF50" style={{ marginLeft: 5 }} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={[styles.chartCard, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                    <Text style={[styles.chartSubtitle, { color: darkMode ? '#A0A0A0' : '#666' }]}>Ganancias vs Gastos</Text>

                    <View style={[styles.mockChart, { borderBottomColor: darkMode ? '#333' : '#EEE' }]}>
                        <View style={[styles.bar, { height: ingresos > 0 ? 110 : 20, backgroundColor: darkMode ? '#FFF' : '#1E1E1E' }]} />
                        <View style={[styles.bar, { height: gastos > 0 ? 70 : 20, backgroundColor: '#F44336' }]} />
                    </View>

                    <View style={styles.totalsRow}>
                        <View style={styles.totalItem}>
                            <Text style={[styles.totalLabel, { color: darkMode ? '#A0A0A0' : '#666' }]}>Ingresos</Text>
                            <Text style={[styles.totalValue, { color: darkMode ? '#FFF' : '#000' }]}>{formatMoney(ingresos)}</Text>
                        </View>
                        <View style={styles.totalItem}>
                            <Text style={[styles.totalLabel, { color: darkMode ? '#A0A0A0' : '#666' }]}>Gastos</Text>
                            <Text style={[styles.totalValue, { color: '#F44336' }]}>{formatMoney(gastos)}</Text>
                        </View>
                        <View style={styles.totalItem}>
                            <Text style={[styles.totalLabel, { color: darkMode ? '#A0A0A0' : '#666' }]}>Neto</Text>
                            <Text style={[styles.totalValue, { color: neto >= 0 ? '#4CAF50' : '#F44336' }]}>{formatMoney(neto)}</Text>
                        </View>
                    </View>
                </View>

                <Text style={[styles.sectionTitle, { color: darkMode ? '#FFF' : '#000' }]}>Historial del Mes (Toca para editar)</Text>

                {movimientosMes.length === 0 ? (
                    <Text style={{ color: '#888', textAlign: 'center', marginTop: 20 }}>No hay movimientos en este mes.</Text>
                ) : (
                    movimientosMes.map((item) => (
                        <TouchableOpacity key={item.id} activeOpacity={0.7} onPress={() => abrirModalEdicion(item)}>
                            <View style={[styles.moveCard, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                                <View style={[styles.iconContainer, { backgroundColor: item.tipo === 'INGRESO' ? (darkMode ? '#1A3320' : '#E8F5E9') : (darkMode ? '#3A1A1A' : '#FFEBEE') }]}>
                                    <Ionicons
                                        name={item.tipo === 'INGRESO' ? 'arrow-down-outline' : 'arrow-up-outline'}
                                        size={20}
                                        color={item.tipo === 'INGRESO' ? '#4CAF50' : '#F44336'}
                                    />
                                </View>
                                <View style={styles.moveInfo}>
                                    <Text style={[styles.moveDesc, { color: darkMode ? '#FFF' : '#000' }]}>{item.nota || item.categoria}</Text>
                                    <Text style={[styles.moveDate, { color: darkMode ? '#A0A0A0' : '#888' }]}>{new Date(item.fechaTimestamp).toLocaleDateString()}</Text>
                                </View>
                                <Text style={[styles.moveAmount, { color: item.tipo === 'INGRESO' ? '#4CAF50' : '#F44336' }]}>
                                    {item.tipo === 'INGRESO' ? '+' : '-'} {formatMoney(item.monto)}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>

            {/* Modal Selector de Mes */}
            <Modal animationType="fade" transparent={true} visible={modalVisible}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF', maxHeight: '70%' }]}>
                        <Text style={[styles.modalTitle, { color: darkMode ? '#FFF' : '#000' }]}>Seleccionar Mes</Text>

                        <ScrollView>
                            {ultimos12Meses.map((item, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[styles.monthOption, { borderBottomColor: darkMode ? '#333' : '#F0F0F0' }]}
                                    onPress={() => {
                                        setMesSeleccionado(item.fecha);
                                        setModalVisible(false);
                                    }}
                                >
                                    <Text style={[styles.monthText, { color: darkMode ? '#FFF' : '#333' }]}>{item.texto}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <TouchableOpacity style={[styles.closeModalBtn, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA' }]} onPress={() => setModalVisible(false)}>
                            <Text style={styles.closeModalText}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Modal de Edición Rediseñado y Estilizado */}
            <Modal animationType="slide" transparent={true} visible={modalEdicionVisible}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                        <Text style={[styles.modalTitle, { color: darkMode ? '#FFF' : '#000' }]}>Editar Movimiento</Text>

                        <View style={[styles.tipoContainer, { borderColor: darkMode ? '#333' : '#DDD', backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA' }]}>
                            <TouchableOpacity
                                style={[styles.tipoBtn, editTipo === 'INGRESO' && styles.tipoIngresoActive]}
                                onPress={() => setEditTipo('INGRESO')}
                            >
                                <Text style={[styles.tipoTxt, { color: editTipo === 'INGRESO' ? '#FFF' : (darkMode ? '#AAA' : '#666') }]}>Ingreso</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.tipoBtn, editTipo === 'GASTO' && styles.tipoGastoActive]}
                                onPress={() => setEditTipo('GASTO')}
                            >
                                <Text style={[styles.tipoTxt, { color: editTipo === 'GASTO' ? '#FFF' : (darkMode ? '#AAA' : '#666') }]}>Gasto</Text>
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]}
                            placeholder="Monto"
                            placeholderTextColor="#A0A0A0"
                            keyboardType="numeric"
                            value={editMonto}
                            onChangeText={setEditMonto}
                        />
                        <TextInput
                            style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]}
                            placeholder="Descripción o Nota"
                            placeholderTextColor="#A0A0A0"
                            value={editNota}
                            onChangeText={setEditNota}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.btnAction, { backgroundColor: darkMode ? '#3A1A1A' : '#FFEBEE' }]} onPress={handleEliminarMovimiento}>
                                <Text style={styles.btnTextDelete}>Eliminar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btnAction, { backgroundColor: darkMode ? '#2A2A2A' : '#F0F0F0' }]} onPress={() => setModalEdicionVisible(false)}>
                                <Text style={[styles.btnTextCancel, { color: darkMode ? '#CCC' : '#666' }]}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btnAction, { backgroundColor: darkMode ? '#FFF' : '#1E1E1E' }]} onPress={handleActualizarMovimiento}>
                                <Text style={[styles.btnTextSave, { color: darkMode ? '#000' : '#FFF' }]}>Guardar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* --- NUEVO: MODAL DE ALERTA PERSONALIZADA --- */}
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

                        <View style={styles.customAlertButtonsRow}>
                            {alertConfig.type === 'confirm' ? (
                                <>
                                    <TouchableOpacity
                                        style={[styles.alertBtn, { backgroundColor: darkMode ? '#2A2A2A' : '#F0F0F0' }]}
                                        onPress={() => setAlertVisible(false)}
                                    >
                                        <Text style={{ color: darkMode ? '#CCC' : '#666', fontWeight: 'bold' }}>Cancelar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.alertBtn, { backgroundColor: '#F44336' }]}
                                        onPress={() => { setAlertVisible(false); alertConfig.onConfirm(); }}
                                    >
                                        <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Sí, Eliminar</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <TouchableOpacity
                                    style={[styles.alertBtn, { backgroundColor: darkMode ? '#FFF' : '#1E1E1E', flex: 1 }]}
                                    onPress={() => setAlertVisible(false)}
                                >
                                    <Text style={{ color: darkMode ? '#000' : '#FFF', fontWeight: 'bold' }}>Aceptar</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 100 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 20 },
    headerTitle: { fontSize: 22, fontWeight: 'bold' },
    pdfButton: { padding: 8, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    monthButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    changeMonthText: { color: '#4CAF50', fontWeight: 'bold', fontSize: 13 },
    chartCard: { borderRadius: 24, padding: 25, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, marginBottom: 25 },
    chartSubtitle: { fontSize: 14, marginBottom: 20 },
    mockChart: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 140, borderBottomWidth: 1, paddingBottom: 10, marginBottom: 20 },
    bar: { width: 35, borderRadius: 8 },
    totalsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    totalItem: { alignItems: 'center' },
    totalLabel: { fontSize: 12, marginBottom: 5 },
    totalValue: { fontSize: 15, fontWeight: 'bold' },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
    moveCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 },
    iconContainer: { padding: 10, borderRadius: 12, marginRight: 15 },
    moveInfo: { flex: 1 },
    moveDesc: { fontSize: 15, fontWeight: '600', marginBottom: 3 },
    moveDate: { fontSize: 12 },
    moveAmount: { fontSize: 16, fontWeight: 'bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
    modalContent: { padding: 25, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15, elevation: 5 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    monthOption: { paddingVertical: 14, borderBottomWidth: 1, alignItems: 'center' },
    monthText: { fontSize: 16, fontWeight: '500' },
    closeModalBtn: { marginTop: 15, padding: 12, borderRadius: 12, alignItems: 'center' },
    closeModalText: { color: '#F44336', fontWeight: 'bold' },
    tipoContainer: { flexDirection: 'row', marginBottom: 20, borderRadius: 12, overflow: 'hidden', borderWidth: 1, padding: 3 },
    tipoBtn: { flex: 1, padding: 10, alignItems: 'center', borderRadius: 9 },
    tipoIngresoActive: { backgroundColor: '#4CAF50' },
    tipoGastoActive: { backgroundColor: '#F44336' },
    tipoTxt: { fontWeight: 'bold', fontSize: 14 },
    input: { padding: 14, borderRadius: 12, marginBottom: 15, fontSize: 15, borderWidth: 1 },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    btnAction: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', marginHorizontal: 4 },
    btnTextDelete: { color: '#F44336', fontWeight: 'bold', fontSize: 13 },
    btnTextCancel: { fontWeight: 'bold', fontSize: 13 },
    btnTextSave: { fontWeight: 'bold', fontSize: 13 },
    // Estilos del nuevo sistema de alerta personalizada
    customAlertBox: { padding: 25, borderRadius: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
    alertIconContainer: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
    customAlertTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    customAlertMessage: { fontSize: 14, textAlign: 'center', marginBottom: 25, lineHeight: 20 },
    customAlertButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
    alertBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', marginHorizontal: 6 }
});