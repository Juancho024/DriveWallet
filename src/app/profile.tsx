import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform, StatusBar, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

export default function Profile() {
    const router = useRouter();
    const { darkMode } = useTheme();

    // Datos del Conductor
    const [fullName, setFullName] = useState('');
    const [alias, setAlias] = useState('');
    const [phone, setPhone] = useState('');
    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Estados para Reseñas y Calificaciones
    const [resenas, setResenas] = useState<any[]>([]);
    const [promedioCalificacion, setPromedioCalificacion] = useState('0.0');
    const [isLoadingResenas, setIsLoadingResenas] = useState(false);

    // Estados para cambio de contraseña seguro
    const [showPasswordSection, setShowPasswordSection] = useState(false);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Sistema de Alertas Personalizadas Unificadas
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
        cargarDatosPerfilYResenas();
    }, []);

    const cargarDatosPerfilYResenas = async () => {
        try {
            const nombreGuardado = await AsyncStorage.getItem('conductor_nombre');
            const aliasGuardado = await AsyncStorage.getItem('conductor_alias');
            const telefonoGuardado = await AsyncStorage.getItem('conductor_telefono');
            const fotoGuardada = await AsyncStorage.getItem('conductor_foto');
            const conductorId = await AsyncStorage.getItem('conductor_id');
            const token = await AsyncStorage.getItem('user_token');

            if (nombreGuardado) setFullName(nombreGuardado);
            if (aliasGuardado) setAlias(aliasGuardado);
            if (telefonoGuardado) setPhone(telefonoGuardado);
            if (fotoGuardada) setAvatarUri(fotoGuardada);

            if (conductorId && token) {
                cargarResenasDelServidor(conductorId, token);
            }
        } catch (error) {
            console.error("Error al cargar perfil local:", error);
        }
    };

    const cargarResenasDelServidor = async (conductorId: string, token: string) => {
        setIsLoadingResenas(true);
        try {
            const API_URL = `https://www.jrtechnology.duckdns.org/drivewallet/api/resenas/conductor/${conductorId}`;
            const response = await fetch(API_URL, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    const resenasOrdenadas = data.sort((a, b) => {
                        const fechaA = new Date(a.fecha_creacion || 0).getTime();
                        const fechaB = new Date(b.fecha_creacion || 0).getTime();
                        return fechaB - fechaA;
                    });

                    setResenas(resenasOrdenadas);

                    const suma = resenasOrdenadas.reduce((acc, curr) => acc + (curr.calificacion || 0), 0);
                    const promedio = (suma / resenasOrdenadas.length).toFixed(1);
                    setPromedioCalificacion(promedio);
                } else {
                    setResenas([]);
                    setPromedioCalificacion('5.0');
                }
            }
        } catch (error) {
            console.error("Error al obtener reseñas:", error);
        } finally {
            setIsLoadingResenas(false);
        }
    };

    // --- SELECCIONAR Y SUBIR FOTO REAL DESDE LA GALERÍA ---
    const handleChangePhoto = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
            mostrarAlerta("Permiso requerido", "Se necesita acceso a la galería para cambiar la foto de perfil.", "error");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            subirFotoAlServidor(asset.uri);
        }
    };

    const subirFotoAlServidor = async (uri: string) => {
        setIsSaving(true);
        try {
            const token = await AsyncStorage.getItem('user_token');
            const conductorId = await AsyncStorage.getItem('conductor_id');

            if (!conductorId || !token) {
                mostrarAlerta("Sesión expirada", "Por favor inicia sesión nuevamente.", "error");
                return;
            }

            const API_URL = `https://www.jrtechnology.duckdns.org/drivewallet/api/conductores/${conductorId}/subir-foto`;

            const response = await FileSystem.uploadAsync(API_URL, uri, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                httpMethod: 'POST',
                uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                fieldName: 'archivo',
            });

            if (response.status === 200 || response.status === 201) {
                setAvatarUri(uri);
                await AsyncStorage.setItem('conductor_foto', uri);
                mostrarAlerta("¡Éxito!", "Foto de perfil actualizada correctamente.", "success");
            } else {
                mostrarAlerta("Aviso", "No se pudo subir la foto al servidor.", "error");
            }
        } catch (error) {
            console.error("Error al subir foto:", error);
            mostrarAlerta("Error", "Error de conexión al subir la imagen.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async () => {
        if (showPasswordSection || oldPassword || newPassword || confirmPassword) {
            if (!oldPassword) {
                mostrarAlerta("Seguridad", "Debes ingresar tu contraseña actual para autorizar los cambios.", "error");
                return;
            }
            if (!newPassword || !confirmPassword) {
                mostrarAlerta("Seguridad", "Por favor completa los campos de la nueva contraseña.", "error");
                return;
            }
            if (newPassword !== confirmPassword) {
                mostrarAlerta("Error", "Las nuevas contraseñas no coinciden.", "error");
                return;
            }
            if (newPassword.length < 6) {
                mostrarAlerta("Seguridad", "La nueva contraseña debe tener al menos 6 caracteres.", "error");
                return;
            }
        }

        setIsSaving(true);

        try {
            const token = await AsyncStorage.getItem('user_token');
            const conductorId = await AsyncStorage.getItem('conductor_id');

            const API_URL = `https://www.jrtechnology.duckdns.org/drivewallet/api/conductores/actualizar/${conductorId}`;

            const response = await fetch(API_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    nombre: fullName,
                    telefono: phone,
                    alias_web: alias,
                    passwordActual: oldPassword || null,
                    passwordNueva: newPassword || null
                }),
            });

            await AsyncStorage.setItem('conductor_nombre', fullName);
            await AsyncStorage.setItem('conductor_alias', alias);
            await AsyncStorage.setItem('conductor_telefono', phone);

            if (response.ok) {
                mostrarAlerta("¡Éxito!", "Los datos de tu perfil y seguridad se han actualizado correctamente.", "success", () => {
                    router.back();
                });
            } else {
                mostrarAlerta("Aviso", "Cambios guardados localmente en tu dispositivo.", "info", () => {
                    router.back();
                });
            }
        } catch (error) {
            console.error("Error de red al actualizar perfil:", error);
            await AsyncStorage.setItem('conductor_nombre', fullName);
            await AsyncStorage.setItem('conductor_alias', alias);
            await AsyncStorage.setItem('conductor_telefono', phone);

            mostrarAlerta("Aviso", "Se han guardado los cambios localmente en tu dispositivo.", "info", () => {
                router.back();
            });
        } finally {
            setIsSaving(false);
        }
    };

    const renderEstrellas = (calificacion: number) => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <Ionicons
                    key={i}
                    name={i <= calificacion ? "star" : "star-outline"}
                    size={14}
                    color="#FFC107"
                    style={{ marginRight: 2 }}
                />
            );
        }
        return stars;
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: darkMode ? '#121212' : '#F5F7FA' }]}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

                {/* Cabecera */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={darkMode ? '#FFF' : '#000'} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: darkMode ? '#FFF' : '#000' }]}>Mi Perfil</Text>
                    <View style={{ width: 24 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    {/* Contenedor del Avatar y Calificación General */}
                    <View style={styles.avatarContainer}>
                        <View style={[styles.avatarWrapper, { borderColor: darkMode ? '#333' : '#E0E0E0' }]}>
                            {avatarUri ? (
                                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                            ) : (
                                <Ionicons name="person" size={50} color={darkMode ? '#AAA' : '#555'} />
                            )}
                            <TouchableOpacity
                                style={[styles.cameraBtn, { backgroundColor: '#4CAF50', borderColor: darkMode ? '#121212' : '#FFF' }]}
                                onPress={handleChangePhoto}
                            >
                                <Ionicons name="camera" size={16} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.ratingBadge, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF', borderColor: darkMode ? '#333' : '#E0E0E0' }]}>
                            <Ionicons name="star" size={16} color="#FFC107" style={{ marginRight: 4 }} />
                            <Text style={[styles.ratingText, { color: darkMode ? '#FFF' : '#000' }]}>{promedioCalificacion}</Text>
                            <Text style={{ color: '#888', fontSize: 12, marginLeft: 4 }}>({resenas.length} reseñas)</Text>
                        </View>

                        <TouchableOpacity onPress={handleChangePhoto}>
                            <Text style={styles.changePhotoText}>Cambiar foto de perfil</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Sección: Reseñas y Calificaciones Organizadas */}
                    <Text style={[styles.sectionTitle, { color: darkMode ? '#888' : '#666' }]}>Reseñas y Calificaciones de Clientes</Text>
                    <View style={[styles.card, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF', paddingVertical: 10 }]}>
                        {isLoadingResenas ? (
                            <ActivityIndicator size="small" color="#2196F3" style={{ marginVertical: 15 }} />
                        ) : resenas.length === 0 ? (
                            <View style={{ alignItems: 'center', paddingVertical: 15 }}>
                                <Ionicons name="chatbubble-outline" size={30} color={darkMode ? '#555' : '#AAA'} />
                                <Text style={{ color: darkMode ? '#888' : '#666', fontSize: 13, marginTop: 6 }}>Aún no tienes reseñas registradas.</Text>
                            </View>
                        ) : (
                            resenas.map((item, index) => (
                                <View key={index} style={[styles.resenaItem, { borderBottomColor: darkMode ? '#2A2A2A' : '#F0F0F0', borderBottomWidth: index === resenas.length - 1 ? 0 : 1 }]}>
                                    <View style={styles.resenaHeader}>
                                        <View style={{ flexDirection: 'row' }}>
                                            {renderEstrellas(item.calificacion)}
                                        </View>
                                        <Text style={[styles.resenaFecha, { color: darkMode ? '#777' : '#999' }]}>
                                            {item.fecha_creacion ? new Date(item.fecha_creacion).toLocaleDateString() : 'Reciente'}
                                        </Text>
                                    </View>
                                    <Text style={[styles.resenaComentario, { color: darkMode ? '#DDD' : '#333' }]}>
                                        "{item.comentario || 'Sin comentario escrito.'}"
                                    </Text>
                                </View>
                            ))
                        )}
                    </View>

                    {/* Sección: Información Personal */}
                    <Text style={[styles.sectionTitle, { color: darkMode ? '#888' : '#666' }]}>Información Personal</Text>
                    <View style={[styles.card, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>

                        <Text style={[styles.inputLabel, { color: darkMode ? '#A0A0A0' : '#666' }]}>Nombre Completo</Text>
                        <View style={[styles.inputContainer, { backgroundColor: darkMode ? '#2A2A2A' : '#F9F9F9', borderColor: darkMode ? '#333' : '#EEE' }]}>
                            <Ionicons name="person-outline" size={20} color="#888" style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { color: darkMode ? '#FFF' : '#000' }]}
                                value={fullName}
                                onChangeText={setFullName}
                                placeholder="Tu nombre"
                                placeholderTextColor="#888"
                            />
                        </View>

                        <Text style={[styles.inputLabel, { color: darkMode ? '#A0A0A0' : '#666' }]}>Alias del Conductor (Usuario)</Text>
                        <View style={[styles.inputContainer, { backgroundColor: darkMode ? '#2A2A2A' : '#F9F9F9', borderColor: darkMode ? '#333' : '#EEE' }]}>
                            <Ionicons name="at-outline" size={20} color="#888" style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { color: darkMode ? '#FFF' : '#000' }]}
                                value={alias}
                                onChangeText={setAlias}
                                placeholder="Ej. juan_driver"
                                placeholderTextColor="#888"
                                autoCapitalize="none"
                            />
                        </View>

                        <Text style={[styles.inputLabel, { color: darkMode ? '#A0A0A0' : '#666' }]}>Número Telefónico</Text>
                        <View style={[styles.inputContainer, { backgroundColor: darkMode ? '#2A2A2A' : '#F9F9F9', borderColor: darkMode ? '#333' : '#EEE' }]}>
                            <Ionicons name="call-outline" size={20} color="#888" style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { color: darkMode ? '#FFF' : '#000' }]}
                                value={phone}
                                onChangeText={setPhone}
                                placeholder="Ej. +1 800 000 0000"
                                placeholderTextColor="#888"
                                keyboardType="phone-pad"
                            />
                        </View>
                    </View>

                    {/* Sección: Seguridad y Contraseña */}
                    <Text style={[styles.sectionTitle, { color: darkMode ? '#888' : '#666' }]}>Seguridad</Text>
                    <View style={[styles.card, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>

                        <TouchableOpacity
                            style={styles.togglePasswordRow}
                            onPress={() => setShowPasswordSection(!showPasswordSection)}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="lock-closed-outline" size={20} color="#2196F3" style={{ marginRight: 10 }} />
                                <Text style={[styles.settingText, { color: darkMode ? '#FFF' : '#000' }]}>Cambiar Contraseña</Text>
                            </View>
                            <Ionicons name={showPasswordSection ? "chevron-up" : "chevron-down"} size={18} color="#888" />
                        </TouchableOpacity>

                        {showPasswordSection && (
                            <View style={{ marginTop: 15 }}>
                                <Text style={[styles.inputLabel, { color: darkMode ? '#A0A0A0' : '#666' }]}>Contraseña Actual</Text>
                                <View style={[styles.inputContainer, { backgroundColor: darkMode ? '#2A2A2A' : '#F9F9F9', borderColor: darkMode ? '#333' : '#EEE' }]}>
                                    <Ionicons name="key-outline" size={20} color="#888" style={styles.inputIcon} />
                                    <TextInput
                                        style={[styles.input, { color: darkMode ? '#FFF' : '#000' }]}
                                        value={oldPassword}
                                        onChangeText={setOldPassword}
                                        placeholder="••••••••"
                                        placeholderTextColor="#888"
                                        secureTextEntry
                                    />
                                </View>

                                <Text style={[styles.inputLabel, { color: darkMode ? '#A0A0A0' : '#666' }]}>Nueva Contraseña</Text>
                                <View style={[styles.inputContainer, { backgroundColor: darkMode ? '#2A2A2A' : '#F9F9F9', borderColor: darkMode ? '#333' : '#EEE' }]}>
                                    <Ionicons name="lock-open-outline" size={20} color="#888" style={styles.inputIcon} />
                                    <TextInput
                                        style={[styles.input, { color: darkMode ? '#FFF' : '#000' }]}
                                        value={newPassword}
                                        onChangeText={setNewPassword}
                                        placeholder="Mínimo 6 caracteres"
                                        placeholderTextColor="#888"
                                        secureTextEntry
                                    />
                                </View>

                                <Text style={[styles.inputLabel, { color: darkMode ? '#A0A0A0' : '#666' }]}>Confirmar Nueva Contraseña</Text>
                                <View style={[styles.inputContainer, { backgroundColor: darkMode ? '#2A2A2A' : '#F9F9F9', borderColor: darkMode ? '#333' : '#EEE' }]}>
                                    <Ionicons name="checkmark-done-outline" size={20} color="#888" style={styles.inputIcon} />
                                    <TextInput
                                        style={[styles.input, { color: darkMode ? '#FFF' : '#000' }]}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        placeholder="Repite la nueva contraseña"
                                        placeholderTextColor="#888"
                                        secureTextEntry
                                    />
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Botón de Guardar */}
                    <TouchableOpacity
                        style={[styles.btnSave, { backgroundColor: darkMode ? '#FFF' : '#1E1E1E', opacity: isSaving ? 0.7 : 1 }]}
                        onPress={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator color={darkMode ? '#000' : '#FFF'} />
                        ) : (
                            <Text style={[styles.btnTextSave, { color: darkMode ? '#000' : '#FFF' }]}>Guardar Cambios</Text>
                        )}
                    </TouchableOpacity>

                </ScrollView>
            </KeyboardAvoidingView>

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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 15,
        paddingBottom: 15,
        alignItems: 'center'
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
    avatarContainer: { alignItems: 'center', marginVertical: 20 },
    avatarWrapper: {
        width: 90,
        height: 90,
        borderRadius: 45,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#333'
    },
    avatarImage: { width: '100%', height: '100%' },
    cameraBtn: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        padding: 6,
        borderRadius: 15,
        borderWidth: 2,
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1,
        elevation: 1
    },
    ratingText: { fontWeight: 'bold', fontSize: 14 },
    changePhotoText: { color: '#4CAF50', fontWeight: 'bold', marginTop: 10, fontSize: 14 },
    sectionTitle: { fontSize: 13, textTransform: 'uppercase', marginBottom: 8, marginTop: 15, fontWeight: '600' },
    card: { borderRadius: 16, padding: 16, marginBottom: 15 },
    resenaItem: { paddingVertical: 10 },
    resenaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    resenaFecha: { fontSize: 11 },
    resenaComentario: { fontSize: 13, fontStyle: 'italic', lineHeight: 18 },
    inputLabel: { fontSize: 12, marginBottom: 6, fontWeight: '600' },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 12,
        marginBottom: 14
    },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, paddingVertical: 12, fontSize: 15 },
    togglePasswordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
    settingText: { fontSize: 15, fontWeight: '500' },
    btnSave: { padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 10, elevation: 2 },
    btnTextSave: { fontWeight: 'bold', fontSize: 16 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
    customAlertBox: { padding: 25, borderRadius: 24, alignItems: 'center', elevation: 10 },
    alertIconContainer: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
    customAlertTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    customAlertMessage: { fontSize: 14, textAlign: 'center', marginBottom: 25, lineHeight: 20 },
    alertBtn: { padding: 14, borderRadius: 12, alignItems: 'center' }
});