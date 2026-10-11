import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Modal,
    TextInput,
    ActivityIndicator,
    Platform
} from 'react-native';
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
    const [mesSeleccionado, setMesSeleccionado] = useState(new Date());
    const [mesActualTexto, setMesActualTexto] = useState('Este Mes');

    const [ingresos, setIngresos] = useState(0);
    const [gastos, setGastos] = useState(0);
    const [neto, setNeto] = useState(0);
    const [movimientosMes, setMovimientosMes] = useState<Movimiento[]>([]);

    const [modalEdicionVisible, setModalEdicionVisible] = useState(false);
    const [movimientoSeleccionado, setMovimientoSeleccionado] = useState<Movimiento | null>(null);
    const [editMonto, setEditMonto] = useState('');
    const [editNota, setEditNota] = useState('');
    const [editTipo, setEditTipo] = useState<'INGRESO' | 'GASTO'>('INGRESO');

    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info' as 'info' | 'error' | 'success' | 'confirm', onConfirm: () => {} });

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
            lista.push({ texto: nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1), fecha: new Date(anio, mesIndex, 1) });
            fechaTemp.setMonth(fechaTemp.getMonth() - 1);
        }
        return lista;
    };
    const ultimos12Meses = generarUltimos12Meses();

    useFocusEffect(
        useCallback(() => { cargarDatosPorMes(mesSeleccionado); }, [mesSeleccionado])
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

            setIngresos(totalIngresos); setGastos(totalGastos); setNeto(totalIngresos - totalGastos); setMovimientosMes(listaMovs);

            const hoy = new Date();
            if (mes === hoy.getMonth() && anio === hoy.getFullYear()) {
                setMesActualTexto('Este Mes');
            } else {
                const nombre = fechaMeta.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
                setMesActualTexto(nombre.charAt(0).toUpperCase() + nombre.slice(1));
            }
        } catch (error) { console.error("Error al cargar estadísticas:", error); }
    };

    const abrirModalEdicion = (item: Movimiento) => {
        setMovimientoSeleccionado(item); setEditMonto(item.monto.toString()); setEditNota(item.nota || ''); setEditTipo(item.tipo); setModalEdicionVisible(true);
    };

    const handleActualizarMovimiento = () => {
        if (!movimientoSeleccionado?.id || !editMonto || isNaN(Number(editMonto))) return mostrarAlerta("Atención", "Monto válido requerido.", "error");
        actualizarMovimiento(movimientoSeleccionado.id, editTipo, parseFloat(editMonto), editNota || (editTipo === 'INGRESO' ? 'Ingreso' : 'Gasto'));
        setModalEdicionVisible(false); cargarDatosPorMes(mesSeleccionado);
    };

    const handleEliminarMovimiento = () => {
        if (!movimientoSeleccionado?.id) return;
        mostrarAlerta("Eliminar", "¿Borrar registro permanentemente?", "confirm", () => {
            borrarMovimiento(movimientoSeleccionado.id!); setModalEdicionVisible(false); cargarDatosPorMes(mesSeleccionado);
        });
    };

    // 🔥 MAGIA PURA: Llama a Gemini para redactar el análisis del PDF
    const obtenerResumenIA = async () => {
        try {
            const prompt = `Actúa como un analista financiero de alto nivel de DriveWallet. Analiza este mes: Ingresos: $${ingresos}, Gastos: $${gastos}, Neto: $${neto}. Redacta un reporte ejecutivo de 2 párrafos cortos. Felicita si el neto es positivo o advierte si hay pérdidas. Da 2 consejos para mejorar. Responde directamente con el texto (sin saludos). Puedes usar etiquetas <b> para destacar.`;

            const response = await fetch('https://www.jrtechnology.duckdns.org/ai/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ app_id: "drivewallet", mensaje: prompt })
            });
            const data = await response.json();
            return data.respuesta;
        } catch (e) {
            return "No se pudo generar el análisis de IA por falta de conexión a internet. Inténtalo más tarde.";
        }
    };

    const guardarPdfEnDispositivo = async () => {
        if (movimientosMes.length === 0) return mostrarAlerta("Aviso", "No hay movimientos para exportar.", "info");

        setIsGeneratingPdf(true);
        const analisisIA = await obtenerResumenIA();

        const filasHtml = movimientosMes.map(m => {
            const fechaFormateada = new Date(m.fechaTimestamp).toLocaleDateString();
            const concepto = m.nota || m.categoria;
            const signo = m.tipo === 'INGRESO' ? '+' : '-';
            const claseCss = m.tipo === 'INGRESO' ? 'text-green' : 'text-red';
            return `
                <tr>
                    <td>${fechaFormateada}</td>
                    <td>${concepto}</td>
                    <td class="font-bold ${claseCss}">${signo} RD$ ${m.monto.toLocaleString()}</td>
                </tr>
            `;
        }).join('');

        // 🔥 Capturamos la fecha y hora exacta de la solicitud
        const fechaGeneracion = new Date().toLocaleString('es-DO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // 🔥 Diseño Premium del PDF con Pie de Página
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1E1E1E; padding: 40px; background-color: #F8FAFC; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #D0BCFF; padding-bottom: 15px; }
                    .logo-text { font-size: 28px; font-weight: 800; color: #121212; letter-spacing: -1px; }
                    .logo-text span { color: #9C27B0; }
                    .subtitle { color: #64748B; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-top: 5px; }
                    
                    .ai-box { background: linear-gradient(135deg, #1E1E1E, #2A2A2A); color: #FFF; padding: 20px; border-radius: 12px; margin-bottom: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-left: 5px solid #D0BCFF; }
                    .ai-title { font-size: 14px; font-weight: bold; color: #D0BCFF; margin-bottom: 10px; display: flex; align-items: center; }
                    .ai-content { font-size: 13px; line-height: 1.6; color: #E2E8F0; }
                    
                    .summary { display: flex; justify-content: space-between; gap: 15px; margin-bottom: 30px; }
                    .summary-card { flex: 1; background: #FFF; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid #E2E8F0; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
                    .card-label { font-size: 12px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
                    .card-val { font-size: 24px; font-weight: 800; }
                    .text-green { color: #10B981; }
                    .text-red { color: #EF4444; }
                    
                    table { width: 100%; border-collapse: separate; border-spacing: 0; background: #FFF; border-radius: 12px; overflow: hidden; border: 1px solid #E2E8F0; }
                    th, td { padding: 12px 15px; text-align: left; font-size: 13px; border-bottom: 1px solid #E2E8F0; }
                    th { background-color: #F1F5F9; color: #475569; font-weight: 600; text-transform: uppercase; font-size: 11px; }
                    tr:last-child td { border-bottom: none; }
                    .font-bold { font-weight: bold; }

                    /* Estilos para el pie de página */
                    .footer {
                        margin-top: 50px;
                        padding-top: 20px;
                        border-top: 1px solid #E2E8F0;
                        text-align: center;
                        font-size: 11px;
                        color: #64748B;
                        line-height: 1.6;
                    }
                    .footer strong { color: #1E1E1E; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo-text">Drive<span>Wallet</span></div>
                    <div class="subtitle">Reporte Financiero Oficial • ${mesActualTexto}</div>
                </div>

                <div class="ai-box">
                    <div class="ai-title">✨ Análisis Inteligente (Gemini AI)</div>
                    <div class="ai-content">${analisisIA}</div>
                </div>

                <div class="summary">
                    <div class="summary-card">
                        <div class="card-label">Ingresos Brutos</div>
                        <div class="card-val text-green">RD$ ${ingresos.toLocaleString()}</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">Gastos Operativos</div>
                        <div class="card-val text-red">RD$ ${gastos.toLocaleString()}</div>
                    </div>
                    <div class="summary-card" style="border-bottom: 4px solid ${neto >= 0 ? '#10B981' : '#EF4444'};">
                        <div class="card-label">Beneficio Neto</div>
                        <div class="card-val" style="color: ${neto >= 0 ? '#10B981' : '#EF4444'};">RD$ ${neto.toLocaleString()}</div>
                    </div>
                </div>

                <h3 style="color: #1E1E1E; font-size: 16px; margin-bottom: 10px;">Desglose de Movimientos</h3>
                <table>
                    <tr>
                        <th>Fecha</th>
                        <th>Concepto / Nota</th>
                        <th>Monto Efectivo</th>
                    </tr>
                    ${filasHtml}
                </table>

                <!-- Nuestro nuevo pie de página -->
                <div class="footer">
                    Documento generado el ${fechaGeneracion}.<br>
                    <strong>DriveWallet</strong> es un producto desarrollado por <strong>JR Technology</strong> &copy; ${new Date().getFullYear()}
                </div>
            </body>
            </html>
        `;

        try {
            // 1. Generamos el PDF temporalmente con Expo Print
            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            const nombreArchivo = `Reporte_${mesActualTexto.replace(/\s+/g, '_')}.pdf`;

            // 2. Revisamos si el usuario guardó una ruta personalizada en Settings
            const importAsyncStorage = await import('@react-native-async-storage/async-storage');
            const customUri = await importAsyncStorage.default.getItem('app_pdf_ruta_uri');

            if (customUri && Platform.OS === 'android') {
                // 🔥 MAGIA ANDROID: Mover el archivo a la carpeta personalizada (SAF)
                const base64Data = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

                // Creamos el archivo directamente en la carpeta elegida
                const newFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
                    customUri,
                    nombreArchivo,
                    'application/pdf'
                );

                // Escribimos el PDF en esa ruta
                await FileSystem.writeAsStringAsync(newFileUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });

                setIsGeneratingPdf(false);
                mostrarAlerta("¡Éxito!", "PDF guardado en tu carpeta personalizada.", "success");
            } else {
                // Comportamiento normal (iOS o si no eligió carpeta)
                setIsGeneratingPdf(false);
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Reporte Mensual Inteligente', UTI: 'com.adobe.pdf' });
                } else {
                    mostrarAlerta("¡Éxito!", `PDF generado en: ${uri}`, "success");
                }
            }
        } catch (error) {
            setIsGeneratingPdf(false);
            console.error(error);
            mostrarAlerta("Error", "No se pudo generar o guardar el archivo PDF.", "error");
        }
    };

    const formatMoney = (val: number) => `$${val.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: darkMode ? '#121212' : '#F5F7FA' }]}>
            <ScrollView contentContainerStyle={styles.scrollContent}>

                <View style={styles.header}>
                    <Text style={[styles.headerTitle, { color: darkMode ? '#FFF' : '#000' }]}>Resumen Mensual</Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity style={[styles.pdfButton, { backgroundColor: darkMode ? '#2A2A2A' : '#E0E0E0' }]} onPress={guardarPdfEnDispositivo} disabled={isGeneratingPdf}>
                            {isGeneratingPdf ? <ActivityIndicator size="small" color="#9C27B0" /> : <Ionicons name="cloud-download-outline" size={18} color={darkMode ? '#4CAF50' : '#333'} />}
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.monthButton, { backgroundColor: darkMode ? '#1E2F23' : '#E8F5E9', marginLeft: 8 }]} onPress={() => setModalVisible(true)}>
                            <Text style={styles.changeMonthText}>{mesActualTexto}</Text>
                            <Ionicons name="chevron-down" size={14} color="#4CAF50" style={{ marginLeft: 5 }} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* --- Resto de la UI (Igual que la tuya original) --- */}
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
                                    <Ionicons name={item.tipo === 'INGRESO' ? 'arrow-down-outline' : 'arrow-up-outline'} size={20} color={item.tipo === 'INGRESO' ? '#4CAF50' : '#F44336'} />
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
                                <TouchableOpacity key={index} style={[styles.monthOption, { borderBottomColor: darkMode ? '#333' : '#F0F0F0' }]} onPress={() => { setMesSeleccionado(item.fecha); setModalVisible(false); }}>
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

            {/* Modal de Edición */}
            <Modal animationType="slide" transparent={true} visible={modalEdicionVisible}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                        <Text style={[styles.modalTitle, { color: darkMode ? '#FFF' : '#000' }]}>Editar Movimiento</Text>
                        <View style={[styles.tipoContainer, { borderColor: darkMode ? '#333' : '#DDD', backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA' }]}>
                            <TouchableOpacity style={[styles.tipoBtn, editTipo === 'INGRESO' && styles.tipoIngresoActive]} onPress={() => setEditTipo('INGRESO')}><Text style={[styles.tipoTxt, { color: editTipo === 'INGRESO' ? '#FFF' : (darkMode ? '#AAA' : '#666') }]}>Ingreso</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.tipoBtn, editTipo === 'GASTO' && styles.tipoGastoActive]} onPress={() => setEditTipo('GASTO')}><Text style={[styles.tipoTxt, { color: editTipo === 'GASTO' ? '#FFF' : (darkMode ? '#AAA' : '#666') }]}>Gasto</Text></TouchableOpacity>
                        </View>
                        <TextInput style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]} placeholder="Monto" keyboardType="numeric" value={editMonto} onChangeText={setEditMonto} />
                        <TextInput style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]} placeholder="Descripción o Nota" value={editNota} onChangeText={setEditNota} />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.btnAction, { backgroundColor: darkMode ? '#3A1A1A' : '#FFEBEE' }]} onPress={handleEliminarMovimiento}><Text style={styles.btnTextDelete}>Eliminar</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.btnAction, { backgroundColor: darkMode ? '#2A2A2A' : '#F0F0F0' }]} onPress={() => setModalEdicionVisible(false)}><Text style={[styles.btnTextCancel, { color: darkMode ? '#CCC' : '#666' }]}>Cancelar</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.btnAction, { backgroundColor: darkMode ? '#FFF' : '#1E1E1E' }]} onPress={handleActualizarMovimiento}><Text style={[styles.btnTextSave, { color: darkMode ? '#000' : '#FFF' }]}>Guardar</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal Alerta */}
            <Modal animationType="fade" transparent={true} visible={alertVisible}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.customAlertBox, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                        <View style={[styles.alertIconContainer, { backgroundColor: alertConfig.type === 'error' || alertConfig.type === 'confirm' ? (darkMode ? '#3A1A1A' : '#FFEBEE') : (darkMode ? '#1A3320' : '#E8F5E9') }]}>
                            <Ionicons name={alertConfig.type === 'error' ? 'alert-circle' : alertConfig.type === 'confirm' ? 'help-circle' : 'checkmark-circle'} size={32} color={alertConfig.type === 'error' || alertConfig.type === 'confirm' ? '#F44336' : '#4CAF50'} />
                        </View>
                        <Text style={[styles.customAlertTitle, { color: darkMode ? '#FFF' : '#000' }]}>{alertConfig.title}</Text>
                        <Text style={[styles.customAlertMessage, { color: darkMode ? '#A0A0A0' : '#666' }]}>{alertConfig.message}</Text>
                        <View style={styles.customAlertButtonsRow}>
                            {alertConfig.type === 'confirm' ? (
                                <><TouchableOpacity style={[styles.alertBtn, { backgroundColor: darkMode ? '#2A2A2A' : '#F0F0F0' }]} onPress={() => setAlertVisible(false)}><Text style={{ color: darkMode ? '#CCC' : '#666', fontWeight: 'bold' }}>Cancelar</Text></TouchableOpacity><TouchableOpacity style={[styles.alertBtn, { backgroundColor: '#F44336' }]} onPress={() => { setAlertVisible(false); alertConfig.onConfirm(); }}><Text style={{ color: '#FFF', fontWeight: 'bold' }}>Sí, Eliminar</Text></TouchableOpacity></>
                            ) : (
                                <TouchableOpacity style={[styles.alertBtn, { backgroundColor: darkMode ? '#FFF' : '#1E1E1E', flex: 1 }]} onPress={() => setAlertVisible(false)}><Text style={{ color: darkMode ? '#000' : '#FFF', fontWeight: 'bold' }}>Aceptar</Text></TouchableOpacity>
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
    customAlertBox: { padding: 25, borderRadius: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
    alertIconContainer: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
    customAlertTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    customAlertMessage: { fontSize: 14, textAlign: 'center', marginBottom: 25, lineHeight: 20 },
    customAlertButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
    alertBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', marginHorizontal: 6 }
});