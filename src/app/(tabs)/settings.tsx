import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Modal, TextInput, Image, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { makeRedirectUri } from 'expo-auth-session';
import * as Updates from 'expo-updates';
import { useRouter } from 'expo-router';
import * as SQLite from 'expo-sqlite';

WebBrowser.maybeCompleteAuthSession();

export default function Settings() {
    const router = useRouter();
    const { darkMode, toggleDarkMode } = useTheme();
    const [notifications, setNotifications] = useState(true);
    const [biometrics, setBiometrics] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    // Estados para el modal de vehículos
    const [vehicleModalVisible, setVehicleModalVisible] = useState(false);
    const [vehicleType, setVehicleType] = useState('');
    const [vehicleBrand, setVehicleBrand] = useState('');
    const [vehicleModel, setVehicleModel] = useState('');
    const [vehicleYear, setVehicleYear] = useState('');
    const [vehiclePlate, setVehiclePlate] = useState('');

    // Estados para la sección de Reservas
    const [reservasActivas, setReservasActivas] = useState(false);
    const [reservasModalVisible, setReservasModalVisible] = useState(false);

    // Estados para el Modal de Autenticación (Login / Registro)
    const [authModalVisible, setAuthModalVisible] = useState(false);
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
    const [isLoadingAuth, setIsLoadingAuth] = useState(false);

    // Campos de Login
    const [loginAlias, setLoginAlias] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    // Campos de Registro (Tabla conductores)
    const [regAlias, setRegAlias] = useState('');
    const [regNombre, setRegNombre] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regConfirmPassword, setRegConfirmPassword] = useState('');
    const [regTelefono, setRegTelefono] = useState('');
    const [regImageUri, setRegImageUri] = useState<string | null>(null);
    const [regImageBase64, setRegImageBase64] = useState<string | null>(null);

    // Checkboxes de Horarios Preferidos completos
    const [horarios, setHorarios] = useState({
        manana: true,
        tarde: true,
        noche: false,
        madrugada: false
    });

    const [zonaExcluida, setZonaExcluida] = useState('');

    // Estados para el Modal de Google Drive
    const [driveModalVisible, setDriveModalVisible] = useState(false);
    const [driveActionType, setDriveActionType] = useState<'backup' | 'restore'>('backup');
    const [isLoadingDrive, setIsLoadingDrive] = useState(false);
    const [driveMessage, setDriveMessage] = useState('');

    // Sistema de Alertas Personalizadas
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

    const [, response, promptAsync] = Google.useAuthRequest({
        webClientId: '366997518479-8onvm2na5p5smnikdhpabp58ng0e5s65.apps.googleusercontent.com',
        androidClientId: '366997518479-33t2kbs3je51i93pmlttun3hvng6k95v.apps.googleusercontent.com',
        scopes: ['https://www.googleapis.com/auth/drive.appdata'],
        redirectUri: makeRedirectUri({ scheme: 'com.jrdev.drivewallet' }),
    });

    useEffect(() => {
        cargarConfiguracionesGenerales();
        cargarDatosVehiculo();
        verificarSesionActiva();
    }, []);

    const verificarSesionActiva = async () => {
        try {
            const token = await AsyncStorage.getItem('user_token');
            setIsLoggedIn(!!token);
        } catch (error) {
            setIsLoggedIn(false);
        }
    };

    const cargarConfiguracionesGenerales = async () => {
        try {
            const notifGuardadas = await AsyncStorage.getItem('app_notifications');
            const bioGuardadas = await AsyncStorage.getItem('app_biometrics');
            if (notifGuardadas !== null) setNotifications(notifGuardadas === 'true');
            if (bioGuardadas !== null) setBiometrics(bioGuardadas === 'true');
        } catch (error) {
            console.error("Error al cargar preferencias:", error);
        }
    };

    const cargarDatosVehiculo = async () => {
        try {
            const vType = await AsyncStorage.getItem('vehicle_type');
            const vBrand = await AsyncStorage.getItem('vehicle_brand');
            const vModel = await AsyncStorage.getItem('vehicle_model');
            const vYear = await AsyncStorage.getItem('vehicle_year');
            const vPlate = await AsyncStorage.getItem('vehicle_plate');

            if (vType) setVehicleType(vType);
            if (vBrand) setVehicleBrand(vBrand);
            if (vModel) setVehicleModel(vModel);
            if (vYear) setVehicleYear(vYear);
            if (vPlate) setVehiclePlate(vPlate);
        } catch (error) {
            console.error("Error al cargar vehículo:", error);
        }
    };

    const handleToggleNotifications = async (value: boolean) => {
        setNotifications(value);
        await AsyncStorage.setItem('app_notifications', value.toString());
    };

    const handleToggleBiometrics = async (value: boolean) => {
        if (value) {
            const compatible = await LocalAuthentication.hasHardwareAsync();
            if (!compatible) {
                mostrarAlerta("No compatible", "Este dispositivo no cuenta con sensor de huella o reconocimiento facial.", "error");
                return;
            }
            const enrolled = await LocalAuthentication.isEnrolledAsync();
            if (!enrolled) {
                mostrarAlerta("Sin configurar", "No hay huellas o PIN registrados en este teléfono.", "error");
                return;
            }
            const auth = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Confirma tu identidad para activar el bloqueo',
                fallbackLabel: 'Usar PIN'
            });
            if (auth.success) {
                setBiometrics(true);
                await AsyncStorage.setItem('app_biometrics', 'true');
                mostrarAlerta("¡Protegido!", "El bloqueo de seguridad ha sido activado.", "success");
            } else {
                mostrarAlerta("Cancelado", "No se pudo verificar la identidad.", "error");
            }
        } else {
            setBiometrics(false);
            await AsyncStorage.setItem('app_biometrics', 'false');
            mostrarAlerta("Desactivado", "El bloqueo biométrico ha sido desactivado.", "info");
        }
    };

    const handleSaveVehicle = async () => {
        try {
            await AsyncStorage.setItem('vehicle_type', vehicleType);
            await AsyncStorage.setItem('vehicle_brand', vehicleBrand);
            await AsyncStorage.setItem('vehicle_model', vehicleModel);
            await AsyncStorage.setItem('vehicle_year', vehicleYear);
            await AsyncStorage.setItem('vehicle_plate', vehiclePlate);
            setVehicleModalVisible(false);
            mostrarAlerta("¡Éxito!", "Datos del vehículo actualizados localmente.", "success");
        } catch (error) {
            mostrarAlerta("Error", "No se pudieron guardar los datos.", "error");
        }
    };

    const toggleHorario = (key: keyof typeof horarios) => {
        setHorarios(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSaveReservasConfig = () => {
        setReservasModalVisible(false);
        mostrarAlerta("Guardado", "Tus preferencias de turnos y zonas excluidas han sido guardadas.", "success");
    };

    const pickProfileImage = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
            mostrarAlerta("Permiso requerido", "Se requiere acceso a la galería para seleccionar una foto de perfil.", "error");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setRegImageUri(result.assets[0].uri);
            setRegImageBase64(result.assets[0].base64 || null);
        }
    };

    const handleLogin = async () => {
        if (!loginAlias.trim() || !loginPassword.trim()) {
            mostrarAlerta("Campos vacíos", "Por favor ingresa tu alias web y contraseña.", "error");
            return;
        }

        setIsLoadingAuth(true);
        try {
            const API_URL = 'https://www.jrtechnology.duckdns.org/drivewallet/api/auth/login';
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alias_web: loginAlias.trim(), password: loginPassword.trim() }),
            });

            const responseText = await response.text();
            let data;
            try { data = JSON.parse(responseText); } catch (e) { data = responseText; }

            if (response.ok) {
                await AsyncStorage.setItem('user_token', data.token);
                await AsyncStorage.setItem('conductor_id', data.conductorId.toString());
                await AsyncStorage.setItem('conductor_nombre', data.nombre);
                await AsyncStorage.setItem('conductor_alias', loginAlias.trim());
                if (data.telefono) await AsyncStorage.setItem('conductor_telefono', data.telefono);
                if (data.foto) await AsyncStorage.setItem('conductor_foto', data.foto);

                setIsLoggedIn(true);
                setAuthModalVisible(false);
                setLoginAlias('');
                setLoginPassword('');
                mostrarAlerta("¡Bienvenido!", `Has iniciado sesión correctamente, ${data.nombre}.`, "success");
            } else {
                mostrarAlerta("Acceso denegado", typeof data === 'string' ? data : "Credenciales inválidas.", "error");
            }
        } catch (error) {
            mostrarAlerta("Error de red", "No se pudo conectar con el servidor.", "error");
        } finally {
            setIsLoadingAuth(false);
        }
    };

    const handleRegister = async () => {
        if (!regAlias.trim() || !regNombre.trim() || !regTelefono.trim() || !regPassword.trim() || !regConfirmPassword.trim()) {
            mostrarAlerta("Campos requeridos", "Por favor completa todos los campos obligatorios.", "error");
            return;
        }

        if (regEmail.trim() && !/\S+@\S+\.\S+/.test(regEmail.trim())) {
            mostrarAlerta("Correo inválido", "Por favor introduce un correo electrónico válido.", "error");
            return;
        }

        if (regPassword !== regConfirmPassword) {
            mostrarAlerta("Error de contraseña", "Las contraseñas no coinciden.", "error");
            return;
        }

        if (regPassword.length < 6) {
            mostrarAlerta("Seguridad", "La contraseña debe tener al menos 6 caracteres.", "error");
            return;
        }

        setIsLoadingAuth(true);
        try {
            const marca = vehicleBrand || '';
            const modelo = vehicleModel || '';
            const anio = vehicleYear || '';
            const placa = vehiclePlate || '';

            const vehiculoMarcaCompleto = `${marca} ${modelo}`.trim() + (anio ? ` (${anio})` : '');

            const API_URL = 'https://www.jrtechnology.duckdns.org/drivewallet/api/auth/registrar-rapido';
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    alias_web: regAlias.trim().toLowerCase(),
                    nombre: regNombre.trim(),
                    email: regEmail.trim() || null,
                    password: regPassword.trim(),
                    telefono: regTelefono.trim(),
                    vehiculo_marca: vehiculoMarcaCompleto,
                    vehiculo_placa: placa,
                    foto: regImageBase64
                }),
            });

            const responseText = await response.text();
            let data;
            try { data = JSON.parse(responseText); } catch (e) { data = responseText; }

            if (response.ok) {
                mostrarAlerta("¡Perfil Creado!", "Tu cuenta de conductor ha sido registrada con éxito. Ya puedes iniciar sesión.", "success", () => {
                    setAuthMode('login');
                    setLoginAlias(regAlias.trim().toLowerCase());
                    setRegPassword('');
                    setRegConfirmPassword('');
                });
            } else {
                mostrarAlerta("Error de Registro", typeof data === 'string' ? data : "No se pudo completar el registro.", "error");
            }
        } catch (error) {
            mostrarAlerta("Error de red", "No se pudo conectar con el servidor para registrar el perfil.", "error");
        } finally {
            setIsLoadingAuth(false);
        }
    };

    const handleCerrarSesion = () => {
        mostrarAlerta(
            "Cerrar Sesión",
            "¿Estás seguro de que deseas cerrar tu sesión en DriveWallet?",
            "confirm",
            async () => {
                try {
                    await AsyncStorage.multiRemove([
                        'user_token',
                        'conductor_id',
                        'conductor_nombre',
                        'conductor_alias',
                        'conductor_telefono',
                        'conductor_foto'
                    ]);
                    setIsLoggedIn(false);
                    mostrarAlerta(
                        "Sesión Cerrada",
                        "Has salido de tu cuenta correctamente.",
                        "success",
                        () => { router.replace('/' as any); }
                    );
                } catch (error) {
                    mostrarAlerta("Error", "No se pudo limpiar la sesión localmente.", "error");
                }
            }
        );
    };

    const handleSoporte = () => {
        mostrarAlerta(
            "Ayuda y Soporte - JR Technology",
            "DriveWallet es desarrollado por JR Technology.\n\n📧 Soporte técnico: sdrivewallet@gmail.com\nInstagram: @juanrijodev\nFacebook: @juanrijodev\nDiscord: @juanrijodev\n\nEstamos aquí para ayudarte con cualquier inconveniente con tus finanzas, vehículos o reservas.",
            "info"
        );
    };

    const handlePoliticas = () => {
        mostrarAlerta(
            "Política de Privacidad",
            "En DriveWallet tus datos financieros y de mantenimiento (Garage) se almacenan de forma totalmente local en tu dispositivo mediante SQLite. \n\nEl uso de Google Drive es estrictamente opcional para crear y restaurar copias de seguridad de respaldo en tu espacio privado (AppFolder). No compartimos ni comercializamos ninguna información con terceros.\n\nContacto de privacidad: drivewallet@gmail.com",
            "info"
        );
    };

    useEffect(() => {
        if (response?.type === 'success') {
            const accessToken = response.authentication?.accessToken;
            if (accessToken) {
                if (driveActionType === 'backup') subirBackupADrive(accessToken);
                else restaurarBackupDeDrive(accessToken);
            }
        } else if (response?.type === 'error') {
            setIsLoadingDrive(false);
            setDriveModalVisible(false);
            mostrarAlerta('Error', 'No se pudo completar la autenticación con Google.', 'error');
        }
    }, [response]);

    const openDriveModal = (type: 'backup' | 'restore') => {
        setDriveActionType(type);
        setDriveMessage(
            type === 'backup'
                ? '¿Deseas subir una copia de seguridad completa de tus movimientos a tu Google Drive?'
                : '¿Seguro que deseas recuperar tu copia desde Google Drive?'
        );
        setDriveModalVisible(true);
    };

    const executeDriveAction = async () => {
        setIsLoadingDrive(true);
        await promptAsync();
    };

    const subirBackupADrive = async (accessToken: string) => {
        try {
            setIsLoadingDrive(true);
            setDriveMessage("Preparando movimientos y configuraciones...");

            try {
                const db = SQLite.openDatabaseSync('drivewallet_db.db');
                db.execSync('PRAGMA wal_checkpoint(TRUNCATE);');
            } catch (e) {
                console.log("Error haciendo checkpoint de BD:", e);
            }

            const docDir = (FileSystem as any).documentDirectory;
            const dbUri = `${docDir}SQLite/drivewallet_db.db`;
            const prefsUri = `${docDir}prefs_backup.json`;

            // INCLUYENDO LOS DATOS DE MANTENIMIENTO DEL GARAGE
            const prefs = {
                app_notifications: await AsyncStorage.getItem('app_notifications'),
                app_biometrics: await AsyncStorage.getItem('app_biometrics'),
                vehicle_type: await AsyncStorage.getItem('vehicle_type'),
                vehicle_brand: await AsyncStorage.getItem('vehicle_brand'),
                vehicle_model: await AsyncStorage.getItem('vehicle_model'),
                vehicle_year: await AsyncStorage.getItem('vehicle_year'),
                vehicle_plate: await AsyncStorage.getItem('vehicle_plate'),
                aceite_tipo: await AsyncStorage.getItem('aceite_tipo'),
                aceite_km: await AsyncStorage.getItem('aceite_km'),
                aceite_fecha: await AsyncStorage.getItem('aceite_fecha'),
                vehiculo_kilometraje: await AsyncStorage.getItem('vehiculo_kilometraje'),
                transmision_fecha: await AsyncStorage.getItem('transmision_fecha'),
                transmision_notas: await AsyncStorage.getItem('transmision_notas'),
                seguro_compania: await AsyncStorage.getItem('seguro_compania'),
                seguro_vencimiento: await AsyncStorage.getItem('seguro_vencimiento')
            };
            await FileSystem.writeAsStringAsync(prefsUri, JSON.stringify(prefs));

            const fileInfo = await FileSystem.getInfoAsync(dbUri);
            if (!fileInfo.exists) {
                setIsLoadingDrive(false);
                setDriveModalVisible(false);
                mostrarAlerta("Aviso", "No se encontró la base de datos local.", "error");
                return;
            }

            const searchRes = await fetch(
                "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='drivewallet_db.db' or name='prefs_backup.json'",
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const searchData = await searchRes.json();

            if (searchData.files && searchData.files.length > 0) {
                for (const file of searchData.files) {
                    await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${accessToken}` }
                    });
                }
            }

            const uploadFileToDrive = async (fileName: string, fileUri: string, mimeType: string) => {
                const metadata = { name: fileName, parents: ['appDataFolder'] };
                const initRes = await fetch(
                    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            'Content-Type': 'application/json; charset=UTF-8',
                            'X-Upload-Content-Type': mimeType,
                        },
                        body: JSON.stringify(metadata)
                    }
                );

                const uploadUrl = initRes.headers.get('Location') || initRes.headers.get('location');
                if (!uploadUrl) throw new Error(`Fallo al obtener URL de subida para ${fileName}`);

                await FileSystem.uploadAsync(uploadUrl, fileUri, {
                    httpMethod: 'PUT',
                    headers: { 'Content-Type': mimeType },
                    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
                });
            };

            setDriveMessage("Subiendo base de datos...");
            await uploadFileToDrive('drivewallet_db.db', dbUri, 'application/octet-stream');

            setDriveMessage("Subiendo datos del vehículo y mantenimientos...");
            await uploadFileToDrive('prefs_backup.json', prefsUri, 'application/json');

            setIsLoadingDrive(false);
            setDriveModalVisible(false);
            mostrarAlerta("¡Éxito!", "Movimientos, vehículo, mantenimientos y configuraciones respaldados en Google Drive.", "success");

        } catch (error) {
            setIsLoadingDrive(false);
            setDriveModalVisible(false);
            mostrarAlerta("Error", "Error de conexión al subir la copia a Drive.", "error");
        }
    };

    const restaurarBackupDeDrive = async (accessToken: string) => {
        try {
            setIsLoadingDrive(true);
            setDriveMessage("Buscando copias en Google Drive...");

            const searchRes = await fetch(
                "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='drivewallet_db.db' or name='prefs_backup.json'",
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const searchData = await searchRes.json();

            if (!searchData.files || !searchData.files.length) {
                setIsLoadingDrive(false);
                setDriveModalVisible(false);
                mostrarAlerta("Aviso", "No se encontró ninguna copia en Google Drive.", "error");
                return;
            }

            const docDir = (FileSystem as any).documentDirectory;
            const sqliteDir = `${docDir}SQLite`;
            const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
            if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });

            let restauroDb = false;
            let restauroPrefs = false;

            for (const file of searchData.files) {
                if (file.name === 'drivewallet_db.db') {
                    setDriveMessage("Descargando base de datos...");
                    const localUri = `${sqliteDir}/drivewallet_db.db`;

                    const walUri = `${sqliteDir}/drivewallet_db.db-wal`;
                    const shmUri = `${sqliteDir}/drivewallet_db.db-shm`;
                    const walInfo = await FileSystem.getInfoAsync(walUri);
                    if (walInfo.exists) await FileSystem.deleteAsync(walUri);
                    const shmInfo = await FileSystem.getInfoAsync(shmUri);
                    if (shmInfo.exists) await FileSystem.deleteAsync(shmUri);

                    await FileSystem.downloadAsync(
                        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
                        localUri,
                        { headers: { Authorization: `Bearer ${accessToken}` } }
                    );
                    restauroDb = true;
                }
                else if (file.name === 'prefs_backup.json') {
                    setDriveMessage("Restaurando vehículo, mantenimientos y configuración...");
                    const jsonUri = `${docDir}prefs_backup.json`;

                    await FileSystem.downloadAsync(
                        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
                        jsonUri,
                        { headers: { Authorization: `Bearer ${accessToken}` } }
                    );

                    const jsonString = await FileSystem.readAsStringAsync(jsonUri);
                    const jsonPrefs = JSON.parse(jsonString);

                    if (jsonPrefs.app_notifications) await AsyncStorage.setItem('app_notifications', jsonPrefs.app_notifications);
                    if (jsonPrefs.app_biometrics) await AsyncStorage.setItem('app_biometrics', jsonPrefs.app_biometrics);
                    if (jsonPrefs.vehicle_type) await AsyncStorage.setItem('vehicle_type', jsonPrefs.vehicle_type);
                    if (jsonPrefs.vehicle_brand) await AsyncStorage.setItem('vehicle_brand', jsonPrefs.vehicle_brand);
                    if (jsonPrefs.vehicle_model) await AsyncStorage.setItem('vehicle_model', jsonPrefs.vehicle_model);
                    if (jsonPrefs.vehicle_year) await AsyncStorage.setItem('vehicle_year', jsonPrefs.vehicle_year);
                    if (jsonPrefs.vehicle_plate) await AsyncStorage.setItem('vehicle_plate', jsonPrefs.vehicle_plate);

                    if (jsonPrefs.aceite_tipo) await AsyncStorage.setItem('aceite_tipo', jsonPrefs.aceite_tipo);
                    if (jsonPrefs.aceite_km) await AsyncStorage.setItem('aceite_km', jsonPrefs.aceite_km);
                    if (jsonPrefs.aceite_fecha) await AsyncStorage.setItem('aceite_fecha', jsonPrefs.aceite_fecha);
                    if (jsonPrefs.vehiculo_kilometraje) await AsyncStorage.setItem('vehiculo_kilometraje', jsonPrefs.vehiculo_kilometraje);
                    if (jsonPrefs.transmision_fecha) await AsyncStorage.setItem('transmision_fecha', jsonPrefs.transmision_fecha);
                    if (jsonPrefs.transmision_notas) await AsyncStorage.setItem('transmision_notas', jsonPrefs.transmision_notas);
                    if (jsonPrefs.seguro_compania) await AsyncStorage.setItem('seguro_compania', jsonPrefs.seguro_compania);
                    if (jsonPrefs.seguro_vencimiento) await AsyncStorage.setItem('seguro_vencimiento', jsonPrefs.seguro_vencimiento);

                    restauroPrefs = true;
                }
            }

            setIsLoadingDrive(false);
            setDriveModalVisible(false);

            if (restauroDb || restauroPrefs) {
                mostrarAlerta(
                    "¡Restaurado con éxito!",
                    "Los datos financieros, de vehículo y mantenimientos han sido recuperados. Presiona Aceptar para reiniciar la aplicación.",
                    "success",
                    async () => {
                        try { await Updates.reloadAsync(); } catch (e) {}
                    }
                );
            } else {
                mostrarAlerta("Error", "No se pudo procesar la descarga de los archivos.", "error");
            }
        } catch (error) {
            setIsLoadingDrive(false);
            setDriveModalVisible(false);
            mostrarAlerta("Error", "Ocurrió un error al restaurar desde Drive.", "error");
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: darkMode ? '#121212' : '#F5F7FA' }]}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={[styles.headerTitle, { color: darkMode ? '#FFF' : '#000' }]}>Configuración</Text>

                <Text style={[styles.sectionTitle, { color: darkMode ? '#888' : '#666' }]}>Alertas Generales y Seguridad</Text>
                <View style={[styles.card, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                    <TouchableOpacity style={[styles.settingRow, { borderBottomColor: darkMode ? '#333' : '#F0F0F0' }]} onPress={() => setVehicleModalVisible(true)}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="car-sport" size={24} color="#FF9800" />
                            <Text style={[styles.settingText, { color: darkMode ? '#FFF' : '#000' }]}>Tipo y Datos de Vehículo</Text>
                        </View>
                        <Text style={{ color: darkMode ? '#888' : '#666' }}>{vehicleType} {'>'}</Text>
                    </TouchableOpacity>

                    <View style={[styles.settingRow, { borderBottomColor: darkMode ? '#333' : '#F0F0F0' }]}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="moon" size={24} color="#9C27B0" />
                            <Text style={[styles.settingText, { color: darkMode ? '#FFF' : '#000' }]}>Modo Oscuro</Text>
                        </View>
                        <Switch value={darkMode} onValueChange={toggleDarkMode} trackColor={{ true: '#4CAF50' }} />
                    </View>

                    <View style={[styles.settingRow, { borderBottomColor: darkMode ? '#333' : '#F0F0F0' }]}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="notifications" size={24} color="#4CAF50" />
                            <Text style={[styles.settingText, { color: darkMode ? '#FFF' : '#000' }]}>Notificaciones en el celular</Text>
                        </View>
                        <Switch value={notifications} onValueChange={handleToggleNotifications} trackColor={{ true: '#4CAF50' }} />
                    </View>

                    <View style={[styles.settingRow, styles.noBorder]}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="lock-closed" size={24} color="#2196F3" />
                            <Text style={[styles.settingText, { color: darkMode ? '#FFF' : '#000' }]}>Bloqueo con Huella/PIN</Text>
                        </View>
                        <Switch value={biometrics} onValueChange={handleToggleBiometrics} trackColor={{ true: '#4CAF50' }} />
                    </View>
                </View>

                {/* --- SECCIÓN CONDICIONAL DE RESERVAS Y PERFIL --- */}
                <Text style={[styles.sectionTitle, { color: darkMode ? '#888' : '#666' }]}>Administración de Reservas (PROXIMAMENTE)</Text>
                <View style={[styles.card, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                    {!isLoggedIn ? (
                        <>
                            <TouchableOpacity style={[styles.settingRow, { borderBottomColor: darkMode ? '#333' : '#F0F0F0' }]} onPress={() => { setAuthMode('register'); setAuthModalVisible(true); }}>
                                <View style={styles.settingInfo}>
                                    <Ionicons name="person-add-outline" size={24} color="#00BCD4" />
                                    <Text style={[styles.settingText, { color: '#00BCD4', fontWeight: 'bold' }]}>Crear Perfil de Conductor</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#00BCD4" />
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.settingRow, styles.noBorder]} onPress={() => { setAuthMode('login'); setAuthModalVisible(true); }}>
                                <View style={styles.settingInfo}>
                                    <Ionicons name="log-in-outline" size={24} color="#4CAF50" />
                                    <Text style={[styles.settingText, { color: '#4CAF50', fontWeight: 'bold' }]}>Iniciar Sesión</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#4CAF50" />
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <View style={[styles.settingRow, { borderBottomColor: darkMode ? '#333' : '#F0F0F0' }]}>
                                <View style={styles.settingInfo}>
                                    <Ionicons name="calendar-outline" size={24} color="#00BCD4" />
                                    <Text style={[styles.settingText, { color: darkMode ? '#FFF' : '#000' }]}>Recibir Reservas</Text>
                                </View>
                                <Switch
                                    value={reservasActivas}
                                    onValueChange={(val) => {
                                        setReservasActivas(val);
                                        mostrarAlerta("Estado", val ? "Recepción de reservas activada." : "Recepción desactivada.", "info");
                                    }}
                                    trackColor={{ true: '#00BCD4' }}
                                />
                            </View>

                            <TouchableOpacity style={[styles.settingRow, { borderBottomColor: darkMode ? '#333' : '#F0F0F0' }]} onPress={() => setReservasModalVisible(true)}>
                                <View style={styles.settingInfo}>
                                    <Ionicons name="options-outline" size={24} color="#FF5722" />
                                    <Text style={[styles.settingText, { color: darkMode ? '#FFF' : '#000' }]}>Administrar Información</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={darkMode ? '#888' : '#666'} />
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.settingRow, styles.noBorder]} onPress={handleCerrarSesion}>
                                <View style={styles.settingInfo}>
                                    <Ionicons name="log-out-outline" size={24} color="#F44336" />
                                    <Text style={[styles.settingText, { color: '#F44336' }]}>Cerrar Sesión</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#F44336" />
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                <Text style={[styles.sectionTitle, { color: darkMode ? '#888' : '#666' }]}>Copias en la Nube (Google Drive)</Text>
                <View style={[styles.card, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                    <TouchableOpacity style={[styles.settingRow, { borderBottomColor: darkMode ? '#333' : '#F0F0F0' }]} onPress={() => openDriveModal('backup')}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="cloud-upload-outline" size={24} color={darkMode ? '#AAA' : '#666'} />
                            <Text style={[styles.settingText, { color: darkMode ? '#FFF' : '#000' }]}>Crear Copia de Seguridad</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.settingRow, styles.noBorder]} onPress={() => openDriveModal('restore')}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="cloud-download-outline" size={24} color="#F44336" />
                            <Text style={[styles.settingText, { color: '#F44336' }]}>Restaurar Copia de Seguridad</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                <Text style={[styles.sectionTitle, { color: darkMode ? '#888' : '#666' }]}>Soporte y Legal</Text>
                <View style={[styles.card, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                    <TouchableOpacity style={[styles.settingRow, { borderBottomColor: darkMode ? '#333' : '#F0F0F0' }]} onPress={handleSoporte}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="help-buoy-outline" size={24} color="#3F51B5" />
                            <Text style={[styles.settingText, { color: darkMode ? '#FFF' : '#000' }]}>Ayuda y Soporte</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={darkMode ? '#888' : '#666'} />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.settingRow, styles.noBorder]} onPress={handlePoliticas}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="shield-checkmark-outline" size={24} color="#8BC34A" />
                            <Text style={[styles.settingText, { color: darkMode ? '#FFF' : '#000' }]}>Política de Privacidad</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={darkMode ? '#888' : '#666'} />
                    </TouchableOpacity>
                </View>

                <View style={[styles.appInfoContainer, { backgroundColor: darkMode ? '#1E1E1E' : '#FFFFFF' }]}>
                    <Image
                        source={require('../assets/images/drivewallet_sinfondo.png')}
                        style={styles.appLogo}
                        resizeMode="contain"
                    />
                    <View style={styles.appInfoTextWrapper}>
                        <Text style={[styles.appName, { color: darkMode ? '#FFF' : '#1E1E1E' }]}>DriveWallet</Text>
                        <Text style={[styles.appVersion, { color: '#888' }]}>Versión 5.4.8 (ALPHA TEST)</Text>
                    </View>
                </View>

            </ScrollView>

            {/* --- MODAL UNIFICADO DE AUTENTICACIÓN --- */}
            <Modal animationType="slide" transparent={true} visible={authModalVisible}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF', maxHeight: '90%' }]}>
                        <ScrollView contentContainerStyle={{ paddingBottom: 10 }} showsVerticalScrollIndicator={false}>

                            <View style={styles.authTabContainer}>
                                <TouchableOpacity
                                    style={[styles.authTabBtn, authMode === 'login' && styles.authTabBtnActive]}
                                    onPress={() => setAuthMode('login')}
                                >
                                    <Text style={[styles.authTabText, { color: authMode === 'login' ? '#FFF' : (darkMode ? '#888' : '#666') }]}>Iniciar Sesión</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.authTabBtn, authMode === 'register' && styles.authTabBtnActive]}
                                    onPress={() => setAuthMode('register')}
                                >
                                    <Text style={[styles.authTabText, { color: authMode === 'register' ? '#FFF' : (darkMode ? '#888' : '#666') }]}>Crear Perfil</Text>
                                </TouchableOpacity>
                            </View>

                            {authMode === 'login' ? (
                                <>
                                    <Text style={[styles.modalTitle, { color: darkMode ? '#FFF' : '#000', marginBottom: 15 }]}>Iniciar Sesión</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]}
                                        placeholder="Alias Web del conductor (Ej. juan-rijo)"
                                        placeholderTextColor="#A0A0A0"
                                        value={loginAlias}
                                        onChangeText={setLoginAlias}
                                        autoCapitalize="none"
                                    />
                                    <TextInput
                                        style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]}
                                        placeholder="Contraseña"
                                        placeholderTextColor="#A0A0A0"
                                        secureTextEntry={true}
                                        value={loginPassword}
                                        onChangeText={setLoginPassword}
                                    />
                                    <View style={styles.modalButtons}>
                                        <TouchableOpacity style={[styles.btn, styles.btnCancel, { backgroundColor: darkMode ? '#2A2A2A' : '#FFEBEE' }]} onPress={() => setAuthModalVisible(false)}>
                                            <Text style={[styles.btnTextCancel, { color: darkMode ? '#AAA' : '#F44336' }]}>Cancelar</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.btn, { backgroundColor: darkMode ? '#FFF' : '#1E1E1E' }]} onPress={handleLogin} disabled={isLoadingAuth}>
                                            <Text style={[styles.btnTextSave, { color: darkMode ? '#000' : '#FFF' }]}>{isLoadingAuth ? 'Entrando...' : 'Entrar'}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            ) : (
                                <>
                                    <Text style={[styles.modalTitle, { color: darkMode ? '#FFF' : '#000', marginBottom: 5 }]}>Registro de Conductor</Text>
                                    <Text style={{ color: darkMode ? '#888' : '#666', fontSize: 11, textAlign: 'center', marginBottom: 15 }}>
                                        Tu vehículo configurado se unirá automáticamente al perfil.
                                    </Text>

                                    <View style={{ alignItems: 'center', marginBottom: 15 }}>
                                        <TouchableOpacity onPress={pickProfileImage} style={[styles.avatarPickerContainer, { backgroundColor: darkMode ? '#2A2A2A' : '#EEE', borderColor: darkMode ? '#444' : '#DDD' }]}>
                                            {regImageUri ? (
                                                <Image source={{ uri: regImageUri }} style={styles.avatarPreview} />
                                            ) : (
                                                <Ionicons name="camera-outline" size={32} color={darkMode ? '#AAA' : '#666'} />
                                            )}
                                        </TouchableOpacity>
                                        <Text style={{ color: darkMode ? '#888' : '#666', fontSize: 12, marginTop: 5 }}>Toca para agregar tu foto</Text>
                                    </View>

                                    <TextInput
                                        style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]}
                                        placeholder="Alias Web (Ej. carlos-perez)"
                                        placeholderTextColor="#A0A0A0"
                                        value={regAlias}
                                        onChangeText={setRegAlias}
                                        autoCapitalize="none"
                                    />
                                    <TextInput
                                        style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]}
                                        placeholder="Nombre Completo"
                                        placeholderTextColor="#A0A0A0"
                                        value={regNombre}
                                        onChangeText={setRegNombre}
                                    />
                                    <TextInput
                                        style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]}
                                        placeholder="Correo Electrónico (Opcional)"
                                        placeholderTextColor="#A0A0A0"
                                        value={regEmail}
                                        onChangeText={setRegEmail}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                    />
                                    <TextInput
                                        style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]}
                                        placeholder="Teléfono (Ej. 8095551234)"
                                        placeholderTextColor="#A0A0A0"
                                        value={regTelefono}
                                        onChangeText={setRegTelefono}
                                        keyboardType="phone-pad"
                                    />
                                    <TextInput
                                        style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]}
                                        placeholder="Contraseña (mínimo 6 caracteres)"
                                        placeholderTextColor="#A0A0A0"
                                        secureTextEntry={true}
                                        value={regPassword}
                                        onChangeText={setRegPassword}
                                    />
                                    <TextInput
                                        style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]}
                                        placeholder="Confirmar Contraseña"
                                        placeholderTextColor="#A0A0A0"
                                        secureTextEntry={true}
                                        value={regConfirmPassword}
                                        onChangeText={setRegConfirmPassword}
                                    />

                                    <View style={styles.modalButtons}>
                                        <TouchableOpacity style={[styles.btn, styles.btnCancel, { backgroundColor: darkMode ? '#2A2A2A' : '#FFEBEE' }]} onPress={() => setAuthModalVisible(false)}>
                                            <Text style={[styles.btnTextCancel, { color: darkMode ? '#AAA' : '#F44336' }]}>Cancelar</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.btn, { backgroundColor: '#00BCD4' }]} onPress={handleRegister} disabled={isLoadingAuth}>
                                            <Text style={[styles.btnTextSave, { color: '#FFF' }]}>{isLoadingAuth ? 'Registrando...' : 'Crear Perfil'}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Modal de Vehículo */}
            <Modal animationType="slide" transparent={true} visible={vehicleModalVisible}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                        <Text style={[styles.modalTitle, { color: darkMode ? '#FFF' : '#000', marginBottom: 15 }]}>Datos del Vehículo</Text>
                        <TextInput style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]} value={vehicleType} onChangeText={setVehicleType} placeholder="Tipo (Ej. Sedán)" placeholderTextColor="#A0A0A0" />
                        <TextInput style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]} value={vehicleBrand} onChangeText={setVehicleBrand} placeholder="Marca (Ej. Hyundai)" placeholderTextColor="#A0A0A0" />
                        <TextInput style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]} value={vehicleModel} onChangeText={setVehicleModel} placeholder="Modelo (Ej. Sonata)" placeholderTextColor="#A0A0A0" />
                        <TextInput style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]} value={vehicleYear} onChangeText={setVehicleYear} placeholder="Año (Ej. 2016)" placeholderTextColor="#A0A0A0" keyboardType="numeric" />
                        <TextInput style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]} value={vehiclePlate} onChangeText={setVehiclePlate} placeholder="Placa (Ej. A123456)" placeholderTextColor="#A0A0A0" />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.btn, styles.btnCancel, { backgroundColor: darkMode ? '#2A2A2A' : '#FFEBEE' }]} onPress={() => setVehicleModalVisible(false)}>
                                <Text style={[styles.btnTextCancel, { color: darkMode ? '#AAA' : '#F44336' }]}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btn, { backgroundColor: darkMode ? '#FFF' : '#1E1E1E' }]} onPress={handleSaveVehicle}>
                                <Text style={[styles.btnTextSave, { color: darkMode ? '#000' : '#FFF' }]}>Guardar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Modal de Reservas / Turnos */}
            <Modal animationType="slide" transparent={true} visible={reservasModalVisible}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF', maxHeight: '85%' }]}>
                        <ScrollView contentContainerStyle={{ paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
                            <View style={{ alignItems: 'center', marginBottom: 15 }}>
                                <Ionicons name="construct-outline" size={36} color="#00BCD4" />
                                <Text style={[styles.modalTitle, { color: darkMode ? '#FFF' : '#000', marginTop: 8 }]}>Administrar Información</Text>
                                <Text style={{ color: darkMode ? '#888' : '#666', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                                    Selecciona los turnos en los que deseas recibir reservas y especifica zonas que prefieras evitar.
                                </Text>
                            </View>

                            <Text style={[styles.inputLabel, { color: darkMode ? '#A0A0A0' : '#666', marginBottom: 8 }]}>Turnos y Horarios de Trabajo</Text>

                            <TouchableOpacity style={styles.checkboxRow} onPress={() => toggleHorario('manana')}>
                                <Ionicons name={horarios.manana ? "checkbox" : "square-outline"} size={22} color={horarios.manana ? "#00BCD4" : (darkMode ? "#666" : "#aaa")} />
                                <Text style={[styles.checkboxText, { color: darkMode ? '#FFF' : '#000' }]}>Mañana (06:00 AM - 12:00 PM)</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.checkboxRow} onPress={() => toggleHorario('tarde')}>
                                <Ionicons name={horarios.tarde ? "checkbox" : "square-outline"} size={22} color={horarios.tarde ? "#00BCD4" : (darkMode ? "#666" : "#aaa")} />
                                <Text style={[styles.checkboxText, { color: darkMode ? '#FFF' : '#000' }]}>Tarde (12:00 PM - 06:00 PM)</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.checkboxRow} onPress={() => toggleHorario('noche')}>
                                <Ionicons name={horarios.noche ? "checkbox" : "square-outline"} size={22} color={horarios.noche ? "#00BCD4" : (darkMode ? "#666" : "#aaa")} />
                                <Text style={[styles.checkboxText, { color: darkMode ? '#FFF' : '#000' }]}>Noche (06:00 PM - 12:00 AM)</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.checkboxRow} onPress={() => toggleHorario('madrugada')}>
                                <Ionicons name={horarios.madrugada ? "checkbox" : "square-outline"} size={22} color={horarios.madrugada ? "#00BCD4" : (darkMode ? "#666" : "#aaa")} />
                                <Text style={[styles.checkboxText, { color: darkMode ? '#FFF' : '#000' }]}>Madrugada (12:00 AM - 06:00 AM)</Text>
                            </TouchableOpacity>

                            <Text style={[styles.inputLabel, { color: darkMode ? '#A0A0A0' : '#666', marginTop: 15 }]}>Zonas Excluidas (Opcional)</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE' }]}
                                value={zonaExcluida}
                                onChangeText={setZonaExcluida}
                                placeholder="Ej. Zonas peligrosas o fuera de la ciudad"
                                placeholderTextColor="#A0A0A0"
                            />

                            <View style={[styles.modalButtons, { marginTop: 15 }]}>
                                <TouchableOpacity style={[styles.btn, styles.btnCancel, { backgroundColor: darkMode ? '#2A2A2A' : '#FFEBEE' }]} onPress={() => setReservasModalVisible(false)}>
                                    <Text style={[styles.btnTextCancel, { color: darkMode ? '#AAA' : '#F44336' }]}>Cerrar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.btn, { backgroundColor: '#00BCD4' }]} onPress={handleSaveReservasConfig}>
                                    <Text style={[styles.btnTextSave, { color: '#FFF' }]}>Guardar</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Modal Google Drive y Alerta unificada */}
            <Modal animationType="fade" transparent={true} visible={driveModalVisible}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                        <Text style={[styles.modalTitle, { color: darkMode ? '#FFF' : '#000' }]}>Google Drive</Text>
                        <Text style={[styles.driveModalText, { color: darkMode ? '#A0A0A0' : '#666' }]}>{driveMessage}</Text>
                        {isLoadingDrive ? <ActivityIndicator size="large" color="#FFF" /> : (
                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setDriveModalVisible(false)}><Text style={styles.btnTextCancel}>Cancelar</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.btn, { backgroundColor: '#FFF' }]} onPress={executeDriveAction}><Text style={[styles.btnTextSave, { color: '#000' }]}>Continuar</Text></TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

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
    scrollContent: { padding: 20, paddingBottom: 150 },
    headerTitle: { fontSize: 28, fontWeight: 'bold', marginTop: 20, marginBottom: 30 },
    sectionTitle: { fontSize: 14, textTransform: 'uppercase', marginBottom: 10, marginLeft: 5 },
    card: { borderRadius: 16, marginBottom: 25, paddingHorizontal: 15 },
    settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1 },
    noBorder: { borderBottomWidth: 0 },
    settingInfo: { flexDirection: 'row', alignItems: 'center' },
    settingText: { fontSize: 16, marginLeft: 15 },
    checkboxRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    checkboxText: { fontSize: 15, marginLeft: 12 },
    authTabContainer: { flexDirection: 'row', marginBottom: 20, backgroundColor: '#2A2A2A', borderRadius: 12, padding: 4 },
    authTabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
    authTabBtnActive: { backgroundColor: '#00BCD4' },
    authTabText: { fontWeight: 'bold', fontSize: 13 },
    avatarPickerContainer: { width: 80, height: 80, borderRadius: 40, borderWidth: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    avatarPreview: { width: '100%', height: '100%' },
    appInfoContainer: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
        marginTop: 15, paddingHorizontal: 25, paddingVertical: 12, borderRadius: 16, elevation: 1
    },
    appLogo: { width: 38, height: 38, marginRight: 12 },
    appInfoTextWrapper: { alignItems: 'flex-start' },
    appName: { fontSize: 15, fontWeight: 'bold' },
    appVersion: { fontSize: 11, marginTop: 1 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
    modalContent: { padding: 25, borderRadius: 24, elevation: 5 },
    driveModalText: { fontSize: 15, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
    inputLabel: { fontSize: 12, marginBottom: 5, fontWeight: '600' },
    input: { padding: 12, borderRadius: 10, marginBottom: 15, fontSize: 15, borderWidth: 1 },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    btn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', marginHorizontal: 5 },
    btnCancel: {},
    btnTextCancel: { fontWeight: 'bold', color: '#F44336' },
    btnTextSave: { fontWeight: 'bold' },
    customAlertBox: { padding: 25, borderRadius: 24, alignItems: 'center', elevation: 10 },
    customAlertTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    customAlertMessage: { fontSize: 14, textAlign: 'center', marginBottom: 25, lineHeight: 20 },
    alertBtn: { padding: 14, borderRadius: 12, alignItems: 'center' }
});