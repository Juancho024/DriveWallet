import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { insertarMovimiento } from '@/db/database'; // Importamos la conexión SQLite

interface QuickActionsProps {
    onMovimientoGuardado?: () => void; // Para refrescar la pantalla principal al guardar
}

export default function QuickActions({ onMovimientoGuardado }: QuickActionsProps) {
    const router = useRouter();
    const { darkMode } = useTheme();

    const [modalVisible, setModalVisible] = useState(false);
    const [modalType, setModalType] = useState<'Ingreso' | 'Gasto'>('Ingreso');

    // Estados para los inputs del modal
    const [monto, setMonto] = useState('');
    const [descripcion, setDescripcion] = useState('');

    const openModal = (type: 'Ingreso' | 'Gasto') => {
        setModalType(type);
        setMonto('');
        setDescripcion('');
        setModalVisible(true);
    };

    const handleGuardar = () => {
        if (!monto || isNaN(Number(monto))) return;

        const tipoReal = modalType === 'Ingreso' ? 'INGRESO' : 'GASTO';

        // Guardar directamente en la base de datos SQLite
        insertarMovimiento({
            tipo: tipoReal,
            categoria: modalType === 'Ingreso' ? 'Ingreso General' : 'Gasto General',
            monto: parseFloat(monto),
            fechaTimestamp: Date.now(),
            nota: descripcion || modalType
        });

        setModalVisible(false);

        // Si la pantalla principal pasó una función para recargar, la ejecutamos
        if (onMovimientoGuardado) {
            onMovimientoGuardado();
        }
    };

    return (
        <View>
            <View style={styles.actionsContainer}>
                <ActionBtn icon="add" label="Ingreso" onPress={() => openModal('Ingreso')} darkMode={darkMode} />
                <ActionBtn icon="remove" label="Gasto" onPress={() => openModal('Gasto')} darkMode={darkMode} />
                <ActionBtn icon="calendar" label="Reservas" onPress={() => router.push('/reservations' as any)} darkMode={darkMode} />
                <ActionBtn icon="list" label="Historial" onPress={() => router.push('/(tabs)/statistics' as any)} darkMode={darkMode} />
            </View>

            {/* Modal para Ingresos/Gastos adaptado para evitar el teclado */}
            <Modal animationType="slide" transparent={true} visible={modalVisible}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={[styles.modalContent, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                        <ScrollView contentContainerStyle={{ paddingBottom: 5 }} showsVerticalScrollIndicator={false}>
                            <Text style={[styles.modalTitle, { color: darkMode ? '#FFF' : '#000' }]}>Registrar {modalType}</Text>

                            <TextInput
                                style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE', borderWidth: 1 }]}
                                placeholder="Monto (ej. 500)"
                                keyboardType="numeric"
                                placeholderTextColor="#A0A0A0"
                                value={monto}
                                onChangeText={setMonto}
                            />
                            <TextInput
                                style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE', borderWidth: 1 }]}
                                placeholder="Descripción (ej. Combustible)"
                                placeholderTextColor="#A0A0A0"
                                value={descripcion}
                                onChangeText={setDescripcion}
                            />

                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={[styles.btn, { backgroundColor: darkMode ? '#3A1A1A' : '#FFEBEE' }]} onPress={() => setModalVisible(false)}>
                                    <Text style={styles.btnTextCancel}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.btn, { backgroundColor: darkMode ? '#FFF' : '#1E1E1E' }]} onPress={handleGuardar}>
                                    <Text style={[styles.btnTextSave, { color: darkMode ? '#000' : '#FFF' }]}>Guardar</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const ActionBtn = ({ icon, label, onPress, darkMode }: any) => (
    <View style={styles.actionBtnWrapper}>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: darkMode ? '#333' : '#FFF' }]} onPress={onPress}>
            <Ionicons name={icon} size={24} color={darkMode ? '#FFF' : '#000'} />
        </TouchableOpacity>
        <Text style={[styles.actionLabel, { color: darkMode ? '#B0B0B0' : '#A0A0A0' }]}>{label}</Text>
    </View>
);

const styles = StyleSheet.create({
    actionsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
    actionBtnWrapper: { alignItems: 'center' },
    actionBtn: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    actionLabel: { fontSize: 12 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { padding: 25, borderRadius: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    input: { padding: 15, borderRadius: 10, marginBottom: 15, fontSize: 16 },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
    btn: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center', marginHorizontal: 5 },
    btnTextCancel: { color: '#F44336', fontWeight: 'bold' },
    btnTextSave: { fontWeight: 'bold' }
});