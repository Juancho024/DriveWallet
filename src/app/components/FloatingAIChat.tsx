import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import {
    sumarIngresosDelMes,
    sumarGastosDelMes,
    obtenerMovimientosDelMes,
    insertarMovimientoRapido
} from '@/db/database';
import * as ImagePicker from 'expo-image-picker';

function GrabadorVozMinimal({
                                darkMode,
                                onAudioListo,
                                onCancelar
                            }: {
    darkMode: boolean;
    onAudioListo: (base64: string, duracionSeg: number) => void;
    onCancelar: () => void;
}) {
    const audioRecorder = useAudioRecorder({
        ...RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
    });
    const [segundos, setSegundos] = useState(0);
    const [iniciado, setIniciado] = useState(false);
    const [barras, setBarras] = useState<number[]>([0.25, 0.4, 0.7, 0.35, 0.6, 0.3, 0.5]);

    useEffect(() => {
        let isMounted = true;
        let timerSegundos: any;
        let timerOndas: any;

        const iniciar = async () => {
            try {
                await AudioModule.setAudioModeAsync({
                    allowsRecording: true,
                    playsInSilentMode: true,
                });
                await audioRecorder.prepareToRecordAsync();
                if (!isMounted) return;

                audioRecorder.record();
                setIniciado(true);

                timerSegundos = setInterval(() => {
                    setSegundos(s => s + 1);
                }, 1000);

                timerOndas = setInterval(() => {
                    setBarras(prev => prev.map(() => 0.2 + Math.random() * 0.8));
                }, 160);
            } catch (err) {
                console.error("Error iniciando grabación:", err);
                onCancelar();
            }
        };

        const timeout = setTimeout(iniciar, 200);

        return () => {
            isMounted = false;
            clearTimeout(timeout);
            if (timerSegundos) clearInterval(timerSegundos);
            if (timerOndas) clearInterval(timerOndas);
            try {
                if (audioRecorder.isRecording) {
                    audioRecorder.stop();
                }
            } catch (e) {}
        };
    }, []);

    const finalizarYEnviar = async () => {
        if (!iniciado) return;
        try {
            await audioRecorder.stop();
            const uri = audioRecorder.uri;

            if (uri) {
                const audioBase64 = await FileSystem.readAsStringAsync(uri, {
                    encoding: FileSystem.EncodingType.Base64,
                });

                await FileSystem.deleteAsync(uri, { idempotent: true });

                onAudioListo(audioBase64, segundos);
            } else {
                onCancelar();
            }
        } catch (err) {
            console.error("Error deteniendo grabación:", err);
            onCancelar();
        }
    };

    const formatSegundos = (s: number) => {
        const min = Math.floor(s / 60);
        const sec = s % 60;
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    };

    return (
        <View style={[
            styles.voiceCard,
            {
                backgroundColor: darkMode ? '#161922' : '#FFFFFF',
                borderColor: darkMode ? '#2A2F3D' : '#E2E8F0'
            }
        ]}>
            <View style={styles.voiceHeaderRow}>
                <View style={styles.recordingIndicatorRow}>
                    <View style={styles.recordingDot} />
                    <Text style={[styles.voiceStatusText, { color: darkMode ? '#F1F5F9' : '#0F172A' }]}>
                        {iniciado ? 'Grabando audio' : 'Inicializando...'}
                    </Text>
                </View>
                <Text style={[styles.voiceTimerText, { color: darkMode ? '#94A3B8' : '#64748B' }]}>
                    {formatSegundos(segundos)}
                </Text>
            </View>

            <View style={[
                styles.liveTranscriptBox,
                {
                    backgroundColor: darkMode ? '#0D0F14' : '#F8FAFC',
                    borderColor: darkMode ? '#1E2330' : '#E2E8F0'
                }
            ]}>
                <View style={styles.waveContainer}>
                    {barras.map((altura, idx) => (
                        <View
                            key={idx}
                            style={[
                                styles.waveBar,
                                {
                                    height: Math.max(8, Math.round(altura * 34)),
                                    backgroundColor: darkMode ? '#E2E8F0' : '#334155',
                                    opacity: iniciado ? 0.85 : 0.3
                                }
                            ]}
                        />
                    ))}
                </View>
                <Text style={{ color: darkMode ? '#64748B' : '#94A3B8', fontSize: 12, marginTop: 10 }}>
                    Habla claro y presiona Procesar al terminar
                </Text>
            </View>

            <View style={styles.voiceBtnRow}>
                <TouchableOpacity
                    style={[
                        styles.btnHalf,
                        { backgroundColor: darkMode ? '#222634' : '#F1F5F9', marginRight: 6 }
                    ]}
                    onPress={onCancelar}
                >
                    <Text style={{ color: darkMode ? '#94A3B8' : '#475569', fontWeight: '600', fontSize: 14 }}>
                        Cancelar
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.btnHalf,
                        { backgroundColor: darkMode ? '#F8FAFC' : '#0F172A', marginLeft: 6 }
                    ]}
                    onPress={finalizarYEnviar}
                    disabled={!iniciado}
                >
                    <Ionicons
                        name="arrow-up-circle"
                        size={18}
                        color={darkMode ? '#0F172A' : '#FFFFFF'}
                        style={{ marginRight: 6 }}
                    />
                    <Text style={{ color: darkMode ? '#0F172A' : '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
                        Procesar
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

export default function FloatingAIChat() {
    const { darkMode } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [iaActiva, setIaActiva] = useState(false);

    // Estados del flujo de voz (Soporta múltiples acciones simultáneas)
    const [estadoVoz, setEstadoVoz] = useState<'inactivo' | 'grabando' | 'procesando' | 'resultado'>('inactivo');
    const [textoTranscrito, setTextoTranscrito] = useState('');
    const [textoAnimado, setTextoAnimado] = useState('');
    const [respuestaVoz, setRespuestaVoz] = useState('');
    const [accionesEjecutadas, setAccionesEjecutadas] = useState<string[]>([]);

    const [messages, setMessages] = useState<{ text: string, sender: 'user' | 'ai' }[]>([
        { text: '¡Hola! Soy el asistente de DriveWallet. ¿En qué te ayudo hoy?', sender: 'ai' }
    ]);
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        const chequearEstadoIA = async () => {
            try {
                const estadoGuardado = await AsyncStorage.getItem('app_ia_activa');
                setIaActiva(estadoGuardado === 'true');
            } catch (error) {
                console.error("Error leyendo AsyncStorage:", error);
            }
        };

        chequearEstadoIA();
        const interval = setInterval(chequearEstadoIA, 2000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (estadoVoz !== 'resultado' || !textoTranscrito) {
            setTextoAnimado('');
            return;
        }

        let i = 0;
        setTextoAnimado('');
        const interval = setInterval(() => {
            i += 1;
            setTextoAnimado(textoTranscrito.slice(0, i));
            if (i >= textoTranscrito.length) {
                clearInterval(interval);
            }
        }, 18);

        return () => clearInterval(interval);
    }, [textoTranscrito, estadoVoz]);

    const obtenerContextoIA = async (mensajeUsuario: string) => {
        try {
            const now = new Date();
            // 1. Fechas exclusivas de este mes (para el resumen principal)
            const inicioMesActual = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0).getTime();
            const finMesActual = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();

            const ingresosMes = sumarIngresosDelMes(inicioMesActual, finMesActual);
            const gastosMes = sumarGastosDelMes(inicioMesActual, finMesActual);
            const netoMes = ingresosMes - gastosMes;

            const listaTodosLosMovimientos = obtenerMovimientosDelMes(0, now.getTime());

            let historialCompletoFormateado = "No hay transacciones registradas históricamente.";
            if (listaTodosLosMovimientos && listaTodosLosMovimientos.length > 0) {
                historialCompletoFormateado = listaTodosLosMovimientos.map(m => {
                    // Formateamos la fecha para que la IA lea el nombre del mes claro (Ej: "14 de agosto de 2026")
                    const fechaStr = new Date(m.fechaTimestamp).toLocaleDateString('es-DO', {
                        day: '2-digit', month: 'long', year: 'numeric'
                    });
                    return `- ${fechaStr}: ${m.tipo} de RD$ ${m.monto} (${m.nota || m.categoria})`;
                }).join('\n');
            }

            const vehicleType = await AsyncStorage.getItem('vehicle_type') || 'No definido';
            const vehicleBrand = await AsyncStorage.getItem('vehicle_brand') || 'No definido';
            const vehicleModel = await AsyncStorage.getItem('vehicle_model') || 'No definido';
            const vehicleYear = await AsyncStorage.getItem('vehicle_year') || 'No definido';
            const vehiclePlate = await AsyncStorage.getItem('vehicle_plate') || 'No definido';
            const vehiculoKilometraje = await AsyncStorage.getItem('vehiculo_kilometraje') || 'No definido';

            const aceiteTipo = await AsyncStorage.getItem('aceite_tipo') || 'No definido';
            const aceiteKm = await AsyncStorage.getItem('aceite_km') || 'No definido';
            const aceiteFecha = await AsyncStorage.getItem('aceite_fecha') || 'No definida';
            const transmisionFecha = await AsyncStorage.getItem('transmision_fecha') || 'No definida';
            const transmisionNotas = await AsyncStorage.getItem('transmision_notas') || 'Ninguna';
            const seguroCompania = await AsyncStorage.getItem('seguro_compania') || 'No definida';
            const seguroVencimiento = await AsyncStorage.getItem('seguro_vencimiento') || 'No definida';

            const pagosStr = await AsyncStorage.getItem('lista_pagos_pendientes');
            let pagosFormateados = "Ningún pago pendiente.";
            if (pagosStr) {
                const pagosObj = JSON.parse(pagosStr);
                if (pagosObj.length > 0) {
                    pagosFormateados = pagosObj.map((p: any) => `- ${p.tipo} (${p.banco}): RD$ ${p.monto} (Próximo cobro: ${p.fecha})`).join('\n');
                }
            }

            const metasStr = await AsyncStorage.getItem('lista_metas_adicionales');
            let metasFormateadas = "Ninguna meta configurada.";
            if (metasStr) {
                const metasObj = JSON.parse(metasStr);
                if (metasObj.length > 0) {
                    metasFormateadas = metasObj.map((m: any) => `- ${m.titulo}: RD$ ${m.acumulado || 0} ahorrado de RD$ ${m.monto}`).join('\n');
                }
            }

            return `
                ESTADO ACTUAL DEL CONDUCTOR:
                
                💰 RESUMEN DE ESTE MES ACTUAL:
                - Ingresos: RD$ ${ingresosMes}
                - Gastos: RD$ ${gastosMes}
                - Beneficio Neto: RD$ ${netoMes}

                📚 HISTORIAL COMPLETO DE TRANSACCIONES (TODOS LOS MESES):
                ${historialCompletoFormateado}

                🚘 DATOS DEL VEHÍCULO:
                - Vehículo: ${vehicleType} ${vehicleBrand} ${vehicleModel} (${vehicleYear})
                - Placa: ${vehiclePlate}
                - Kilometraje actual: ${vehiculoKilometraje}

                🔧 MANTENIMIENTOS Y SEGURO DEL CARRO:
                - Aceite (${aceiteTipo}): Cambiar a los ${aceiteKm} km o el ${aceiteFecha}
                - Transmisión: Revisión el ${transmisionFecha}. Notas: ${transmisionNotas}
                - Seguro del vehículo: Compañía ${seguroCompania}, fecha de vencimiento: ${seguroVencimiento}

                💳 PAGOS Y PRÉSTAMOS PENDIENTES:
                ${pagosFormateados}

                🎯 METAS DE AHORRO:
                ${metasFormateadas}
                
                --------------------
                SOLICITUD ACTUAL DEL USUARIO:
                "${mensajeUsuario}"
            `;
        } catch (error) {
            return `SOLICITUD ACTUAL: "${mensajeUsuario}"`;
        }
    };

    // 1. Selector de galería con verificación previa de permisos
    const abrirGaleriaParaIA = async () => {
        // Primero verificamos el estatus actual sin forzar el pop-up de golpe
        const { status: existingStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
        let finalStatus = existingStatus;

        // Si no los tiene concedidos, los pedimos formalmente
        if (existingStatus !== 'granted') {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            setMessages(prev => [...prev, { text: "Necesitamos permisos para acceder a tus fotos y leer los recibos.", sender: 'ai' }]);
            return null;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled && result.assets && result.assets[0].base64) {
            return {
                base64: result.assets[0].base64,
                mimeType: result.assets[0].mimeType || 'image/jpeg',
            };
        }
        return null;
    };

    // Función autónoma para enviar la imagen al nuevo endpoint /api/vision
    const procesarFacturaConIA = async (base64Image: string, mimeType: string) => {
        setIsTyping(true);
        setMessages(prev => [...prev, { text: "📷 Analizando recibo o voucher con IA...", sender: 'user' }]);

        try {
            const response = await fetch('https://www.jrtechnology.duckdns.org/ai/api/vision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    app_id: "drivewalletapp",
                    prompt: "Extrae los movimientos financieros de este comprobante.",
                    imagen: base64Image,
                    mimeType: mimeType
                })
            });

            if (!response.ok) {
                throw new Error("Error en el servidor de IA.");
            }

            const data = await response.json();
            const textoLimpio = (data.respuesta || '').replace(/```json/g, '').replace(/```/g, '').trim();
            const datosJSON = JSON.parse(textoLimpio);

            const respuestaIA = datosJSON.respuesta_chat || "Recibo procesado correctamente.";

            const listaMovimientos = Array.isArray(datosJSON.movimientos)
                ? datosJSON.movimientos
                : [];

            if (datosJSON.ejecutar_accion && listaMovimientos.length > 0) {
                let totalProcesados = 0;
                let resumenTexto = `✅ **${respuestaIA}**\n`;

                for (const mov of listaMovimientos) {
                    if (mov && mov.tipoMovimiento && mov.monto) {
                        const tipoNormalizado = String(mov.tipoMovimiento).toUpperCase().includes('INGRESO') ? 'INGRESO' : 'GASTO';
                        const montoNum = Number(mov.monto);
                        const notaFinal = mov.nota || (tipoNormalizado === 'INGRESO' ? 'Ingreso por imagen' : 'Gasto por imagen');

                        if (!isNaN(montoNum) && montoNum > 0) {
                            // 🔥 Inserción directa en SQLite local
                            insertarMovimientoRapido(tipoNormalizado, montoNum, notaFinal);
                            resumenTexto += `\n• ${tipoNormalizado}: RD$ ${montoNum.toLocaleString()} (${notaFinal})`;
                            totalProcesados++;
                        }
                    }
                }

                setMessages(prev => [...prev, { text: resumenTexto, sender: 'ai' }]);
            } else {
                setMessages(prev => [...prev, { text: respuestaIA || "No pude detectar transacciones claras en esta imagen.", sender: 'ai' }]);
            }

        } catch (error) {
            console.error("Error al procesar la imagen con IA:", error);
            setMessages(prev => [...prev, { text: "Hubo un error procesando el recibo en el servidor. Revisa tu conexión.", sender: 'ai' }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim()) return;
        const userMsg = input.trim();

        setMessages(prev => [...prev, { text: userMsg, sender: 'user' }]);
        setInput('');
        setIsTyping(true);

        try {
            const promptOculto = await obtenerContextoIA(userMsg);

            const response = await fetch('https://www.jrtechnology.duckdns.org/ai/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ app_id: "drivewalletapp", mensaje: promptOculto })
            });

            if (response.ok) {
                const data = await response.json();
                setMessages(prev => [...prev, { text: data.respuesta, sender: 'ai' }]);
            } else {
                setMessages(prev => [...prev, { text: "Hubo un error de conexión con el servidor.", sender: 'ai' }]);
            }
        } catch (error) {
            setMessages(prev => [...prev, { text: "No se pudo conectar con el asistente. Revisa tu conexión.", sender: 'ai' }]);
        } finally {
            setIsTyping(false);
        }
    };

    const abrirCuadroDeVoz = async () => {
        try {
            const status = await AudioModule.requestRecordingPermissionsAsync();
            if (!status.granted) {
                setMessages(prev => [...prev, { text: "Necesitas permitir el acceso al micrófono para usar voz.", sender: 'ai' }]);
                return;
            }
            setTextoTranscrito('');
            setTextoAnimado('');
            setRespuestaVoz('');
            setAccionesEjecutadas([]);
            setEstadoVoz('grabando');
        } catch (error) {
            console.error("Error al pedir permiso:", error);
        }
    };

    const procesarAudioConGemini = async (base64Audio: string, duracionSeg: number) => {
        if (!base64Audio || duracionSeg < 1) {
            setTextoTranscrito('No se detectó ninguna frase.');
            setRespuestaVoz('Mantén la grabación al menos un segundo mientras hablas.');
            setAccionesEjecutadas([]);
            setEstadoVoz('resultado');
            return;
        }

        setEstadoVoz('procesando');
        setIsTyping(true);

        try {
            const instruccionEstrictaAudio =
                "INSTRUCCIÓN CRÍTICA PARA EL AUDIO ADJUNTO: " +
                "1. Escucha únicamente el audio adjunto. Si está en silencio o no se entiende nada, devuelve: " +
                "{\"transcripcion\": \"\", \"respuesta_chat\": \"No escuché ninguna instrucción.\", \"ejecutar_accion\": false, \"movimientos\": []}. " +
                "2. Si el usuario menciona VARIOS gastos o ingresos en la misma frase (ej: 'registra 500 de combustible y 2000 de ingreso de Uber'), " +
                "DEBES incluir TODAS las transacciones como objetos separados dentro del array \"movimientos\".";

            const contextoBase = await obtenerContextoIA(instruccionEstrictaAudio);

            const response = await fetch('https://www.jrtechnology.duckdns.org/ai/api/audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    app_id: "drivewalletapp",
                    audio: base64Audio,
                    prompt: contextoBase
                })
            });

            if (response.ok) {
                const data = await response.json();
                const textoLimpio = (data.respuesta || '').replace(/```json/g, '').replace(/```/g, '').trim();
                const datosJSON = JSON.parse(textoLimpio);

                const loQueDijo = (datosJSON.transcripcion || '').trim();
                const respuestaIA = datosJSON.respuesta_chat || "Solicitud procesada.";

                if (!loQueDijo || loQueDijo.toLowerCase() === 'null') {
                    setTextoTranscrito('Sin voz detectada');
                    setRespuestaVoz('No se escuchó ninguna orden clara en el micrófono. Intenta hablar más cerca.');
                    setAccionesEjecutadas([]);
                    setEstadoVoz('resultado');
                    return;
                }

                setTextoTranscrito(loQueDijo);
                setRespuestaVoz(respuestaIA);

                setMessages(prev => [...prev, { text: `"${loQueDijo}"`, sender: 'user' }]);

                // Soporta tanto el nuevo array "movimientos" como el formato individual anterior
                const listaMovimientos = Array.isArray(datosJSON.movimientos)
                    ? datosJSON.movimientos
                    : (datosJSON.tipoMovimiento && datosJSON.monto)
                        ? [{ tipoMovimiento: datosJSON.tipoMovimiento, monto: datosJSON.monto, nota: datosJSON.nota }]
                        : [];

                if (datosJSON.ejecutar_accion && listaMovimientos.length > 0) {
                    const nuevosRegistros: string[] = [];

                    for (const mov of listaMovimientos) {
                        if (mov && mov.tipoMovimiento && mov.monto) {
                            const tipoNormalizado = String(mov.tipoMovimiento).toUpperCase().includes('INGRESO') ? 'INGRESO' : 'GASTO';
                            const montoNum = Number(mov.monto);
                            const notaFinal = mov.nota || (tipoNormalizado === 'INGRESO' ? 'Ingreso' : 'Gasto');

                            if (!isNaN(montoNum) && montoNum > 0) {
                                insertarMovimientoRapido(tipoNormalizado, montoNum, notaFinal);
                                nuevosRegistros.push(`${tipoNormalizado} registrado: RD$ ${montoNum.toLocaleString()} • ${notaFinal}`);
                            }
                        }
                    }

                    setAccionesEjecutadas(nuevosRegistros);
                } else {
                    setAccionesEjecutadas([]);
                }

                setMessages(prev => [...prev, { text: respuestaIA, sender: 'ai' }]);
                setEstadoVoz('resultado');
            } else {
                setEstadoVoz('inactivo');
                setMessages(prev => [...prev, { text: "Error procesando el audio en el servidor.", sender: 'ai' }]);
            }
        } catch (error) {
            console.error("Error en procesarAudioConGemini:", error);
            setEstadoVoz('inactivo');
            setMessages(prev => [...prev, { text: "No se pudo procesar el audio. Verifica tu conexión.", sender: 'ai' }]);
        } finally {
            setIsTyping(false);
        }
    };

    const cerrarCuadroResultado = () => {
        setTextoTranscrito('');
        setTextoAnimado('');
        setRespuestaVoz('');
        setAccionesEjecutadas([]);
        setEstadoVoz('inactivo');
    };

    if (!iaActiva) return null;

    const formatearTextoIA = (texto: string) => {
        const partes = texto.split(/\*\*(.*?)\*\*/g);
        return partes.map((parte, index) => {
            if (index % 2 === 1) {
                return <Text key={index} style={{ fontWeight: '700' }}>{parte}</Text>;
            }
            return <Text key={index}>{parte}</Text>;
        });
    };

    return (
        <>
            {!isOpen && (
                <TouchableOpacity style={styles.floatingBtn} onPress={() => setIsOpen(true)}>
                    <Ionicons name="sparkles" size={24} color="#FFFFFF" />
                </TouchableOpacity>
            )}

            <Modal animationType="fade" transparent={true} visible={isOpen}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                    style={styles.modalOverlay}
                >
                    <View style={[
                        styles.chatContainer,
                        {
                            backgroundColor: darkMode ? '#12141C' : '#FFFFFF',
                            borderColor: darkMode ? '#222634' : '#E2E8F0'
                        }
                    ]}>
                        <View style={[styles.chatHeader, { borderBottomColor: darkMode ? '#1E2230' : '#F1F5F9' }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={[styles.iconBg, { backgroundColor: darkMode ? '#1E2230' : '#F1F5F9' }]}>
                                    <Ionicons name="sparkles-outline" size={18} color={darkMode ? '#F8FAFC' : '#0F172A'} />
                                </View>
                                <View style={{ marginLeft: 10 }}>
                                    <Text style={[styles.headerTitle, { color: darkMode ? '#F8FAFC' : '#0F172A' }]}>
                                        Asistente DriveWallet
                                    </Text>
                                    <Text style={{ color: '#64748B', fontSize: 11 }}>
                                        Consultas y registro por voz
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => { cerrarCuadroResultado(); setIsOpen(false); }}>
                                <Ionicons name="close" size={22} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            ref={scrollViewRef}
                            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                            style={[styles.messagesArea, { backgroundColor: darkMode ? '#0B0D13' : '#F8FAFC' }]}
                            keyboardShouldPersistTaps="handled"
                        >
                            {messages.map((msg, idx) => (
                                <View
                                    key={idx}
                                    style={[
                                        styles.msgBubble,
                                        msg.sender === 'user'
                                            ? [styles.msgUser, { backgroundColor: darkMode ? '#262B3C' : '#0F172A' }]
                                            : [styles.msgAi, { backgroundColor: darkMode ? '#161922' : '#FFFFFF', borderColor: darkMode ? '#222634' : '#E2E8F0' }]
                                    ]}
                                >
                                    <Text style={{
                                        color: msg.sender === 'user' ? '#FFFFFF' : (darkMode ? '#E2E8F0' : '#1E293B'),
                                        lineHeight: 21,
                                        fontSize: 14
                                    }}>
                                        {msg.sender === 'user' ? msg.text : formatearTextoIA(msg.text)}
                                    </Text>
                                </View>
                            ))}
                            {isTyping && (
                                <View style={[styles.msgBubble, styles.msgAi, { backgroundColor: darkMode ? '#161922' : '#FFFFFF', borderColor: darkMode ? '#222634' : '#E2E8F0' }]}>
                                    <Text style={{ color: '#64748B', fontSize: 13 }}>Procesando...</Text>
                                </View>
                            )}
                        </ScrollView>

                        {estadoVoz !== 'inactivo' && (
                            <View style={styles.voiceOverlay}>
                                {estadoVoz === 'grabando' && (
                                    <GrabadorVozMinimal
                                        darkMode={darkMode}
                                        onAudioListo={procesarAudioConGemini}
                                        onCancelar={cerrarCuadroResultado}
                                    />
                                )}

                                {estadoVoz === 'procesando' && (
                                    <View style={[
                                        styles.voiceCard,
                                        {
                                            backgroundColor: darkMode ? '#161922' : '#FFFFFF',
                                            borderColor: darkMode ? '#2A2F3D' : '#E2E8F0'
                                        }
                                    ]}>
                                        <ActivityIndicator size="small" color={darkMode ? '#F8FAFC' : '#0F172A'} style={{ marginVertical: 12 }} />
                                        <Text style={[styles.voiceStatusText, { color: darkMode ? '#F8FAFC' : '#0F172A', textAlign: 'center' }]}>
                                            Transcribiendo audio...
                                        </Text>
                                        <Text style={{ color: '#64748B', fontSize: 12, marginTop: 4, textAlign: 'center' }}>
                                            Verificando datos de tu cuenta
                                        </Text>
                                    </View>
                                )}

                                {estadoVoz === 'resultado' && (
                                    <View style={[
                                        styles.voiceCard,
                                        {
                                            backgroundColor: darkMode ? '#161922' : '#FFFFFF',
                                            borderColor: darkMode ? '#2A2F3D' : '#E2E8F0'
                                        }
                                    ]}>
                                        <Text style={[styles.sectionCaption, { color: '#64748B' }]}>
                                            TRANSCRIPCIÓN
                                        </Text>

                                        <View style={[
                                            styles.liveTranscriptBox,
                                            {
                                                backgroundColor: darkMode ? '#0D0F14' : '#F8FAFC',
                                                borderColor: darkMode ? '#1E2330' : '#E2E8F0'
                                            }
                                        ]}>
                                            <Text style={{
                                                color: darkMode ? '#F8FAFC' : '#0F172A',
                                                fontSize: 15,
                                                fontWeight: '600',
                                                textAlign: 'center',
                                                lineHeight: 22
                                            }}>
                                                "{textoAnimado}"
                                            </Text>
                                        </View>

                                        {/* Renderiza cada uno de los movimientos guardados en SQLite */}
                                        {accionesEjecutadas.length > 0 && (
                                            <View style={{ width: '100%', gap: 6, marginBottom: 4 }}>
                                                {accionesEjecutadas.map((accionTxt, index) => (
                                                    <View
                                                        key={index}
                                                        style={[
                                                            styles.actionBanner,
                                                            {
                                                                backgroundColor: darkMode ? '#1E2433' : '#F1F5F9',
                                                                borderColor: darkMode ? '#2E364F' : '#CBD5E1'
                                                            }
                                                        ]}
                                                    >
                                                        <Ionicons
                                                            name="checkmark-circle-outline"
                                                            size={16}
                                                            color={darkMode ? '#E2E8F0' : '#0F172A'}
                                                            style={{ marginRight: 6 }}
                                                        />
                                                        <Text style={{
                                                            color: darkMode ? '#E2E8F0' : '#0F172A',
                                                            fontWeight: '600',
                                                            fontSize: 12,
                                                            flexShrink: 1
                                                        }}>
                                                            {accionTxt}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}

                                        <Text style={{
                                            color: darkMode ? '#94A3B8' : '#475569',
                                            fontSize: 13,
                                            textAlign: 'center',
                                            marginVertical: 12,
                                            lineHeight: 19
                                        }}>
                                            {formatearTextoIA(respuestaVoz)}
                                        </Text>

                                        <TouchableOpacity
                                            style={[
                                                styles.btnFullWidth,
                                                { backgroundColor: darkMode ? '#F8FAFC' : '#0F172A' }
                                            ]}
                                            onPress={cerrarCuadroResultado}
                                        >
                                            <Text style={{
                                                color: darkMode ? '#0F172A' : '#FFFFFF',
                                                fontWeight: '700',
                                                fontSize: 14
                                            }}>
                                                Continuar
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        )}

                        <View style={[
                            styles.inputArea,
                            {
                                borderTopColor: darkMode ? '#1E2230' : '#F1F5F9',
                                backgroundColor: darkMode ? '#12141C' : '#FFFFFF'
                            }
                        ]}>
                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: darkMode ? '#0B0D13' : '#F1F5F9',
                                        color: darkMode ? '#F8FAFC' : '#0F172A',
                                        borderColor: darkMode ? '#1E2230' : '#E2E8F0'
                                    }
                                ]}
                                placeholder="Escribe o usa el micrófono..."
                                placeholderTextColor="#64748B"
                                value={input}
                                onChangeText={setInput}
                                onSubmitEditing={handleSend}
                            />
                            <TouchableOpacity
                                style={[styles.sendBtn, { backgroundColor: darkMode ? '#222634' : '#0F172A', marginRight: 6 }]}
                                onPress={async () => {
                                    const imagen = await abrirGaleriaParaIA();
                                    if (imagen) {
                                        await procesarFacturaConIA(imagen.base64, imagen.mimeType);
                                    }
                                }}
                            >
                                <Ionicons name="camera-outline" size={20} color="#FFFFFF" />
                            </TouchableOpacity>

                            {input.trim() ? (
                                <TouchableOpacity
                                    style={[styles.sendBtn, { backgroundColor: darkMode ? '#F8FAFC' : '#0F172A' }]}
                                    onPress={handleSend}
                                >
                                    <Ionicons name="arrow-up" size={18} color={darkMode ? '#0F172A' : '#FFFFFF'} />
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={[styles.sendBtn, { backgroundColor: darkMode ? '#222634' : '#0F172A' }]}
                                    onPress={abrirCuadroDeVoz}
                                >
                                    <Ionicons name="mic-outline" size={20} color="#FFFFFF" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    floatingBtn: {
        position: 'absolute',
        bottom: 110,
        right: 25,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#1E293B',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 6,
        borderWidth: 1,
        borderColor: '#334155',
        zIndex: 1000
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    chatContainer: {
        width: '88%',
        height: 520,
        maxHeight: '85%',
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
        elevation: 20
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1
    },
    iconBg: {
        width: 34,
        height: 34,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center'
    },
    headerTitle: {
        fontWeight: '700',
        fontSize: 15
    },
    messagesArea: {
        flex: 1,
        padding: 16
    },
    msgBubble: {
        maxWidth: '85%',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
        marginBottom: 10
    },
    msgUser: {
        alignSelf: 'flex-end',
        borderBottomRightRadius: 4
    },
    msgAi: {
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 4,
        borderWidth: 1
    },
    inputArea: {
        flexDirection: 'row',
        padding: 12,
        borderTopWidth: 1,
        alignItems: 'center'
    },
    input: {
        flex: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        marginRight: 10,
        fontSize: 14
    },
    sendBtn: {
        width: 42,
        height: 42,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center'
    },
    voiceOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(9, 11, 16, 0.82)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        zIndex: 50
    },
    voiceCard: {
        width: '100%',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        elevation: 10
    },
    voiceHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14
    },
    recordingIndicatorRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    recordingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EF4444',
        marginRight: 8
    },
    voiceStatusText: {
        fontSize: 15,
        fontWeight: '700'
    },
    voiceTimerText: {
        fontSize: 14,
        fontWeight: '600',
        fontVariant: ['tabular-nums']
    },
    sectionCaption: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.8,
        marginBottom: 8
    },
    liveTranscriptBox: {
        width: '100%',
        minHeight: 84,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12
    },
    waveContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 36,
        gap: 6
    },
    waveBar: {
        width: 4,
        borderRadius: 2
    },
    actionBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        width: '100%'
    },
    voiceBtnRow: {
        flexDirection: 'row',
        width: '100%',
        marginTop: 4
    },
    btnHalf: {
        flex: 1,
        height: 44,
        flexDirection: 'row',
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center'
    },
    btnFullWidth: {
        width: '100%',
        height: 46,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4
    }
});