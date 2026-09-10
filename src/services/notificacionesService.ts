import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configurar cómo se deben mostrar las notificaciones cuando la app está abierta
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    } as Notifications.NotificationBehavior),
});

// Función principal equivalente a revisarTodasLasFechas
export async function revisarTodasLasFechas() {
    try {
        // 1. Verificar si el usuario tiene activadas las notificaciones
        const notifActivas = await AsyncStorage.getItem('notificaciones_activas');
        if (notifActivas === 'false') {
            console.log("Notificaciones desactivadas por el usuario.");
            return;
        }

        // Solicitar permisos de notificación si es necesario (Android 13+ / iOS)
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            console.log("Permisos de notificación no concedidos.");
            return;
        }

        // 2. Leer las fechas guardadas desde Garage (formato "DD/MM/YYYY")
        const aceiteStr = await AsyncStorage.getItem('aceite_fecha');
        const transStr = await AsyncStorage.getItem('transmision_fecha');
        const seguroStr = await AsyncStorage.getItem('seguro_vencimiento');

        console.log("Fechas obtenidas de Storage -> Aceite:", aceiteStr, "| Transmisión:", transStr, "| Seguro:", seguroStr);

        // 3. Usar Promise.all para asegurarnos de que todas las validaciones corran y se esperen
        await Promise.all([
            verificarYNotificar(aceiteStr, "Aceite de Motor", 1),
            verificarYNotificar(transStr, "Mantenimiento de Transmisión", 2),
            verificarYNotificar(seguroStr, "Renovación de Seguro", 3)
        ]);

    } catch (error) {
        console.error("Error al revisar fechas de mantenimiento:", error);
    }
}

// Función auxiliar equivalente a revisarYNotificar
async function verificarYNotificar(fechaStr: string | null, nombreMantenimiento: string, notificacionId: number) {
    if (!fechaStr || fechaStr.trim() === '') {
        console.log(`No hay fecha configurada para: ${nombreMantenimiento}`);
        return;
    }

    // Limpiar espacios en blanco por si acaso
    const fechaLimpiada = fechaStr.trim();
    const partes = fechaLimpiada.split('/');
    if (partes.length !== 3) {
        console.log(`Formato de fecha inválido para ${nombreMantenimiento}:`, fechaLimpiada);
        return;
    }

    const destino = new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));
    destino.setHours(0, 0, 0, 0);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // Calcular diferencia en días (milisegundos a días)
    const diffMilis = destino.getTime() - hoy.getTime();
    const diasRestantes = Math.round(diffMilis / (1000 * 60 * 60 * 24));

    console.log(`[${nombreMantenimiento}] Fecha destino: ${fechaLimpiada} | Días restantes: ${diasRestantes}`);

    // Si está vencido (negativo), toca hoy (0), o falta 1 día (1)
    if (diasRestantes === 1 || diasRestantes <= 0) {
        let mensaje = "";

        if (diasRestantes < 0) {
            const diasVencidos = Math.abs(diasRestantes);
            mensaje = `¡Peligro! Tu ${nombreMantenimiento} está vencido hace ${diasVencidos} días.`;
        } else if (diasRestantes === 0) {
            mensaje = `¡Atención! Hoy te toca el ${nombreMantenimiento}.`;
        } else {
            mensaje = `¡Preparate! Mañana te toca el ${nombreMantenimiento}.`;
        }

        // Mostrar la notificación localmente en el celular
        await mostrarNotificacionLocal(nombreMantenimiento, mensaje, notificacionId);
    }
}

async function mostrarNotificacionLocal(titulo: string, mensaje: string, id: number) {
    // Configurar canal para Android
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('DriveWalletAlertas', {
            name: 'Alertas de Vehículo',
            importance: Notifications.AndroidImportance.HIGH,
            sound: 'default',
        });
    }

    await Notifications.scheduleNotificationAsync({
        content: {
            title: `DriveWallet: ${titulo}`,
            body: mensaje,
            sound: 'default',
        },
        trigger: null, // Disparar inmediatamente al ejecutar la validación
    });

    console.log(`Notificación enviada con éxito para: ${titulo}`);
}