import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    } as Notifications.NotificationBehavior),
});

export async function revisarTodasLasFechas() {
    try {
        const notifActivas = await AsyncStorage.getItem('app_notifications');
        if (notifActivas === 'false') return;

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        // 1. Mantenimientos de Vehículo
        const aceiteStr = await AsyncStorage.getItem('aceite_fecha');
        const transStr = await AsyncStorage.getItem('transmision_fecha');
        const seguroStr = await AsyncStorage.getItem('seguro_vencimiento');

        const validaciones: Promise<void>[] = [
            verificarYNotificar(aceiteStr, "Aceite de Motor", 1),
            verificarYNotificar(transStr, "Mantenimiento de Transmisión", 2),
            verificarYNotificar(seguroStr, "Renovación de Seguro", 3)
        ];

        // 2. Revisar la Lista Completa de Pagos (Garage)
        const pagosStr = await AsyncStorage.getItem('lista_pagos_pendientes');
        if (pagosStr) {
            const pagos = JSON.parse(pagosStr);
            pagos.forEach((pago: any, index: number) => {
                const tituloPago = pago.banco ? `${pago.tipo} de ${pago.banco}` : pago.tipo;
                // Usamos un ID alto para que no choque con los de mantenimiento
                validaciones.push(verificarYNotificar(pago.fecha, tituloPago, 100 + index));
            });
        }

        // 3. Revisar la Lista Completa de Metas de Ahorro (Home)
        const metasStr = await AsyncStorage.getItem('lista_metas_adicionales');
        if (metasStr) {
            const metas = JSON.parse(metasStr);
            metas.forEach((meta: any, index: number) => {
                validaciones.push(verificarYNotificar(meta.fecha, `Meta: ${meta.titulo}`, 200 + index));
            });
        }

        await Promise.all(validaciones);

    } catch (error) {
        console.error("Error al revisar fechas de mantenimiento y pagos:", error);
    }
}

async function verificarYNotificar(fechaStr: string | null, nombreMantenimiento: string, notificacionId: number) {
    if (!fechaStr || fechaStr.trim() === '') return;

    const fechaLimpiada = fechaStr.trim();
    const partes = fechaLimpiada.split('/');
    if (partes.length !== 3) return;

    const destino = new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));
    destino.setHours(0, 0, 0, 0);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const diffMilis = destino.getTime() - hoy.getTime();
    const diasRestantes = Math.round(diffMilis / (1000 * 60 * 60 * 24));

    if (diasRestantes === 1 || diasRestantes <= 0) {
        let mensaje = "";

        if (diasRestantes < 0) {
            const diasVencidos = Math.abs(diasRestantes);
            mensaje = `¡Atención! Tu ${nombreMantenimiento} está vencido hace ${diasVencidos} días.`;
        } else if (diasRestantes === 0) {
            mensaje = `¡Importante! Hoy es la fecha para: ${nombreMantenimiento}.`;
        } else {
            mensaje = `¡Aviso! Mañana tienes programado: ${nombreMantenimiento}.`;
        }

        await mostrarNotificacionLocal(nombreMantenimiento, mensaje, notificacionId);
    }
}

async function mostrarNotificacionLocal(titulo: string, mensaje: string, id: number) {
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('DriveWalletAlertas', {
            name: 'Alertas Financieras y de Vehículo',
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
        trigger: null,
    });
}