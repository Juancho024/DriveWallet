import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export interface RecordatorioGarage {
    id: string;
    titulo: string;
    frecuencia: string; // 'DIARIO' o '0' (Dom) a '6' (Sáb)
    ultimoCheck?: string; // YYYY-MM-DD
    pospuestoHasta?: number; // timestamp en ms
}

export async function inicializarAccionesNotificacion() {
    await Notifications.setNotificationCategoryAsync('GARAGE_ACTIONS', [
        {
            identifier: 'ACCION_COMPLETAR',
            buttonTitle: 'Marcar Completado',
            options: { opensAppToForeground: true },
        },
        {
            identifier: 'ACCION_POSPONER',
            buttonTitle: 'Posponer 3h',
            options: { opensAppToForeground: true },
        },
    ]);
}

async function asegurarCanalAndroid() {
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('DriveWallet_Max_Channel', {
            name: 'Alertas Financieras y de Vehículo',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#00BCD4',
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            bypassDnd: true,
        });
    }
    await inicializarAccionesNotificacion();
}

// 🔥 PROGRAMA LOS MANTENIMIENTOS EN EL RELOJ DE ANDROID (Funciona con la app muerta)
export async function revisarTodasLasFechas() {
    try {
        const notifActivas = await AsyncStorage.getItem('app_notifications');
        if (notifActivas === 'false') return;

        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;

        await asegurarCanalAndroid();

        const aceiteStr = await AsyncStorage.getItem('aceite_fecha');
        const transStr = await AsyncStorage.getItem('transmision_fecha');
        const seguroStr = await AsyncStorage.getItem('seguro_vencimiento');

        await programarAlertaMantenimiento(aceiteStr, "Aceite de Motor", "mant_aceite");
        await programarAlertaMantenimiento(transStr, "Mantenimiento de Transmisión", "mant_transmision");
        await programarAlertaMantenimiento(seguroStr, "Renovación de Seguro", "mant_seguro");
    } catch (error) {
        console.error("Error al programar fechas de mantenimiento:", error);
    }
}

async function programarAlertaMantenimiento(fechaStr: string | null, nombreMantenimiento: string, notifId: string) {
    await Notifications.cancelScheduledNotificationAsync(notifId);
    if (!fechaStr || fechaStr.trim() === '') return;

    const partes = fechaStr.trim().split('/');
    if (partes.length !== 3) return;

    // Programamos para las 8:00 AM del día del vencimiento
    const fechaDisparo = new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]), 8, 0, 0);

    // Si la fecha es hoy pero ya pasaron las 8:00 AM, o si ya pasó, no agendamos en el pasado
    if (fechaDisparo.getTime() <= Date.now()) return;

    await Notifications.scheduleNotificationAsync({
        identifier: notifId,
        content: {
            title: `🚨 DriveWallet: ${nombreMantenimiento}`,
            body: `¡Importante! Hoy es la fecha límite para: ${nombreMantenimiento}.`,
            priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            channelId: 'DriveWallet_Max_Channel',
            date: fechaDisparo,
        },
    });
}

export async function sincronizarNotificaciones4AM(listaManual?: RecordatorioGarage[]) {
    try {
        const agendadasPrevias = await Notifications.getAllScheduledNotificationsAsync();
        for (const notif of agendadasPrevias) {
            if (notif.identifier.startsWith('garage_4am_')) {
                await Notifications.cancelScheduledNotificationAsync(notif.identifier);
            }
        }

        const notifActivas = await AsyncStorage.getItem('app_notifications');
        if (notifActivas === 'false') return;

        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;

        await asegurarCanalAndroid();

        let lista: RecordatorioGarage[] = [];
        if (listaManual) {
            lista = listaManual;
        } else {
            const stored = await AsyncStorage.getItem('lista_recordatorios_garage');
            lista = stored ? JSON.parse(stored) : [];
        }

        if (lista.length === 0) return;

        // ⏰ HORA DE DISPARO (4:00 AM)
        const HORA_PROGRAMADA = 4;
        const MINUTO_PROGRAMADO = 0;

        const tareasDiarias = lista.filter(r => r.frecuencia === 'DIARIO');
        for (const tarea of tareasDiarias) {
            await Notifications.scheduleNotificationAsync({
                identifier: `garage_4am_diario_${tarea.id}`,
                content: {
                    title: '🚗 Rutina Preventiva - DriveWallet',
                    body: `Hoy toca revisar: ${tarea.titulo}.`,
                    categoryIdentifier: 'GARAGE_ACTIONS',
                    priority: Notifications.AndroidNotificationPriority.MAX,
                    data: { recordatorioId: tarea.id }
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DAILY,
                    channelId: 'DriveWallet_Max_Channel',
                    hour: HORA_PROGRAMADA,
                    minute: MINUTO_PROGRAMADO,
                },
            });
        }

        for (let d = 0; d <= 6; d++) {
            const tareasDelDia = lista.filter(r => r.frecuencia !== 'DIARIO' && Number(r.frecuencia) === d);
            for (const tarea of tareasDelDia) {
                const expoWeekday = d + 1;
                await Notifications.scheduleNotificationAsync({
                    identifier: `garage_4am_day_${d}_${tarea.id}`,
                    content: {
                        title: '🚗 Rutina Preventiva - DriveWallet',
                        body: `Hoy toca revisar: ${tarea.titulo}.`,
                        categoryIdentifier: 'GARAGE_ACTIONS',
                        priority: Notifications.AndroidNotificationPriority.MAX,
                        data: { recordatorioId: tarea.id }
                    },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                        channelId: 'DriveWallet_Max_Channel',
                        weekday: expoWeekday,
                        hour: HORA_PROGRAMADA,
                        minute: MINUTO_PROGRAMADO,
                    },
                });
            }
        }

        const agendadas = await Notifications.getAllScheduledNotificationsAsync();
        console.log(`✅ [DriveWallet] ${agendadas.length} alarmas registradas en Android.`);
    } catch (e) {
        console.error("Error sincronizando alertas:", e);
    }
}

export async function programarNotificacionPospuesta(tituloRecordatorio: string, horas: number = 3, recordatorioId?: string) {
    try {
        const notifActivas = await AsyncStorage.getItem('app_notifications');
        if (notifActivas === 'false') return;

        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;

        await asegurarCanalAndroid();

        // 🛠️ PRUEBA: 60 segundos (1 min). Para producción pon: horas * 3600
        const segundosSnooze = horas * 3600;
        const fechaExactaDisparo = new Date(Date.now() + segundosSnooze * 1000);

        await Notifications.scheduleNotificationAsync({
            identifier: `snooze_${recordatorioId || Date.now()}`,
            content: {
                title: '⏳ Chequeo Pospuesto - DriveWallet',
                body: `Te recordamos revisar: "${tituloRecordatorio}".`,
                categoryIdentifier: 'GARAGE_ACTIONS',
                priority: Notifications.AndroidNotificationPriority.MAX,
                data: { recordatorioId }
            },
            // 🔥 DATE obliga a Android a usar alarma exacta de reloj (despierta el CPU aunque la app muera)
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                channelId: 'DriveWallet_Max_Channel',
                date: fechaExactaDisparo,
            },
        });

        console.log(`⏳ Alarma pospuesta agendada para: ${fechaExactaDisparo.toLocaleTimeString()}`);
    } catch (e) {
        console.error("Error programando alerta pospuesta:", e);
    }
}

let ultimaNotifProcesada: string | null = null;

async function ejecutarAccionDeGarage(actionId: string, notifId: string, recordatorioId?: string) {
    if (actionId === 'ACCION_COMPLETAR' || actionId === 'ACCION_POSPONER') {
        // Evita que el listener en frío y el listener en vivo dupliquen la acción
        const claveUnica = `${notifId}_${actionId}`;
        if (ultimaNotifProcesada === claveUnica) return;
        ultimaNotifProcesada = claveUnica;

        await Notifications.dismissNotificationAsync(notifId);

        const hoy = new Date();
        const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
        const stored = await AsyncStorage.getItem('lista_recordatorios_garage');
        if (!stored) return;

        const lista: RecordatorioGarage[] = JSON.parse(stored);

        const nuevaLista = lista.map(r => {
            if (recordatorioId && r.id === recordatorioId) {
                if (actionId === 'ACCION_COMPLETAR') {
                    return { ...r, ultimoCheck: hoyStr, pospuestoHasta: undefined };
                } else if (actionId === 'ACCION_POSPONER') {
                    const tresHorasMs = Date.now() + (3 * 3600 * 1000);
                    return { ...r, pospuestoHasta: tresHorasMs };
                }
            }
            return r;
        });

        await AsyncStorage.setItem('lista_recordatorios_garage', JSON.stringify(nuevaLista));

        if (actionId === 'ACCION_POSPONER') {
            const tarea = lista.find(t => t.id === recordatorioId);
            const titulo = tarea ? tarea.titulo : 'tu chequeo pendiente';
            await programarNotificacionPospuesta(titulo, 3, recordatorioId);
        }
    }
}

export function configurarEscuchaAccionesNotificacion() {
    return Notifications.addNotificationResponseReceivedListener(async response => {
        const actionId = response.actionIdentifier;
        const notifId = response.notification.request.identifier;
        const recordatorioId = response.notification.request.content.data?.recordatorioId as string | undefined;

        await ejecutarAccionDeGarage(actionId, notifId, recordatorioId);
    });
}

export async function verificarNotificacionEnFrio() {
    try {
        const response = await Notifications.getLastNotificationResponseAsync();
        if (response && response.actionIdentifier) {
            const actionId = response.actionIdentifier;
            const notifId = response.notification.request.identifier;
            const recordatorioId = response.notification.request.content.data?.recordatorioId as string | undefined;

            await ejecutarAccionDeGarage(actionId, notifId, recordatorioId);
        }
    } catch (e) {
        console.error("Error atrapando notificación en frío:", e);
    }
}