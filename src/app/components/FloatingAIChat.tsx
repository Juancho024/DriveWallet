import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sumarIngresosDelMes, sumarGastosDelMes, obtenerMovimientosDelMes} from '@/db/database';

export default function FloatingAIChat() {
    const { darkMode } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [iaActiva, setIaActiva] = useState(false);

    const [messages, setMessages] = useState<{ text: string, sender: 'user' | 'ai' }[]>([
        { text: '¡Hola! Soy la IA de DriveWallet 🚘. ¿Quieres que analice tus gastos o te ayude con algo de la app?', sender: 'ai' }
    ]);
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        const chequearEstadoIA = async () => {
            const estadoGuardado = await AsyncStorage.getItem('app_ia_activa');
            setIaActiva(estadoGuardado === 'true');
        };

        chequearEstadoIA();
        const interval = setInterval(chequearEstadoIA, 2000);
        return () => clearInterval(interval);
    }, []);

    const handleSend = async () => {
        if (!input.trim()) return;
        const userMsg = input.trim();

        setMessages(prev => [...prev, { text: userMsg, sender: 'user' }]);
        setInput('');
        setIsTyping(true);

        try {
            const now = new Date();
            const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0).getTime();
            const finMes = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();

            const ingresos = sumarIngresosDelMes(inicioMes, finMes);
            const gastos = sumarGastosDelMes(inicioMes, finMes);
            const neto = ingresos - gastos;

            // 🔥 NUEVO: OBTENEMOS EL HISTORIAL DETALLADO DE ESTE MES
            const listaMovimientos = obtenerMovimientosDelMes(inicioMes, finMes);
            let movimientosFormateados = "No hay transacciones registradas este mes.";
            if (listaMovimientos && listaMovimientos.length > 0) {
                movimientosFormateados = listaMovimientos.map(m => {
                    const fechaStr = new Date(m.fechaTimestamp).toLocaleDateString('es-DO');
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
                    pagosFormateados = pagosObj.map((p: any) =>
                        `- ${p.tipo} (${p.banco}): RD$ ${p.monto} (Próximo cobro: ${p.fecha})`
                    ).join('\n');
                }
            }

            const metasStr = await AsyncStorage.getItem('lista_metas_adicionales');
            let metasFormateadas = "Ninguna meta configurada.";
            if (metasStr) {
                const metasObj = JSON.parse(metasStr);
                if (metasObj.length > 0) {
                    metasFormateadas = metasObj.map((m: any) =>
                        `- ${m.titulo}: RD$ ${m.acumulado || 0} ahorrado de RD$ ${m.monto}`
                    ).join('\n');
                }
            }

            const promptOculto = `
                ESTADO ACTUAL DEL CONDUCTOR:
                
                💰 FINANZAS ESTE MES:
                - Ingresos: RD$ ${ingresos}
                - Gastos: RD$ ${gastos}
                - Beneficio Neto: RD$ ${neto}

                📋 HISTORIAL DE TRANSACCIONES DEL MES:
                ${movimientosFormateados}

                🚘 DATOS DEL VEHÍCULO:
                - Vehículo: ${vehicleType} ${vehicleBrand} ${vehicleModel} (${vehicleYear})
                - Placa: ${vehiclePlate}
                - Kilometraje actual: ${vehiculoKilometraje}

                🔧 MANTENIMIENTOS:
                - Aceite (${aceiteTipo}): Cambiar a los ${aceiteKm} km o el ${aceiteFecha}
                - Transmisión: Revisión el ${transmisionFecha}. Notas: ${transmisionNotas}
                - Seguro: Compañía ${seguroCompania}, vence el ${seguroVencimiento}

                💳 PAGOS Y PRÉSTAMOS PENDIENTES:
                ${pagosFormateados}

                🎯 METAS DE AHORRO:
                ${metasFormateadas}
                
                --------------------
                PREGUNTA O COMANDO DEL USUARIO: 
                "${userMsg}"
                
                INSTRUCCIONES PARA TI (GEMINI): 
                Responde directamente a la pregunta usando esta información de fondo si es necesaria. 
                Si te preguntan "¿Cuándo vence mi seguro?" o "¿Cuánto he gastado en aceite o gasolina?", respóndelo con exactitud buscando en el HISTORIAL DE TRANSACCIONES. 
                NUNCA menciones que recibiste un "contexto", "prompt oculto", "historial" o "datos del sistema". Actúa como si conocieras la base de datos mágicamente. 
                Mantén tu personalidad de asistente dominicano profesional, servicial y conciso.
            `;

            const response = await fetch('https://www.jrtechnology.duckdns.org/ai/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ app_id: "drivewalletapp", mensaje: promptOculto })
            });

            if (response.ok) {
                const data = await response.json();
                setMessages(prev => [...prev, { text: data.respuesta, sender: 'ai' }]);
            } else {
                setMessages(prev => [...prev, { text: "Ups, hubo un error de conexión con la API.", sender: 'ai' }]);
            }
        } catch (error) {
            setMessages(prev => [...prev, { text: "No pude conectar con el cerebro de Gemini. Revisa tu conexión.", sender: 'ai' }]);
        } finally {
            setIsTyping(false);
        }
    };

    if (!iaActiva) return null;

    // 🔥 Función mágica para convertir los **asteriscos** en negritas reales
    const formatearTextoIA = (texto: string) => {
        // Divide el texto usando los ** como separadores
        const partes = texto.split(/\*\*(.*?)\*\*/g);

        return partes.map((parte, index) => {
            // Los índices impares son el texto que estaba dentro de los **
            if (index % 2 === 1) {
                return <Text key={index} style={{ fontWeight: '900' }}>{parte}</Text>;
            }
            return <Text key={index}>{parte}</Text>;
        });
    };

    return (
        <>
            {!isOpen && (
                <TouchableOpacity style={styles.floatingBtn} onPress={() => setIsOpen(true)}>
                    <Ionicons name="hardware-chip" size={28} color="#121212" />
                    <View style={styles.pingDot} />
                </TouchableOpacity>
            )}

            <Modal animationType="fade" transparent={true} visible={isOpen}>
                {/* 🔥 SOLUCIÓN: Usamos behavior="padding" en TODOS los dispositivos y ajustamos el alto */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                    style={styles.modalOverlay}
                >
                    <View style={[styles.chatContainer, { backgroundColor: darkMode ? '#151924' : '#FFF' }]}>

                        <View style={[styles.chatHeader, { borderBottomColor: darkMode ? '#232838' : '#EEE' }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={[styles.iconBg, { backgroundColor: darkMode ? '#0B0E14' : '#F0F0F0' }]}>
                                    <Ionicons name="hardware-chip" size={20} color="#9C27B0" />
                                </View>
                                <View style={{ marginLeft: 10 }}>
                                    <Text style={[styles.headerTitle, { color: darkMode ? '#FFF' : '#000' }]}>Asistente IA</Text>
                                    <Text style={{ color: '#888', fontSize: 10 }}>Soporte DriveWallet</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => setIsOpen(false)}>
                                <Ionicons name="close" size={24} color={darkMode ? '#AAA' : '#666'} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            ref={scrollViewRef}
                            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                            style={[styles.messagesArea, { backgroundColor: darkMode ? '#0B0E14' : '#F5F7FA' }]}
                            keyboardShouldPersistTaps="handled"
                        >
                            {messages.map((msg, idx) => (
                                <View key={idx} style={[styles.msgBubble, msg.sender === 'user' ? styles.msgUser : [styles.msgAi, { backgroundColor: darkMode ? '#1D2026' : '#FFF', borderColor: darkMode ? '#232838' : '#DDD' }]]}>
                                    <Text style={{ color: msg.sender === 'user' ? '#000' : (darkMode ? '#E1E2EB' : '#333'), lineHeight: 22 }}>
                                        {msg.sender === 'user' ? msg.text : formatearTextoIA(msg.text)}
                                    </Text>
                                </View>
                            ))}
                            {isTyping && (
                                <View style={[styles.msgBubble, styles.msgAi, { backgroundColor: darkMode ? '#1D2026' : '#FFF', borderColor: darkMode ? '#232838' : '#DDD' }]}>
                                    <Text style={{ color: darkMode ? '#AAA' : '#888', fontStyle: 'italic' }}>Analizando...</Text>
                                </View>
                            )}
                        </ScrollView>

                        <View style={[styles.inputArea, { borderTopColor: darkMode ? '#232838' : '#EEE', backgroundColor: darkMode ? '#151924' : '#FFF' }]}>
                            <TextInput
                                style={[styles.input, { backgroundColor: darkMode ? '#0B0E14' : '#F0F0F0', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#232838' : '#DDD' }]}
                                placeholder="Hazle una pregunta..."
                                placeholderTextColor="#888"
                                value={input}
                                onChangeText={setInput}
                                onSubmitEditing={handleSend}
                            />
                            <TouchableOpacity style={[styles.sendBtn, { opacity: input.trim() ? 1 : 0.5 }]} onPress={handleSend} disabled={!input.trim()}>
                                <Ionicons name="send" size={16} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    floatingBtn: { position: 'absolute', bottom: 110, right: 25, width: 60, height: 60, borderRadius: 30, backgroundColor: '#D0BCFF', justifyContent: 'center', alignItems: 'center', elevation: 10, shadowColor: '#D0BCFF', shadowOpacity: 0.5, shadowRadius: 5, zIndex: 1000 },
    pingDot: { position: 'absolute', top: 5, right: 5, width: 12, height: 12, borderRadius: 6, backgroundColor: '#121212', borderWidth: 2, borderColor: '#D0BCFF' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },

    // 🔥 SOLUCIÓN: Quitamos el "height: 60%" rígido y usamos height numérico con maxHeight dinámico
    chatContainer: { width: '85%', height: 480, maxHeight: '80%', borderRadius: 24, overflow: 'hidden', elevation: 20 },

    chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1 },
    iconBg: { padding: 6, borderRadius: 8, borderWidth: 1, borderColor: '#232838' },
    headerTitle: { fontWeight: 'bold', fontSize: 16 },
    messagesArea: { flex: 1, padding: 15 },
    msgBubble: { maxWidth: '85%', padding: 12, borderRadius: 16, marginBottom: 10 },
    msgUser: { alignSelf: 'flex-end', backgroundColor: '#D0BCFF', borderBottomRightRadius: 4 },
    msgAi: { alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1 },
    inputArea: { flexDirection: 'row', padding: 10, borderTopWidth: 1, alignItems: 'center' },
    input: { flex: 1, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, borderWidth: 1, marginRight: 10 },
    sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#D0BCFF', justifyContent: 'center', alignItems: 'center' }
});