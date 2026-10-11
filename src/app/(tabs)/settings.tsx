import React, {useState, useEffect} from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Switch,
    TouchableOpacity,
    Modal,
    TextInput,
    Image,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '@/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import {makeRedirectUri} from 'expo-auth-session';
import * as Updates from 'expo-updates';
import {useRouter} from 'expo-router';
import * as SQLite from 'expo-sqlite';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { sumarGastosDelMes } from '@/db/database';

WebBrowser.maybeCompleteAuthSession();

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    } as any),
});

export default function Settings() {
    const router = useRouter();
    const {darkMode, toggleDarkMode} = useTheme();
    const [notifications, setNotifications] = useState(true);
    const [biometrics, setBiometrics] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    // --- ESTADOS IA Y PDF ---
    const [iaActiva, setIaActiva] = useState(false);
    const [diaReporteIa, setDiaReporteIa] = useState('');
    const [modalDiaIAVisible, setModalDiaIAVisible] = useState(false);
    const [pdfRutaNombre, setPdfRutaNombre] = useState('Carpeta de la App por defecto'); // <-- Estado para el nombre de la ruta

    const [vehicleModalVisible, setVehicleModalVisible] = useState(false);
    const [vehicleType, setVehicleType] = useState('');
    const [vehicleBrand, setVehicleBrand] = useState('');
    const [vehicleModel, setVehicleModel] = useState('');
    const [vehicleYear, setVehicleYear] = useState('');
    const [vehiclePlate, setVehiclePlate] = useState('');

    const [tarifaModalVisible, setTarifaModalVisible] = useState(false);
    const [tarifaBase, setTarifaBase] = useState('');
    const [costoKm, setCostoKm] = useState('');
    const [costoMinuto, setCostoMinuto] = useState('');
    const [tarifaMinima, setTarifaMinima] = useState('');
    const [recargoPico, setRecargoPico] = useState('');
    const [recargoLluvia, setRecargoLluvia] = useState('');
    const [recargoNoche, setRecargoNoche] = useState('');
    const [tarifaAeropuertoSti, setTarifaAeropuertoSti] = useState('');
    const [tarifaAeropuertoSdq, setTarifaAeropuertoSdq] = useState('');
    const [tarifaAeropuertoPuj, setTarifaAeropuertoPuj] = useState('');
    const [tarifaAeropuertoLrm, setTarifaAeropuertoLrm] = useState('');
    const [recargoAfuera, setRecargoAfuera] = useState('');

    const [reservasActivas, setReservasActivas] = useState(false);
    const [reservasModalVisible, setReservasModalVisible] = useState(false);

    const [authModalVisible, setAuthModalVisible] = useState(false);
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
    const [isLoadingAuth, setIsLoadingAuth] = useState(false);

    const [loginAlias, setLoginAlias] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    const [regAlias, setRegAlias] = useState('');
    const [regNombre, setRegNombre] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regConfirmPassword, setRegConfirmPassword] = useState('');
    const [regTelefono, setRegTelefono] = useState('');
    const [regImageUri, setRegImageUri] = useState<string | null>(null);
    const [regImageBase64, setRegImageBase64] = useState<string | null>(null);

    const [horarios, setHorarios] = useState({
        manana: false,
        tarde: false,
        noche: false,
        madrugada: false
    });

    const [zonaExcluida, setZonaExcluida] = useState('');

    const [driveModalVisible, setDriveModalVisible] = useState(false);
    const [driveActionType, setDriveActionType] = useState<'backup' | 'restore'>('backup');
    const [isLoadingDrive, setIsLoadingDrive] = useState(false);
    const [driveMessage, setDriveMessage] = useState('');

    const [alertVisible, setAlertVisible] = useState(false);
    const [alertConfig, setAlertConfig] = useState({
        title: '',
        message: '',
        type: 'info' as 'info' | 'error' | 'success' | 'confirm',
        onConfirm: () => {}
    });

    const mostrarAlerta = (title: string, message: string, type: 'info' | 'error' | 'success' | 'confirm' = 'info', onConfirm = () => {}) => {
        setAlertConfig({title, message, type, onConfirm});
        setAlertVisible(true);
    };

    const [, response, promptAsync] = Google.useAuthRequest({
        webClientId: '366997518479-8onvm2na5p5smnikdhpabp58ng0e5s65.apps.googleusercontent.com',
        androidClientId: '366997518479-33t2kbs3je51i93pmlttun3hvng6k95v.apps.googleusercontent.com',
        scopes: ['https://www.googleapis.com/auth/drive.appdata'],
        redirectUri: makeRedirectUri({scheme: 'com.jrdev.drivewallet'}),
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
            cargarPreferenciasDesdeServidor();
            cargarTarifasDesdeServidor();
        } catch (error) {
            setIsLoggedIn(false);
        }
    };

    const cargarConfiguracionesGenerales = async () => {
        try {
            const notifGuardadas = await AsyncStorage.getItem('app_notifications');
            const reservasGuardadas = await AsyncStorage.getItem('reservas_activas')
            const bioGuardadas = await AsyncStorage.getItem('app_biometrics');
            const iaGuardada = await AsyncStorage.getItem('app_ia_activa');
            const iaDiaGuardado = await AsyncStorage.getItem('app_ia_dia');
            const rutaNombreGuardada = await AsyncStorage.getItem('app_pdf_ruta_nombre'); // <-- Cargar ruta del PDF

            if (notifGuardadas !== null) setNotifications(notifGuardadas === 'true');
            if (bioGuardadas !== null) setBiometrics(bioGuardadas === 'true');
            if (reservasGuardadas !== null) setReservasActivas(reservasGuardadas === 'true');
            if (iaGuardada !== null) setIaActiva(iaGuardada === 'true');
            if (iaDiaGuardado !== null) setDiaReporteIa(iaDiaGuardado);
            if (rutaNombreGuardada !== null) setPdfRutaNombre(rutaNombreGuardada);

        } catch (error) {
            console.error("Error al cargar preferencias:", error);
        }
    };

    const registrarNotificacionesPush = async () => {
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#00BCD4',
            });
        }

        if (Device.isDevice) {
            const {status: existingStatus} = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const {status} = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') {
                mostrarAlerta('Permiso Denegado', 'Para recibir reservas necesitas permitir las notificaciones en tu celular.', 'error');
                return null;
            }

            const tokenData = await Notifications.getDevicePushTokenAsync();
            return tokenData.data;
        } else {
            mostrarAlerta('Aviso', 'Las notificaciones Push requieren un dispositivo físico.', 'error');
            return null;
        }
    };

    const handleToggleIA = async (value: boolean) => {
        setIaActiva(value);
        await AsyncStorage.setItem('app_ia_activa', value.toString());

        if (value) {
            programarNotificacionMensual(diaReporteIa);
            mostrarAlerta("IA Activada", "Gemini analizará tus gastos y generará un reporte automático mensual.", "success");
        } else {
            await Notifications.cancelAllScheduledNotificationsAsync();
            mostrarAlerta("IA Desactivada", "Los reportes automáticos han sido apagados.", "info");
        }
    };

    const programarNotificacionMensual = async (diaStr: string, variacionTxt: string = "Es hora de revisar tu balance.") => {
        const diaNum = parseInt(diaStr);
        await Notifications.cancelAllScheduledNotificationsAsync();

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        const ahora = new Date();
        let proximaFecha = new Date(ahora.getFullYear(), ahora.getMonth(), diaNum, 9, 0, 0);

        if (proximaFecha <= ahora) {
            proximaFecha.setMonth(proximaFecha.getMonth() + 1);
        }

        // 🔥 SOLUCIÓN DEFINITIVA: Formato exacto que pide Expo SDK 54+ para Android
        await Notifications.scheduleNotificationAsync({
            content: {
                title: "📊 Tu Reporte Financiero IA está listo",
                body: `Recuerda que al final de cada mes puedes descargar un pdf con el Resumen de tu Mes.`,
                sound: 'default',
            },
            trigger: {
                channelId: 'default', // <--- EXIGIDO POR ANDROID AHORA
                date: proximaFecha.getTime(), // <--- En milisegundos para evitar errores de parseo
            } as any,
        });
    };

    const guardarDiaIA = async () => {
        let diaNum = parseInt(diaReporteIa);
        if (isNaN(diaNum) || diaNum < 1 || diaNum > 28) {
            mostrarAlerta("Día Inválido", "Por favor elige un día entre el 1 y el 28.", "error");
            return;
        }

        await AsyncStorage.setItem('app_ia_dia', diaReporteIa);
        setModalDiaIAVisible(false);

        const now = new Date();
        const gastosActuales = sumarGastosDelMes(new Date(now.getFullYear(), now.getMonth(), 1).getTime(), new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime());
        const gastosPasados = sumarGastosDelMes(new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(), new Date(now.getFullYear(), now.getMonth(), 0).getTime());

        let variacionTxt = "Este mes tus gastos se mantuvieron estables.";
        if (gastosPasados > 0) {
            const variacion = Math.round(((gastosActuales - gastosPasados) / gastosPasados) * 100);
            if (variacion > 0) variacionTxt = `Este mes tuvimos un aumento del ${variacion}% en los gastos.`;
            else if (variacion < 0) variacionTxt = `¡Excelente! Este mes tuvimos una reducción del ${Math.abs(variacion)}% en los gastos.`;
        }

        if (iaActiva) {
            await programarNotificacionMensual(diaReporteIa, variacionTxt);
            mostrarAlerta("Fecha Actualizada", "Se ha programado la alerta IA con tu resumen financiero.", "success");
        }
    };

    // --- FUNCIÓN PARA SELECCIONAR LA CARPETA DONDE SE GUARDARÁ EL PDF ---
    const handleSelectPdfFolder = async () => {
        if (Platform.OS === 'android') {
            try {
                // Solicita al usuario seleccionar una carpeta usando SAF (Storage Access Framework)
                const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

                if (permissions.granted) {
                    const uri = permissions.directoryUri;

                    // Decodificar la URI para sacar el nombre de la carpeta (Ej. "Documents", "Download")
                    const decodedUri = decodeURIComponent(uri);
                    const folderName = decodedUri.split('%3A').pop()?.split('/').pop() || 'Carpeta Personalizada';

                    // Guardamos la URI para usarla luego al generar el PDF y el nombre para mostrarlo en la UI
                    await AsyncStorage.setItem('app_pdf_ruta_uri', uri);
                    await AsyncStorage.setItem('app_pdf_ruta_nombre', folderName);

                    setPdfRutaNombre(folderName);
                    mostrarAlerta("Ruta Actualizada", `Tus reportes PDF se guardarán en:\n${folderName}`, "success");
                }
            } catch (e) {
                mostrarAlerta("Error", "No se pudo abrir el selector de carpetas de Android.", "error");
            }
        } else {
            mostrarAlerta("Aviso", "Esta opción solo es necesaria en dispositivos Android.", "info");
        }
    };

    const guardarTarifasPersonalizadas = async () => {
        try {
            const conductorId = await AsyncStorage.getItem('conductor_id');
            const tokenApp = await AsyncStorage.getItem('user_token');

            if (!conductorId || !tokenApp) {
                mostrarAlerta("Error", "Debes iniciar sesión para guardar tus tarifas.", "error");
                return;
            }

            const url = `https://www.jrtechnology.duckdns.org/drivewallet/api/conductores/${conductorId}/tarifas`;

            const bodyData = {
                tarifaBase: parseFloat(tarifaBase) || 150.0,
                costoPorKm: parseFloat(costoKm) || 45.0,
                costoPorMinuto: parseFloat(costoMinuto) || 5.0,
                tarifaMinima: parseFloat(tarifaMinima) || 200.0,
                recargoHoraPico: (parseFloat(recargoPico) || 20) / 100 + 1,
                recargoLluvia: (parseFloat(recargoLluvia) || 15) / 100 + 1,
                recargoNocturno: (parseFloat(recargoNoche) || 30) / 100 + 1,
                tarifaAeropuertoSti: parseFloat(tarifaAeropuertoSti) || 1000.0,
                tarifaAeropuertoSdq: parseFloat(tarifaAeropuertoSdq) || 5500.0,
                tarifaAeropuertoPuj: parseFloat(tarifaAeropuertoPuj) || 10000.0,
                tarifaAeropuertoLrm: parseFloat(tarifaAeropuertoLrm) || 8500.0,
                limiteUrbanoKm: 12.0,
                multiplicadorFueraCiudad: (parseFloat(recargoAfuera) || 50) / 100 + 1
            };

            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tokenApp}`
                },
                body: JSON.stringify(bodyData)
            });

            if (response.ok) {
                setTarifaModalVisible(false);
                mostrarAlerta("¡Éxito!", "Tus estándares de precios y algoritmos han sido guardados en el servidor.", "success");
            } else {
                mostrarAlerta("Error", "No se pudieron guardar las tarifas en el servidor.", "error");
            }
        } catch (error) {
            mostrarAlerta("Error de red", "No se pudo conectar con el servidor.", "error");
        }
    };

    const cargarTarifasDesdeServidor = async () => {
        try {
            const conductorId = await AsyncStorage.getItem('conductor_id');
            const tokenApp = await AsyncStorage.getItem('user_token');

            if (!conductorId || conductorId === 'null' || conductorId === 'undefined') return;

            const url = `https://www.jrtechnology.duckdns.org/drivewallet/api/conductores/${conductorId}/tarifas`;

            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${tokenApp || ''}` }
            });

            if (response.ok) {
                const data = await response.json();

                const tBase = data.tarifaBase ?? data.tarifa_base;
                const cKm = data.costoPorKm ?? data.costo_por_km;
                const cMin = data.costoPorMinuto ?? data.costo_por_minuto;
                const tMin = data.tarifaMinima ?? data.tarifa_minima;
                const rPico = data.recargoHoraPico ?? data.recargo_hora_pico;
                const rLluvia = data.recargoLluvia ?? data.recargo_lluvia;
                const rNoche = data.recargoNocturno ?? data.recargo_nocturno;
                const tSti = data.tarifaAeropuertoSti ?? data.tarifa_aeropuerto_sti;
                const tSdq = data.tarifaAeropuertoSdq ?? data.tarifa_aeropuerto_sdq;
                const tPuj = data.tarifaAeropuertoPuj ?? data.tarifa_aeropuerto_puj;
                const tLrm = data.tarifaAeropuertoLrm ?? data.tarifa_aeropuerto_lrm;
                const mAfuera = data.multiplicadorFueraCiudad ?? data.multiplicador_fuera_ciudad;

                if (tBase !== undefined) setTarifaBase(tBase.toString());
                if (cKm !== undefined) setCostoKm(cKm.toString());
                if (cMin !== undefined) setCostoMinuto(cMin.toString());
                if (tMin !== undefined) setTarifaMinima(tMin.toString());
                if (rPico !== undefined) setRecargoPico(((rPico - 1) * 100).toFixed(0));
                if (rLluvia !== undefined) setRecargoLluvia(((rLluvia - 1) * 100).toFixed(0));
                if (rNoche !== undefined) setRecargoNoche(((rNoche - 1) * 100).toFixed(0));
                if (tSti !== undefined) setTarifaAeropuertoSti(tSti.toString());
                if (tSdq !== undefined) setTarifaAeropuertoSdq(tSdq.toString());
                if (tPuj !== undefined) setTarifaAeropuertoPuj(tPuj.toString());
                if (tLrm !== undefined) setTarifaAeropuertoLrm(tLrm.toString());
                if (mAfuera !== undefined) setRecargoAfuera(((mAfuera - 1) * 100).toFixed(0));
            }
        } catch (error) {
            console.log("Excepción al cargar tarifas:", error);
        }
    };

    const abrirModalTarifas = async () => {
        setTarifaModalVisible(true);
    };

    const cargarPreferenciasDesdeServidor = async () => {
        try {
            const conductorId = await AsyncStorage.getItem('conductor_id');
            const tokenApp = await AsyncStorage.getItem('user_token');

            if (!conductorId) return;

            const url = `https://www.jrtechnology.duckdns.org/drivewallet/api/conductores/${conductorId}/preferencias`;

            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${tokenApp || ''}` }
            });

            if (response.ok) {
                const data = await response.json();
                setHorarios({
                    manana: data.manana ?? true,
                    tarde: data.tarde ?? true,
                    noche: data.noche ?? false,
                    madrugada: data.madrugada ?? false
                });

                if (data.zonaExcluida) setZonaExcluida(data.zonaExcluida);
            }
        } catch (error) {
            console.log("Error al cargar preferencias:", error);
        }
    };

    const handleSaveReservasConfig = async () => {
        try {
            const conductorId = await AsyncStorage.getItem('conductor_id');
            const tokenApp = await AsyncStorage.getItem('user_token');

            if (!conductorId || !tokenApp) {
                mostrarAlerta("Sesión requerida", "Debes iniciar sesión para guardar tus preferencias de turnos.", "error");
                return;
            }

            const url = `https://www.jrtechnology.duckdns.org/drivewallet/api/conductores/${conductorId}/preferencias`;

            const bodyData = {
                manana: horarios.manana,
                tarde: horarios.tarde,
                noche: horarios.noche,
                madrugada: horarios.madrugada,
                zonaExcluida: zonaExcluida.trim()
            };

            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tokenApp}`
                },
                body: JSON.stringify(bodyData)
            });

            if (response.ok) {
                setReservasModalVisible(false);
                mostrarAlerta("¡Éxito!", "Tus turnos y zonas excluidas se guardaron en el servidor.", "success");
            } else {
                mostrarAlerta("Error", "El servidor respondió con error.", "error");
            }
        } catch (error) {
            mostrarAlerta("Error de red", "No se pudo conectar con el servidor.", "error");
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
        setHorarios(prev => ({...prev, [key]: !prev[key]}));
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
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({alias_web: loginAlias.trim(), password: loginPassword.trim()}),
            });

            const responseText = await response.text();
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                data = responseText;
            }

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
                headers: {'Content-Type': 'application/json'},
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
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                data = responseText;
            }

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
                        () => {
                            router.replace('/' as any);
                        }
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
            setDriveMessage("Preparando base de datos...");

            // 🔥 FORZAMOS A SQLITE A GUARDAR TODO EN EL DISCO
            try {
                const db = SQLite.openDatabaseSync('drivewallet_db.db');
                db.execSync('PRAGMA wal_checkpoint(TRUNCATE);');
            } catch (e) {
                console.log("Error en checkpoint:", e);
            }

            const docDir = (FileSystem as any).documentDirectory;
            const dbUri = `${docDir}SQLite/drivewallet_db.db`;
            const prefsUri = `${docDir}prefs_backup.json`;

            // 🔥 FUNCIÓN SEGURA PARA NO MANDAR "NULL" A GOOGLE DRIVE
            const safeGet = async (key: string) => {
                const value = await AsyncStorage.getItem(key);
                return value ? value : '';
            };

            const prefs = {
                app_notifications: await safeGet('app_notifications'),
                app_biometrics: await safeGet('app_biometrics'),
                vehicle_type: await safeGet('vehicle_type'),
                vehicle_brand: await safeGet('vehicle_brand'),
                vehicle_model: await safeGet('vehicle_model'),
                vehicle_year: await safeGet('vehicle_year'),
                vehicle_plate: await safeGet('vehicle_plate'),
                aceite_tipo: await safeGet('aceite_tipo'),
                aceite_km: await safeGet('aceite_km'),
                aceite_fecha: await safeGet('aceite_fecha'),
                vehiculo_kilometraje: await safeGet('vehiculo_kilometraje'),
                transmision_fecha: await safeGet('transmision_fecha'),
                transmision_notas: await safeGet('transmision_notas'),
                seguro_compania: await safeGet('seguro_compania'),
                seguro_vencimiento: await safeGet('seguro_vencimiento'),

                // NUEVAS LISTAS (Usando safeGet para evitar errores de tipo)
                lista_pagos_pendientes: await safeGet('lista_pagos_pendientes'),
                lista_metas_adicionales: await safeGet('lista_metas_adicionales')
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
                {headers: {Authorization: `Bearer ${accessToken}`}}
            );
            const searchData = await searchRes.json();

            if (searchData.files && searchData.files.length > 0) {
                for (const file of searchData.files) {
                    await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
                        method: 'DELETE',
                        headers: {Authorization: `Bearer ${accessToken}`}
                    });
                }
            }

            const uploadFileToDrive = async (fileName: string, fileUri: string, mimeType: string) => {
                const metadata = {name: fileName, parents: ['appDataFolder']};
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
                    headers: {'Content-Type': mimeType},
                    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
                });
            };

            setDriveMessage("Subiendo base de datos segura...");
            await uploadFileToDrive('drivewallet_db.db', dbUri, 'application/octet-stream');

            setDriveMessage("Subiendo configuraciones y mantenimientos...");
            await uploadFileToDrive('prefs_backup.json', prefsUri, 'application/json');

            setIsLoadingDrive(false);
            setDriveModalVisible(false);
            mostrarAlerta("¡Éxito!", "Movimientos, vehículo y configuraciones respaldados en Google Drive de forma segura.", "success");

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
                {headers: {Authorization: `Bearer ${accessToken}`}}
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
            if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(sqliteDir, {intermediates: true});

            let restauroDb = false;
            let restauroPrefs = false;

            for (const file of searchData.files) {
                if (file.name === 'drivewallet_db.db') {
                    setDriveMessage("Descargando base de datos...");
                    const localUri = `${sqliteDir}/drivewallet_db.db`;

                    // Borramos archivos temporales de base de datos para evitar corrupción
                    const walUri = `${sqliteDir}/drivewallet_db.db-wal`;
                    const shmUri = `${sqliteDir}/drivewallet_db.db-shm`;
                    const walInfo = await FileSystem.getInfoAsync(walUri);
                    if (walInfo.exists) await FileSystem.deleteAsync(walUri);
                    const shmInfo = await FileSystem.getInfoAsync(shmUri);
                    if (shmInfo.exists) await FileSystem.deleteAsync(shmUri);

                    await FileSystem.downloadAsync(
                        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
                        localUri,
                        {headers: {Authorization: `Bearer ${accessToken}`}}
                    );
                    restauroDb = true;
                } else if (file.name === 'prefs_backup.json') {
                    setDriveMessage("Restaurando vehículo y mantenimiento...");
                    const jsonUri = `${docDir}prefs_backup.json`;

                    await FileSystem.downloadAsync(
                        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
                        jsonUri,
                        {headers: {Authorization: `Bearer ${accessToken}`}}
                    );

                    const jsonString = await FileSystem.readAsStringAsync(jsonUri);
                    const jsonPrefs = JSON.parse(jsonString);

                    // 🔥 FUNCIÓN SEGURA PARA EVITAR CRASHEOS CON DATOS VACÍOS
                    const safeSet = async (key: string, value: any) => {
                        if (value !== null && value !== undefined && value !== '') {
                            await AsyncStorage.setItem(key, String(value));
                        }
                    };

                    await safeSet('app_notifications', jsonPrefs.app_notifications);
                    await safeSet('app_biometrics', jsonPrefs.app_biometrics);
                    await safeSet('vehicle_type', jsonPrefs.vehicle_type);
                    await safeSet('vehicle_brand', jsonPrefs.vehicle_brand);
                    await safeSet('vehicle_model', jsonPrefs.vehicle_model);
                    await safeSet('vehicle_year', jsonPrefs.vehicle_year);
                    await safeSet('vehicle_plate', jsonPrefs.vehicle_plate);
                    await safeSet('aceite_tipo', jsonPrefs.aceite_tipo);
                    await safeSet('aceite_km', jsonPrefs.aceite_km);
                    await safeSet('aceite_fecha', jsonPrefs.aceite_fecha);
                    await safeSet('vehiculo_kilometraje', jsonPrefs.vehiculo_kilometraje);
                    await safeSet('transmision_fecha', jsonPrefs.transmision_fecha);
                    await safeSet('transmision_notas', jsonPrefs.transmision_notas);
                    await safeSet('seguro_compania', jsonPrefs.seguro_compania);
                    await safeSet('seguro_vencimiento', jsonPrefs.seguro_vencimiento);

                    // NUEVAS LISTAS (Usando safeSet para protección anti-crasheo)
                    await safeSet('lista_pagos_pendientes', jsonPrefs.lista_pagos_pendientes);
                    await safeSet('lista_metas_adicionales', jsonPrefs.lista_metas_adicionales);

                    restauroPrefs = true;
                }
            }

            setIsLoadingDrive(false);
            setDriveModalVisible(false);

            if (restauroDb || restauroPrefs) {
                mostrarAlerta(
                    "¡Restaurado con éxito!",
                    "Los datos han sido recuperados y actualizados. Presiona Aceptar para reiniciar la aplicación.",
                    "success",
                    async () => {
                        try {
                            await Updates.reloadAsync();
                        } catch (e) {
                        }
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
        <SafeAreaView style={[styles.container, {backgroundColor: darkMode ? '#121212' : '#F5F7FA'}]}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={[styles.headerTitle, {color: darkMode ? '#FFF' : '#000'}]}>Configuración</Text>

                <Text style={[styles.sectionTitle, {color: darkMode ? '#888' : '#666'}]}>Alertas Generales y
                    Seguridad</Text>
                <View style={[styles.card, {backgroundColor: darkMode ? '#1E1E1E' : '#FFF'}]}>
                    <TouchableOpacity style={[styles.settingRow, {borderBottomColor: darkMode ? '#333' : '#F0F0F0'}]}
                                      onPress={() => setVehicleModalVisible(true)}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="car-sport" size={24} color="#FF9800"/>
                            <Text style={[styles.settingText, {color: darkMode ? '#FFF' : '#000'}]}>Tipo y Datos de
                                Vehículo</Text>
                        </View>
                        <Text style={{color: darkMode ? '#888' : '#666'}}>{vehicleType} {'>'}</Text>
                    </TouchableOpacity>

                    <View style={[styles.settingRow, {borderBottomColor: darkMode ? '#333' : '#F0F0F0'}]}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="moon" size={24} color="#9C27B0"/>
                            <Text style={[styles.settingText, {color: darkMode ? '#FFF' : '#000'}]}>Modo Oscuro</Text>
                        </View>
                        <Switch value={darkMode} onValueChange={toggleDarkMode} trackColor={{true: '#00BCD4'}}/>
                    </View>

                    <View style={[styles.settingRow, {borderBottomColor: darkMode ? '#333' : '#F0F0F0'}]}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="notifications" size={24} color="#4CAF50"/>
                            <Text style={[styles.settingText, {color: darkMode ? '#FFF' : '#000'}]}>Notificaciones en el
                                celular</Text>
                        </View>
                        <Switch value={notifications} onValueChange={handleToggleNotifications}
                                trackColor={{true: '#00BCD4'}}/>
                    </View>

                    <View style={[styles.settingRow, styles.noBorder]}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="lock-closed" size={24} color="#2196F3"/>
                            <Text style={[styles.settingText, {color: darkMode ? '#FFF' : '#000'}]}>Bloqueo con
                                Huella/PIN</Text>
                        </View>
                        <Switch value={biometrics} onValueChange={handleToggleBiometrics}
                                trackColor={{true: '#00BCD4'}}/>
                    </View>
                </View>

                {/* --- SECCIÓN CONDICIONAL DE RESERVAS Y PERFIL --- */}
                <Text style={[styles.sectionTitle, {color: darkMode ? '#888' : '#666'}]}>Administración de Reservas
                    (PROXIMAMENTE)</Text>
                <View style={[styles.card, {backgroundColor: darkMode ? '#1E1E1E' : '#FFF'}]}>
                    {!isLoggedIn ? (
                        <>
                            <TouchableOpacity
                                style={[styles.settingRow, {borderBottomColor: darkMode ? '#333' : '#F0F0F0'}]}
                                onPress={() => {
                                    setAuthMode('register');
                                    setAuthModalVisible(true);
                                }}>
                                <View style={styles.settingInfo}>
                                    <Ionicons name="person-add-outline" size={24} color="#00BCD4"/>
                                    <Text style={[styles.settingText, {color: darkMode ? '#FFF' : '#000'}]}>Crear
                                        Perfil de Conductor</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={darkMode ? '#888' : '#666'}/>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.settingRow, styles.noBorder]} onPress={() => {
                                setAuthMode('login');
                                setAuthModalVisible(true);
                            }}>
                                <View style={styles.settingInfo}>
                                    <Ionicons name="log-in-outline" size={24} color="#4CAF50"/>
                                    <Text style={[styles.settingText, {color: darkMode ? '#FFF' : '#000'}]}>Iniciar
                                        Sesión</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={darkMode ? '#888' : '#666'}/>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <View style={[styles.settingRow, {borderBottomColor: darkMode ? '#333' : '#F0F0F0'}]}>
                                <View style={styles.settingInfo}>
                                    <Ionicons name="calendar-outline" size={24} color="#00BCD4"/>
                                    <Text style={[styles.settingText, {color: darkMode ? '#FFF' : '#000'}]}>Recibir
                                        Reservas</Text>
                                </View>
                                <Switch
                                    value={reservasActivas}
                                    onValueChange={async (val) => {
                                        const conductorId = await AsyncStorage.getItem('conductor_id');
                                        const tokenApp = await AsyncStorage.getItem('user_token');

                                        if (!conductorId || !tokenApp) {
                                            mostrarAlerta("Sesión requerida", "Debes iniciar sesión para cambiar tu estado de reservas.", "error");
                                            return;
                                        }

                                        if (val) {
                                            const fcmToken = await registrarNotificacionesPush();
                                            if (!fcmToken) return;

                                            try {
                                                const response = await fetch(`https://www.jrtechnology.duckdns.org/drivewallet/api/public/conductor/${conductorId}/estado-reservas`, {
                                                    method: 'PUT',
                                                    headers: {
                                                        'Content-Type': 'application/json',
                                                        'Authorization': `Bearer ${tokenApp}`
                                                    },
                                                    body: JSON.stringify({estado_activo: true, fcm_token: fcmToken})
                                                });

                                                if (response.ok) {
                                                    setReservasActivas(true);
                                                    await AsyncStorage.setItem('reservas_activas', 'true');
                                                    mostrarAlerta("¡Estás en línea!", "Ahora recibirás notificaciones de nuevas reservas VIP en tu zona.", "success");
                                                } else {
                                                    mostrarAlerta("Error", "El servidor rechazó la activación.", "error");
                                                }
                                            } catch (error) {
                                                mostrarAlerta("Error de red", "No pudimos conectar con el servidor.", "error");
                                            }
                                        } else {
                                            try {
                                                const response = await fetch(`https://www.jrtechnology.duckdns.org/drivewallet/api/public/conductor/${conductorId}/estado-reservas`, {
                                                    method: 'PUT',
                                                    headers: {
                                                        'Content-Type': 'application/json',
                                                        'Authorization': `Bearer ${tokenApp}`
                                                    },
                                                    body: JSON.stringify({estado_activo: false, fcm_token: null})
                                                });

                                                if (response.ok) {
                                                    setReservasActivas(false);
                                                    await AsyncStorage.setItem('reservas_activas', 'false');
                                                    mostrarAlerta("Desconectado", "Ya no recibirás alertas de viajes hasta que vuelvas a conectarte.", "info");
                                                } else {
                                                    mostrarAlerta("Error", "No pudimos actualizar tu estado en el servidor.", "error");
                                                }
                                            } catch (error) {
                                                mostrarAlerta("Error de red", "No pudimos desconectarte.", "error");
                                            }
                                        }
                                    }}
                                    trackColor={{true: '#00BCD4'}}
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.settingRow, {borderBottomColor: darkMode ? '#333' : '#F0F0F0'}]}
                                onPress={() => {
                                    setReservasModalVisible(true);
                                    cargarPreferenciasDesdeServidor();
                                }}>
                                <View style={styles.settingInfo}>
                                    <Ionicons name="options-outline" size={24} color="#FF5722"/>
                                    <Text style={[styles.settingText, {color: darkMode ? '#FFF' : '#000'}]}>Administrar
                                        Información</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={darkMode ? '#888' : '#666'}/>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.settingRow,
                                    {borderBottomColor: darkMode ? '#333' : '#F0F0F0'}
                                ]}
                                onPress={ () => {
                                    abrirModalTarifas();
                                    cargarTarifasDesdeServidor();
                                }}>
                                <View style={styles.settingInfo}>
                                    <Ionicons name="cash-outline" size={24} color="#FF5722"/>
                                    <Text style={[styles.settingText, {color: darkMode ? '#FFF' : '#000'}]}>
                                        Administrar Tarifas
                                    </Text>
                                </View>

                                <Ionicons
                                    name="chevron-forward"
                                    size={18}
                                    color={darkMode ? '#888' : '#666'}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.settingRow, styles.noBorder]} onPress={handleCerrarSesion}>
                                <View style={styles.settingInfo}>
                                    <Ionicons name="log-out-outline" size={24} color="#F44336"/>
                                    <Text style={[styles.settingText, {color: '#F44336'}]}>Cerrar Sesión</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={darkMode ? '#888' : '#666'}/>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                <Text style={[styles.sectionTitle, {color: darkMode ? '#888' : '#666'}]}>Copias en la Nube (Google
                    Drive)</Text>
                <View style={[styles.card, {backgroundColor: darkMode ? '#1E1E1E' : '#FFF'}]}>
                    <TouchableOpacity style={[styles.settingRow, {borderBottomColor: darkMode ? '#333' : '#F0F0F0'}]}
                                      onPress={() => openDriveModal('backup')}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="cloud-upload-outline" size={24} color={darkMode ? '#AAA' : '#666'}/>
                            <Text style={[styles.settingText, {color: darkMode ? '#FFF' : '#000'}]}>Crear Copia de
                                Seguridad</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.settingRow, styles.noBorder]}
                                      onPress={() => openDriveModal('restore')}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="cloud-download-outline" size={24} color="#F44336"/>
                            <Text style={[styles.settingText, {color: '#F44336'}]}>Restaurar Copia de Seguridad</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                <Text style={[styles.sectionTitle, {color: darkMode ? '#888' : '#666'}]}>Inteligencia Artificial (Gemini)</Text>
                <View style={[styles.card, {backgroundColor: darkMode ? '#1E1E1E' : '#FFF'}]}>
                    <View style={[styles.settingRow, {borderBottomColor: darkMode ? '#333' : '#F0F0F0'}]}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="hardware-chip" size={24} color="#9C27B0"/>
                            <View>
                                <Text style={[styles.settingText, {color: darkMode ? '#FFF' : '#000'}]}>Asistente de IA</Text>
                            </View>
                        </View>
                        <Switch value={iaActiva} onValueChange={handleToggleIA} trackColor={{true: '#00BCD4'}}/>
                    </View>

                    <TouchableOpacity style={[styles.settingRow, {borderBottomColor: darkMode ? '#333' : '#F0F0F0'}]} onPress={() => setModalDiaIAVisible(true)}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="calendar" size={24} color="#2196F3"/>
                            <View>
                                <Text style={[styles.settingText, {color: darkMode ? '#FFF' : '#000'}]}>Día del Reporte Mensual</Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={darkMode ? '#888' : '#666'} />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.settingRow, styles.noBorder]} onPress={handleSelectPdfFolder}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="folder-open" size={24} color="#FF9800"/>
                            <View>
                                <Text style={[styles.settingText, {color: darkMode ? '#FFF' : '#000'}]}>Guardar PDF en:</Text>
                                <Text style={{color: darkMode ? '#A0A0A0' : '#666', fontSize: 11, marginLeft: 15}} numberOfLines={1}>
                                    {pdfRutaNombre}
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={darkMode ? '#888' : '#666'} />
                    </TouchableOpacity>
                </View>

                <Text style={[styles.sectionTitle, {color: darkMode ? '#888' : '#666'}]}>Soporte y Legal</Text>
                <View style={[styles.card, {backgroundColor: darkMode ? '#1E1E1E' : '#FFF'}]}>
                    <TouchableOpacity style={[styles.settingRow, {borderBottomColor: darkMode ? '#333' : '#F0F0F0'}]}
                                      onPress={handleSoporte}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="help-buoy-outline" size={24} color="#3F51B5"/>
                            <Text style={[styles.settingText, {color: darkMode ? '#FFF' : '#000'}]}>Ayuda y
                                Soporte</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={darkMode ? '#888' : '#666'}/>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.settingRow, styles.noBorder]} onPress={handlePoliticas}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="shield-checkmark-outline" size={24} color="#8BC34A"/>
                            <Text style={[styles.settingText, {color: darkMode ? '#FFF' : '#000'}]}>Política de
                                Privacidad</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={darkMode ? '#888' : '#666'}/>
                    </TouchableOpacity>
                </View>

                <View style={[styles.appInfoContainer, {backgroundColor: darkMode ? '#1E1E1E' : '#FFFFFF'}]}>
                    <Image
                        source={require('../assets/images/drivewallet_sinfondo.png')}
                        style={styles.appLogo}
                        resizeMode="contain"
                    />
                    <View style={styles.appInfoTextWrapper}>
                        <Text style={[styles.appName, {color: darkMode ? '#FFF' : '#1E1E1E'}]}>DriveWallet</Text>
                        <Text style={[styles.appVersion, {color: '#888'}]}>Versión 5.4.20 (ALPHA TEST)</Text>
                    </View>
                </View>

            </ScrollView>

            {/* Modal para Día de Reporte IA */}
            <Modal animationType="slide" transparent={true} visible={modalDiaIAVisible}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: darkMode ? '#1E1E1E' : '#FFF' }]}>
                        <Text style={[styles.modalTitle, { color: darkMode ? '#FFF' : '#000', marginBottom: 10 }]}>Día del Reporte IA</Text>
                        <Text style={{ color: darkMode ? '#888' : '#666', textAlign: 'center', marginBottom: 20 }}>
                            ¿Qué día de cada mes quieres que Gemini te prepare tu PDF financiero? (1 - 28)
                        </Text>

                        <TextInput
                            style={[styles.input, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA', color: darkMode ? '#FFF' : '#000', borderColor: darkMode ? '#333' : '#EEE', textAlign: 'center', fontSize: 24, fontWeight: 'bold' }]}
                            placeholder="Día (ej. 28)"
                            keyboardType="numeric"
                            maxLength={2}
                            value={diaReporteIa}
                            onChangeText={setDiaReporteIa}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.btn, styles.btnCancel, { backgroundColor: darkMode ? '#2A2A2A' : '#F5F5F5' }]} onPress={() => setModalDiaIAVisible(false)}>
                                <Text style={[styles.btnTextCancel, { color: darkMode ? '#AAA' : '#666' }]}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btn, { backgroundColor: '#9C27B0' }]} onPress={guardarDiaIA}>
                                <Text style={[styles.btnTextSave, { color: '#FFF' }]}>Guardar Día</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Modal de Autenticación Unificado */}
            <Modal animationType="slide" transparent={true} visible={authModalVisible}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                                      style={styles.modalOverlay}>
                    <View style={[styles.modalContent, {
                        backgroundColor: darkMode ? '#1E1E1E' : '#FFF',
                        maxHeight: '90%'
                    }]}>
                        <ScrollView contentContainerStyle={{paddingBottom: 10}} showsVerticalScrollIndicator={false}>

                            <View style={styles.authTabContainer}>
                                <TouchableOpacity
                                    style={[styles.authTabBtn, authMode === 'login' && styles.authTabBtnActive]}
                                    onPress={() => setAuthMode('login')}
                                >
                                    <Text
                                        style={[styles.authTabText, {color: authMode === 'login' ? '#FFF' : (darkMode ? '#888' : '#666')}]}>Iniciar
                                        Sesión</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.authTabBtn, authMode === 'register' && styles.authTabBtnActive]}
                                    onPress={() => setAuthMode('register')}
                                >
                                    <Text
                                        style={[styles.authTabText, {color: authMode === 'register' ? '#FFF' : (darkMode ? '#888' : '#666')}]}>Crear
                                        Perfil</Text>
                                </TouchableOpacity>
                            </View>

                            {authMode === 'login' ? (
                                <>
                                    <Text style={[styles.modalTitle, {
                                        color: darkMode ? '#FFF' : '#000',
                                        marginBottom: 15
                                    }]}>Iniciar Sesión</Text>
                                    <TextInput
                                        style={[styles.input, {
                                            backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                                            color: darkMode ? '#FFF' : '#000',
                                            borderColor: darkMode ? '#333' : '#EEE'
                                        }]}
                                        placeholder="Alias Web del conductor (Ej. pedro-sanz)"
                                        placeholderTextColor="#A0A0A0"
                                        value={loginAlias}
                                        onChangeText={setLoginAlias}
                                        autoCapitalize="none"
                                    />
                                    <TextInput
                                        style={[styles.input, {
                                            backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                                            color: darkMode ? '#FFF' : '#000',
                                            borderColor: darkMode ? '#333' : '#EEE'
                                        }]}
                                        placeholder="Contraseña"
                                        placeholderTextColor="#A0A0A0"
                                        secureTextEntry={true}
                                        value={loginPassword}
                                        onChangeText={setLoginPassword}
                                    />
                                    <View style={styles.modalButtons}>
                                        <TouchableOpacity
                                            style={[styles.btn, styles.btnCancel, {backgroundColor: darkMode ? '#2A2A2A' : '#FFEBEE'}]}
                                            onPress={() => setAuthModalVisible(false)}>
                                            <Text
                                                style={[styles.btnTextCancel, {color: darkMode ? '#AAA' : '#F44336'}]}>Cancelar</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.btn, {backgroundColor: darkMode ? '#FFF' : '#1E1E1E'}]}
                                            onPress={handleLogin} disabled={isLoadingAuth}>
                                            <Text
                                                style={[styles.btnTextSave, {color: darkMode ? '#000' : '#FFF'}]}>{isLoadingAuth ? 'Entrando...' : 'Entrar'}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            ) : (
                                <>
                                    <Text style={[styles.modalTitle, {
                                        color: darkMode ? '#FFF' : '#000',
                                        marginBottom: 5
                                    }]}>Registro de Conductor</Text>
                                    <Text style={{
                                        color: darkMode ? '#888' : '#666',
                                        fontSize: 11,
                                        textAlign: 'center',
                                        marginBottom: 15
                                    }}>
                                        Tu vehículo configurado se unirá automáticamente al perfil.
                                    </Text>

                                    <View style={{alignItems: 'center', marginBottom: 15}}>
                                        <TouchableOpacity onPress={pickProfileImage}
                                                          style={[styles.avatarPickerContainer, {
                                                              backgroundColor: darkMode ? '#2A2A2A' : '#EEE',
                                                              borderColor: darkMode ? '#444' : '#DDD'
                                                          }]}>
                                            {regImageUri ? (
                                                <Image source={{uri: regImageUri}} style={styles.avatarPreview}/>
                                            ) : (
                                                <Ionicons name="camera-outline" size={32}
                                                          color={darkMode ? '#AAA' : '#666'}/>
                                            )}
                                        </TouchableOpacity>
                                        <Text style={{color: darkMode ? '#888' : '#666', fontSize: 12, marginTop: 5}}>Toca
                                            para agregar tu foto</Text>
                                    </View>

                                    <TextInput
                                        style={[styles.input, {
                                            backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                                            color: darkMode ? '#FFF' : '#000',
                                            borderColor: darkMode ? '#333' : '#EEE'
                                        }]}
                                        placeholder="Alias Web (Ej. carlos-perez)"
                                        placeholderTextColor="#A0A0A0"
                                        value={regAlias}
                                        onChangeText={setRegAlias}
                                        autoCapitalize="none"
                                    />
                                    <TextInput
                                        style={[styles.input, {
                                            backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                                            color: darkMode ? '#FFF' : '#000',
                                            borderColor: darkMode ? '#333' : '#EEE'
                                        }]}
                                        placeholder="Nombre Completo"
                                        placeholderTextColor="#A0A0A0"
                                        value={regNombre}
                                        onChangeText={setRegNombre}
                                    />
                                    <TextInput
                                        style={[styles.input, {
                                            backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                                            color: darkMode ? '#FFF' : '#000',
                                            borderColor: darkMode ? '#333' : '#EEE'
                                        }]}
                                        placeholder="Correo Electrónico (Opcional)"
                                        placeholderTextColor="#A0A0A0"
                                        value={regEmail}
                                        onChangeText={setRegEmail}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                    />
                                    <TextInput
                                        style={[styles.input, {
                                            backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                                            color: darkMode ? '#FFF' : '#000',
                                            borderColor: darkMode ? '#333' : '#EEE'
                                        }]}
                                        placeholder="Teléfono (Ej. 8095551234)"
                                        placeholderTextColor="#A0A0A0"
                                        value={regTelefono}
                                        onChangeText={setRegTelefono}
                                        keyboardType="phone-pad"
                                    />
                                    <TextInput
                                        style={[styles.input, {
                                            backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                                            color: darkMode ? '#FFF' : '#000',
                                            borderColor: darkMode ? '#333' : '#EEE'
                                        }]}
                                        placeholder="Contraseña (mínimo 6 caracteres)"
                                        placeholderTextColor="#A0A0A0"
                                        secureTextEntry={true}
                                        value={regPassword}
                                        onChangeText={setRegPassword}
                                    />
                                    <TextInput
                                        style={[styles.input, {
                                            backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                                            color: darkMode ? '#FFF' : '#000',
                                            borderColor: darkMode ? '#333' : '#EEE'
                                        }]}
                                        placeholder="Confirmar Contraseña"
                                        placeholderTextColor="#A0A0A0"
                                        secureTextEntry={true}
                                        value={regConfirmPassword}
                                        onChangeText={setRegConfirmPassword}
                                    />

                                    <View style={styles.modalButtons}>
                                        <TouchableOpacity
                                            style={[styles.btn, styles.btnCancel, {backgroundColor: darkMode ? '#2A2A2A' : '#FFEBEE'}]}
                                            onPress={() => setAuthModalVisible(false)}>
                                            <Text
                                                style={[styles.btnTextCancel, {color: darkMode ? '#AAA' : '#F44336'}]}>Cancelar</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.btn, {backgroundColor: '#00BCD4'}]}
                                                          onPress={handleRegister} disabled={isLoadingAuth}>
                                            <Text
                                                style={[styles.btnTextSave, {color: '#FFF'}]}>{isLoadingAuth ? 'Registrando...' : 'Crear Perfil'}</Text>
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
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                                      style={styles.modalOverlay}>
                    <View style={[styles.modalContent, {backgroundColor: darkMode ? '#1E1E1E' : '#FFF'}]}>
                        <Text style={[styles.modalTitle, {color: darkMode ? '#FFF' : '#000', marginBottom: 15}]}>Datos
                            del Vehículo</Text>
                        <TextInput style={[styles.input, {
                            backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                            color: darkMode ? '#FFF' : '#000',
                            borderColor: darkMode ? '#333' : '#EEE'
                        }]} value={vehicleType} onChangeText={setVehicleType} placeholder="Tipo (Ej. Sedán)"
                                   placeholderTextColor="#A0A0A0"/>
                        <TextInput style={[styles.input, {
                            backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                            color: darkMode ? '#FFF' : '#000',
                            borderColor: darkMode ? '#333' : '#EEE'
                        }]} value={vehicleBrand} onChangeText={setVehicleBrand} placeholder="Marca (Ej. Hyundai)"
                                   placeholderTextColor="#A0A0A0"/>
                        <TextInput style={[styles.input, {
                            backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                            color: darkMode ? '#FFF' : '#000',
                            borderColor: darkMode ? '#333' : '#EEE'
                        }]} value={vehicleModel} onChangeText={setVehicleModel} placeholder="Modelo (Ej. Sonata)"
                                   placeholderTextColor="#A0A0A0"/>
                        <TextInput style={[styles.input, {
                            backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                            color: darkMode ? '#FFF' : '#000',
                            borderColor: darkMode ? '#333' : '#EEE'
                        }]} value={vehicleYear} onChangeText={setVehicleYear} placeholder="Año (Ej. 2016)"
                                   placeholderTextColor="#A0A0A0" keyboardType="numeric"/>
                        <TextInput style={[styles.input, {
                            backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                            color: darkMode ? '#FFF' : '#000',
                            borderColor: darkMode ? '#333' : '#EEE'
                        }]} value={vehiclePlate} onChangeText={setVehiclePlate} placeholder="Placa (Ej. A123456)"
                                   placeholderTextColor="#A0A0A0"/>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.btn, styles.btnCancel, {backgroundColor: darkMode ? '#2A2A2A' : '#FFEBEE'}]}
                                onPress={() => setVehicleModalVisible(false)}>
                                <Text
                                    style={[styles.btnTextCancel, {color: darkMode ? '#AAA' : '#F44336'}]}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btn, {backgroundColor: darkMode ? '#FFF' : '#1E1E1E'}]}
                                              onPress={handleSaveVehicle}>
                                <Text style={[styles.btnTextSave, {color: darkMode ? '#000' : '#FFF'}]}>Guardar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Modal de Reservas / Turnos */}
            <Modal animationType="slide" transparent={true} visible={reservasModalVisible}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                                      style={styles.modalOverlay}>
                    <View style={[styles.modalContent, {
                        backgroundColor: darkMode ? '#1E1E1E' : '#FFF',
                        maxHeight: '85%'
                    }]}>
                        <ScrollView contentContainerStyle={{paddingBottom: 10}} showsVerticalScrollIndicator={false}>
                            <View style={{alignItems: 'center', marginBottom: 15}}>
                                <Ionicons name="construct-outline" size={36} color="#00BCD4"/>
                                <Text style={[styles.modalTitle, {color: darkMode ? '#FFF' : '#000', marginTop: 8}]}>Administrar
                                    Información</Text>
                                <Text style={{
                                    color: darkMode ? '#888' : '#666',
                                    fontSize: 12,
                                    textAlign: 'center',
                                    marginTop: 4
                                }}>
                                    Selecciona los turnos en los que deseas recibir reservas y especifica zonas que
                                    prefieras evitar.
                                </Text>
                            </View>

                            <Text style={[styles.inputLabel, {color: darkMode ? '#A0A0A0' : '#666', marginBottom: 8}]}>Turnos
                                y Horarios de Trabajo</Text>

                            <TouchableOpacity style={styles.checkboxRow} onPress={() => toggleHorario('manana')}>
                                <Ionicons name={horarios.manana ? "checkbox" : "square-outline"} size={22}
                                          color={horarios.manana ? "#00BCD4" : (darkMode ? "#666" : "#aaa")}/>
                                <Text style={[styles.checkboxText, {color: darkMode ? '#FFF' : '#000'}]}>Mañana (06:00
                                    AM - 12:00 PM)</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.checkboxRow} onPress={() => toggleHorario('tarde')}>
                                <Ionicons name={horarios.tarde ? "checkbox" : "square-outline"} size={22}
                                          color={horarios.tarde ? "#00BCD4" : (darkMode ? "#666" : "#aaa")}/>
                                <Text style={[styles.checkboxText, {color: darkMode ? '#FFF' : '#000'}]}>Tarde (12:00 PM
                                    - 06:00 PM)
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.checkboxRow} onPress={() => toggleHorario('noche')}>
                                <Ionicons name={horarios.noche ? "checkbox" : "square-outline"} size={22}
                                          color={horarios.noche ? "#00BCD4" : (darkMode ? "#666" : "#aaa")}/>
                                <Text style={[styles.checkboxText, {color: darkMode ? '#FFF' : '#000'}]}>Noche (06:00 PM
                                    - 12:00 AM)
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.checkboxRow} onPress={() => toggleHorario('madrugada')}>
                                <Ionicons name={horarios.madrugada ? "checkbox" : "square-outline"} size={22}
                                          color={horarios.madrugada ? "#00BCD4" : (darkMode ? "#666" : "#aaa")}/>
                                <Text style={[styles.checkboxText, {color: darkMode ? '#FFF' : '#000'}]}>Madrugada
                                    (12:00 AM - 06:00 AM)</Text>
                            </TouchableOpacity>

                            <Text style={[styles.inputLabel, {color: darkMode ? '#A0A0A0' : '#666', marginTop: 15}]}>Zonas
                                Excluidas (Opcional)</Text>
                            <TextInput
                                style={[styles.input, {
                                    backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                                    color: darkMode ? '#FFF' : '#000',
                                    borderColor: darkMode ? '#333' : '#EEE'
                                }]}
                                value={zonaExcluida}
                                onChangeText={setZonaExcluida}
                                placeholder="Ej. Zonas peligrosas o fuera de la ciudad"
                                placeholderTextColor="#A0A0A0"
                            />

                            <View style={[styles.modalButtons, {marginTop: 15}]}>
                                <TouchableOpacity
                                    style={[styles.btn, styles.btnCancel, {backgroundColor: darkMode ? '#2A2A2A' : '#FFEBEE'}]}
                                    onPress={() => setReservasModalVisible(false)}>
                                    <Text
                                        style={[styles.btnTextCancel, {color: darkMode ? '#AAA' : '#F44336'}]}>Cerrar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.btn, {backgroundColor: '#00BCD4'}]}
                                                  onPress={handleSaveReservasConfig}>
                                    <Text style={[styles.btnTextSave, {color: '#FFF'}]}>Guardar</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* --- MODAL DE ADMINISTRAR TARIFAS --- */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={tarifaModalVisible}
                onRequestClose={() => setTarifaModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View
                        style={[
                            styles.modalContent,
                            {
                                backgroundColor: darkMode ? '#1E1E1E' : '#FFF',
                                maxHeight: '90%'
                            }
                        ]}
                    >
                        <ScrollView
                            contentContainerStyle={{paddingBottom: 10}}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            <View style={{alignItems: 'center', marginBottom: 15}}>
                                <Ionicons
                                    name="cash-outline"
                                    size={36}
                                    color="#FF5722"
                                />

                                <Text
                                    style={[
                                        styles.modalTitle,
                                        {
                                            color: darkMode ? '#FFF' : '#000',
                                            marginTop: 8
                                        }
                                    ]}
                                >
                                    Administrar Tarifas
                                </Text>

                                <Text
                                    style={{
                                        color: darkMode ? '#888' : '#666',
                                        fontSize: 12,
                                        textAlign: 'center',
                                        marginTop: 4
                                    }}
                                >
                                    Configura tus precios base y recargos para el cálculo
                                    automático de tus viajes.
                                </Text>
                            </View>

                            {/* TARIFA BASE */}
                            <Text
                                style={[
                                    styles.inputLabel,
                                    {color: darkMode ? '#A0A0A0' : '#666'}
                                ]}
                            >
                                Tarifa Base
                            </Text>

                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                                        color: darkMode ? '#FFF' : '#000',
                                        borderColor: darkMode ? '#333' : '#EEE'
                                    }
                                ]}
                                value={tarifaBase}
                                onChangeText={setTarifaBase}
                                placeholder="Ej. 150"
                                placeholderTextColor="#A0A0A0"
                                keyboardType="decimal-pad"
                            />

                            {/* COSTO POR KM */}
                            <Text
                                style={[
                                    styles.inputLabel,
                                    {color: darkMode ? '#A0A0A0' : '#666'}
                                ]}
                            >
                                Costo por Kilómetro
                            </Text>

                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                                        color: darkMode ? '#FFF' : '#000',
                                        borderColor: darkMode ? '#333' : '#EEE'
                                    }
                                ]}
                                value={costoKm}
                                onChangeText={setCostoKm}
                                placeholder="Ej. 45"
                                placeholderTextColor="#A0A0A0"
                                keyboardType="decimal-pad"
                            />

                            {/* COSTO POR MINUTO */}
                            <Text
                                style={[
                                    styles.inputLabel,
                                    {color: darkMode ? '#A0A0A0' : '#666'}
                                ]}
                            >
                                Costo por Minuto
                            </Text>

                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                                        color: darkMode ? '#FFF' : '#000',
                                        borderColor: darkMode ? '#333' : '#EEE'
                                    }
                                ]}
                                value={costoMinuto}
                                onChangeText={setCostoMinuto}
                                placeholder="Ej. 5"
                                placeholderTextColor="#A0A0A0"
                                keyboardType="decimal-pad"
                            />

                            {/* TARIFA MINIMA */}
                            <Text
                                style={[
                                    styles.inputLabel,
                                    {color: darkMode ? '#A0A0A0' : '#666'}
                                ]}
                            >
                                Tarifa Mínima
                            </Text>

                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                                        color: darkMode ? '#FFF' : '#000',
                                        borderColor: darkMode ? '#333' : '#EEE'
                                    }
                                ]}
                                value={tarifaMinima}
                                onChangeText={setTarifaMinima}
                                placeholder="Ej. 200"
                                placeholderTextColor="#A0A0A0"
                                keyboardType="decimal-pad"
                            />

                            {/* SEPARADOR */}
                            <View
                                style={{
                                    height: 1,
                                    backgroundColor: darkMode ? '#333' : '#EEE',
                                    marginVertical: 5
                                }}
                            />

                            <Text
                                style={[
                                    styles.inputLabel,
                                    {
                                        color: darkMode ? '#FFF' : '#000',
                                        fontSize: 14,
                                        marginBottom: 12,
                                        marginTop: 5
                                    }
                                ]}
                            >
                                Recargos
                            </Text>

                            {/* HORA PICO */}
                            <Text
                                style={[
                                    styles.inputLabel,
                                    {color: darkMode ? '#A0A0A0' : '#666'}
                                ]}
                            >
                                Recargo Hora Pico (%)
                            </Text>

                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                                        color: darkMode ? '#FFF' : '#000',
                                        borderColor: darkMode ? '#333' : '#EEE'
                                    }
                                ]}
                                value={recargoPico}
                                onChangeText={setRecargoPico}
                                placeholder="Ej. 20"
                                placeholderTextColor="#A0A0A0"
                                keyboardType="numeric"
                            />

                            {/* LLUVIA */}
                            <Text
                                style={[
                                    styles.inputLabel,
                                    {color: darkMode ? '#A0A0A0' : '#666'}
                                ]}
                            >
                                Recargo por Lluvia (%)
                            </Text>

                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                                        color: darkMode ? '#FFF' : '#000',
                                        borderColor: darkMode ? '#333' : '#EEE'
                                    }
                                ]}
                                value={recargoLluvia}
                                onChangeText={setRecargoLluvia}
                                placeholder="Ej. 15"
                                placeholderTextColor="#A0A0A0"
                                keyboardType="numeric"
                            />

                            {/* NOCHE */}
                            <Text
                                style={[
                                    styles.inputLabel,
                                    {color: darkMode ? '#A0A0A0' : '#666'}
                                ]}
                            >
                                Recargo Nocturno (%)
                            </Text>

                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                                        color: darkMode ? '#FFF' : '#000',
                                        borderColor: darkMode ? '#333' : '#EEE'
                                    }
                                ]}
                                value={recargoNoche}
                                onChangeText={setRecargoNoche}
                                placeholder="Ej. 30"
                                placeholderTextColor="#A0A0A0"
                                keyboardType="numeric"
                            />

                            {/* SEPARADOR */}
                            <View
                                style={{
                                    height: 1,
                                    backgroundColor: darkMode ? '#333' : '#EEE',
                                    marginVertical: 5
                                }}
                            />

                            <Text
                                style={[
                                    styles.inputLabel,
                                    {
                                        color: darkMode ? '#FFF' : '#000',
                                        fontSize: 14,
                                        marginBottom: 12,
                                        marginTop: 5
                                    }
                                ]}
                            >
                                Tarifas de Aeropuertos
                            </Text>

                            {/* STI */}
                            <Text
                                style={[
                                    styles.inputLabel,
                                    {color: darkMode ? '#A0A0A0' : '#666'}
                                ]}
                            >
                                Aeropuerto STI
                            </Text>

                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                                        color: darkMode ? '#FFF' : '#000',
                                        borderColor: darkMode ? '#333' : '#EEE'
                                    }
                                ]}
                                value={tarifaAeropuertoSti}
                                onChangeText={setTarifaAeropuertoSti}
                                placeholder="Ej. 1000"
                                placeholderTextColor="#A0A0A0"
                                keyboardType="decimal-pad"
                            />

                            {/* SDQ */}
                            <Text
                                style={[
                                    styles.inputLabel,
                                    {color: darkMode ? '#A0A0A0' : '#666'}
                                ]}
                            >
                                Aeropuerto SDQ
                            </Text>

                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                                        color: darkMode ? '#FFF' : '#000',
                                        borderColor: darkMode ? '#333' : '#EEE'
                                    }
                                ]}
                                value={tarifaAeropuertoSdq}
                                onChangeText={setTarifaAeropuertoSdq}
                                placeholder="Ej. 5500"
                                placeholderTextColor="#A0A0A0"
                                keyboardType="decimal-pad"
                            />

                            {/* PUJ */}
                            <Text
                                style={[
                                    styles.inputLabel,
                                    {color: darkMode ? '#A0A0A0' : '#666'}
                                ]}
                            >
                                Aeropuerto PUJ
                            </Text>

                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                                        color: darkMode ? '#FFF' : '#000',
                                        borderColor: darkMode ? '#333' : '#EEE'
                                    }
                                ]}
                                value={tarifaAeropuertoPuj}
                                onChangeText={setTarifaAeropuertoPuj}
                                placeholder="Ej. 10000"
                                placeholderTextColor="#A0A0A0"
                                keyboardType="decimal-pad"
                            />

                            {/* LRM */}
                            <Text
                                style={[
                                    styles.inputLabel,
                                    {color: darkMode ? '#A0A0A0' : '#666'}
                                ]}
                            >
                                Aeropuerto LRM
                            </Text>

                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                                        color: darkMode ? '#FFF' : '#000',
                                        borderColor: darkMode ? '#333' : '#EEE'
                                    }
                                ]}
                                value={tarifaAeropuertoLrm}
                                onChangeText={setTarifaAeropuertoLrm}
                                placeholder="Ej. 8500"
                                placeholderTextColor="#A0A0A0"
                                keyboardType="decimal-pad"
                            />

                            {/* SEPARADOR */}
                            <View
                                style={{
                                    height: 1,
                                    backgroundColor: darkMode ? '#333' : '#EEE',
                                    marginVertical: 5
                                }}
                            />

                            {/* FUERA DE CIUDAD */}
                            <Text
                                style={[
                                    styles.inputLabel,
                                    {
                                        color: darkMode ? '#A0A0A0' : '#666',
                                        marginTop: 5
                                    }
                                ]}
                            >
                                Recargo Fuera de Ciudad (%)
                            </Text>

                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: darkMode ? '#2A2A2A' : '#F5F7FA',
                                        color: darkMode ? '#FFF' : '#000',
                                        borderColor: darkMode ? '#333' : '#EEE'
                                    }
                                ]}
                                value={recargoAfuera}
                                onChangeText={setRecargoAfuera}
                                placeholder="Ej. 50"
                                placeholderTextColor="#A0A0A0"
                                keyboardType="numeric"
                            />

                            <Text
                                style={{
                                    color: darkMode ? '#777' : '#888',
                                    fontSize: 11,
                                    lineHeight: 17,
                                    marginTop: -5,
                                    marginBottom: 10
                                }}
                            >
                                Este porcentaje se aplica cuando el viaje supera el límite
                                urbano de 12 km.
                            </Text>

                            {/* BOTONES */}
                            <View style={[styles.modalButtons, {marginTop: 10}]}>
                                <TouchableOpacity
                                    style={[
                                        styles.btn,
                                        styles.btnCancel,
                                        {
                                            backgroundColor: darkMode ? '#2A2A2A' : '#FFEBEE'
                                        }
                                    ]}
                                    onPress={() => setTarifaModalVisible(false)}
                                >
                                    <Text
                                        style={[
                                            styles.btnTextCancel,
                                            {
                                                color: darkMode ? '#AAA' : '#F44336'
                                            }
                                        ]}
                                    >
                                        Cancelar
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.btn,
                                        {
                                            backgroundColor: darkMode ? '#FFF' : '#1E1E1E'
                                        }
                                    ]}
                                    onPress={guardarTarifasPersonalizadas}
                                >
                                    <Text
                                        style={[
                                            styles.btnTextSave,
                                            {
                                                color: darkMode ? '#000' : '#FFF'
                                            }
                                        ]}
                                    >
                                        Guardar Tarifas
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Modal Google Drive y Alerta unificada */}
            <Modal animationType="fade" transparent={true} visible={driveModalVisible}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, {backgroundColor: darkMode ? '#1E1E1E' : '#FFF'}]}>
                        <Text style={[styles.modalTitle, {color: darkMode ? '#FFF' : '#000'}]}>Google Drive</Text>
                        <Text
                            style={[styles.driveModalText, {color: darkMode ? '#A0A0A0' : '#666'}]}>{driveMessage}</Text>
                        {isLoadingDrive ? <ActivityIndicator size="large" color="#FFF"/> : (
                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={[styles.btn, styles.btnCancel]}
                                                  onPress={() => setDriveModalVisible(false)}><Text
                                    style={styles.btnTextCancel}>Cancelar</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.btn, {backgroundColor: '#FFF'}]}
                                                  onPress={executeDriveAction}><Text
                                    style={[styles.btnTextSave, {color: '#000'}]}>Continuar</Text></TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            <Modal animationType="fade" transparent={true} visible={alertVisible}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.customAlertBox, {backgroundColor: darkMode ? '#1E1E1E' : '#FFF'}]}>
                        <Text
                            style={[styles.customAlertTitle, {color: darkMode ? '#FFF' : '#000'}]}>{alertConfig.title}</Text>
                        <Text
                            style={[styles.customAlertMessage, {color: darkMode ? '#A0A0A0' : '#666'}]}>{alertConfig.message}</Text>
                        <TouchableOpacity
                            style={[styles.alertBtn, {backgroundColor: darkMode ? '#FFF' : '#1E1E1E', width: '100%'}]}
                            onPress={() => {
                                setAlertVisible(false);
                                if (alertConfig.onConfirm) alertConfig.onConfirm();
                            }}>
                            <Text style={{color: darkMode ? '#000' : '#FFF', fontWeight: 'bold'}}>Aceptar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {flex: 1},
    scrollContent: {padding: 20, paddingBottom: 150},
    headerTitle: {fontSize: 28, fontWeight: 'bold', marginTop: 20, marginBottom: 30},
    sectionTitle: {fontSize: 14, textTransform: 'uppercase', marginBottom: 10, marginLeft: 5},
    card: {borderRadius: 16, marginBottom: 25, paddingHorizontal: 15},
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1
    },
    noBorder: {borderBottomWidth: 0},
    settingInfo: {flexDirection: 'row', alignItems: 'center'},
    settingText: {fontSize: 16, marginLeft: 15},
    checkboxRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 10},
    checkboxText: {fontSize: 15, marginLeft: 12},
    authTabContainer: {
        flexDirection: 'row',
        marginBottom: 20,
        backgroundColor: '#2A2A2A',
        borderRadius: 12,
        padding: 4
    },
    authTabBtn: {flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10},
    authTabBtnActive: {backgroundColor: '#00BCD4'},
    authTabText: {fontWeight: 'bold', fontSize: 13},
    avatarPickerContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
    },
    avatarPreview: {width: '100%', height: '100%'},
    appInfoContainer: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
        marginTop: 15, paddingHorizontal: 25, paddingVertical: 12, borderRadius: 16, elevation: 1
    },
    appLogo: {width: 38, height: 38, marginRight: 12},
    appInfoTextWrapper: {alignItems: 'flex-start'},
    appName: {fontSize: 15, fontWeight: 'bold'},
    appVersion: {fontSize: 11, marginTop: 1},
    modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20},
    modalContent: {padding: 25, borderRadius: 24, elevation: 5},
    driveModalText: {fontSize: 15, textAlign: 'center', marginBottom: 20, lineHeight: 22},
    modalTitle: {fontSize: 18, fontWeight: 'bold', textAlign: 'center'},
    inputLabel: {fontSize: 12, marginBottom: 5, fontWeight: '600'},
    input: {padding: 12, borderRadius: 10, marginBottom: 15, fontSize: 15, borderWidth: 1},
    modalButtons: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 10},
    btn: {flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', marginHorizontal: 5},
    btnCancel: {},
    btnTextCancel: {fontWeight: 'bold', color: '#F44336'},
    btnTextSave: {fontWeight: 'bold'},
    customAlertBox: {padding: 25, borderRadius: 24, alignItems: 'center', elevation: 10},
    customAlertTitle: {fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 8},
    customAlertMessage: {fontSize: 14, textAlign: 'center', marginBottom: 25, lineHeight: 20},
    alertBtn: {padding: 14, borderRadius: 12, alignItems: 'center'}
});