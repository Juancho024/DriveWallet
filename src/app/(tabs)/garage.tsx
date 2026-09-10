import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

    const [input1, setInput1] = useState('');
    const [input2, setInput2] = useState('');
    const [input3, setInput3] = useState('');

    // Sistema de Alertas Personalizadas
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertConfig, setAlertConfig] = useState({
        title: '',
        message: '',
        type: 'info' as 'info' | 'error' | 'success' | 'confirm'
    });

    const mostrarAlerta = (title: string, message: string, type: 'info' | 'error' | 'success' | 'confirm' = 'info') => {
        setAlertConfig({ title, message, type });
        setAlertVisible(true);
    };

    useFocusEffect(
        useCallback(() => {
            cargarDatosGarage();
        }, [])
    );

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
        } catch (error) {
            console.error("Error al cargar garage:", error);
        }
    };

    const openEdit = async (title: string) => {
        setSelectedItem(title);
        setInput1('');
        setInput2('');
        setInput3('');

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

    const handleGuardar = async () => {
        try {
            if (selectedItem === 'Aceite de Motor') {
                await AsyncStorage.setItem('aceite_tipo', input1);
                await AsyncStorage.setItem('aceite_km', input2);
                await AsyncStorage.setItem('aceite_fecha', input3);
                if (input2) {
                    await AsyncStorage.setItem('vehiculo_kilometraje', `${input2} km`);
                }
            } else if (selectedItem === 'Transmisión') {
                await AsyncStorage.setItem('transmision_fecha', input1);
                await AsyncStorage.setItem('transmision_notas', input2);
            } else if (selectedItem === 'Seguro del Vehículo') {
                await AsyncStorage.setItem('seguro_compania', input1);
                await AsyncStorage.setItem('seguro_vencimiento', input2);
            }

            setModalVisible(false);
            mostrarAlerta("¡Éxito!", "Mantenimiento actualizado.", "success");
            cargarDatosGarage();
        } catch (error) {
            mostrarAlerta("Error", "No se pudo guardar la información.", "error");
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: darkMode ? '#121212' : '#F5F7FA' }]}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
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

                <Text style={[styles.sectionTitle, { color: darkMode ? '#FFF' : '#000' }]}>Mantenimientos y Control</Text>

                <MaintenanceItem icon="build" title="Aceite de Motor" subtitle={subAceite} color="#4CAF50" onPress={() => openEdit('Aceite de Motor')} darkMode={darkMode} />
                <MaintenanceItem icon="settings" title="Transmisión" subtitle={subTransmision} color="#FF9800" onPress={() => openEdit('Transmisión')} darkMode={darkMode} />
                <MaintenanceItem icon="shield-checkmark" title="Seguro del Vehículo" subtitle={subSeguro} color="#2196F3" onPress={() => openEdit('Seguro del Vehículo')} darkMode={darkMode} />
            </ScrollView>

            <Modal animationType="slide" transparent={true} visible={modalVisible}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF', maxHeight: '85%' }]}>
                        <ScrollView contentContainerStyle={{ paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
                            <Text style={[styles.modalTitle, { color: darkMode ? '#FFF' : '#000', marginBottom: 20 }]}>Configurar {selectedItem}</Text>

                            {selectedItem === 'Aceite de Motor' && (
                                <>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]}
                                        placeholder="Tipo de Aceite (ej. 10W30)"
                                        placeholderTextColor="#A0A0A0"
                                        value={input1}
                                        onChangeText={setInput1}
                                    />
                                    <TextInput
                                        style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]}
                                        placeholder="Kilometraje objetivo / actual"
                                        keyboardType="numeric"
                                        placeholderTextColor="#A0A0A0"
                                        value={input2}
                                        onChangeText={setInput2}
                                    />
                                    <TextInput
                                        style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]}
                                        placeholder="Fecha Próximo Cambio (DD/MM/AAAA)"
                                        placeholderTextColor="#A0A0A0"
                                        value={input3}
                                        onChangeText={setInput3}
                                    />
                                </>
                            )}

                            {selectedItem === 'Transmisión' && (
                                <>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]}
                                        placeholder="Fecha Próxima (DD/MM/AAAA)"
                                        placeholderTextColor="#A0A0A0"
                                        value={input1}
                                        onChangeText={setInput1}
                                    />
                                    <TextInput
                                        style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]}
                                        placeholder="Observaciones o Notas"
                                        placeholderTextColor="#A0A0A0"
                                        value={input2}
                                        onChangeText={setInput2}
                                    />
                                </>
                            )}

                            {selectedItem === 'Seguro del Vehículo' && (
                                <>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]}
                                        placeholder="Compañía Aseguradora"
                                        placeholderTextColor="#A0A0A0"
                                        value={input1}
                                        onChangeText={setInput1}
                                    />
                                    <TextInput
                                        style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]}
                                        placeholder="Fecha de Vencimiento (DD/MM/AAAA)"
                                        placeholderTextColor="#A0A0A0"
                                        value={input2}
                                        onChangeText={setInput2}
                                    />
                                </>
                            )}

                            <View style={[styles.modalButtons, { marginTop: 15 }]}>
                                <TouchableOpacity style={[styles.btn, { backgroundColor: darkMode ? '#2A2A2A' : '#FFEBEE' }]} onPress={() => setModalVisible(false)}>
                                    <Text style={[styles.btnTextCancel, { color: darkMode ? '#AAA' : '#F44336' }]}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.btn, { backgroundColor: darkMode ? '#FFF' : '#1E1E1E' }]} onPress={handleGuardar}>
                                    <Text style={[styles.btnTextSave, { color: darkMode ? '#000' : '#FFF' }]}>Guardar</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Modal de Alerta Personalizada */}
            <Modal animationType="fade" transparent={true} visible={alertVisible}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.customAlertBox, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                        <View style={[styles.alertIconContainer, { backgroundColor: alertConfig.type === 'error' ? (darkMode ? '#3A1A1A' : '#FFEBEE') : (darkMode ? '#1A3320' : '#E8F5E9') }]}>
                            <Ionicons name={alertConfig.type === 'error' ? 'alert-circle' : 'checkmark-circle'} size={32} color={alertConfig.type === 'error' ? '#F44336' : '#4CAF50'} />
                        </View>
                        <Text style={[styles.customAlertTitle, { color: darkMode ? '#FFF' : '#000' }]}>{alertConfig.title}</Text>
                        <Text style={[styles.customAlertMessage, { color: darkMode ? '#A0A0A0' : '#666' }]}>{alertConfig.message}</Text>
                        <TouchableOpacity style={[styles.alertBtn, { backgroundColor: darkMode ? '#FFF' : '#1E1E1E', width: '100%' }]} onPress={() => setAlertVisible(false)}>
                            <Text style={{ color: darkMode ? '#000' : '#FFF', fontWeight: 'bold' }}>Aceptar</Text>
                        </TouchableOpacity>
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
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
    maintenanceCard: { flexDirection: 'row', padding: 16, borderRadius: 16, alignItems: 'center', marginBottom: 12, elevation: 2 },
    iconContainer: { padding: 10, borderRadius: 12, marginRight: 15 },
    maintenanceInfo: { flex: 1 },
    maintenanceTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    maintenanceDate: { fontSize: 12 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
    modalContent: { padding: 25, borderRadius: 24, elevation: 5 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    input: { padding: 14, borderRadius: 10, marginBottom: 15, fontSize: 15, borderWidth: 1 },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    btn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', marginHorizontal: 5 },
    btnTextCancel: { fontWeight: 'bold' },
    btnTextSave: { fontWeight: 'bold' },
    customAlertBox: { padding: 25, borderRadius: 24, alignItems: 'center', elevation: 10 },
    alertIconContainer: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
    customAlertTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    customAlertMessage: { fontSize: 14, textAlign: 'center', marginBottom: 25, lineHeight: 20 },
    alertBtn: { padding: 14, borderRadius: 12, alignItems: 'center' }
});