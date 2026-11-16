# DriveWallet v5.4.32 - Sistema Inteligente de Gestión Financiera y Mantenimiento Vehicular

Plataforma móvil (Android e iOS) desarrollada en React Native con Expo (SDK 57), TypeScript y Expo Router, respaldada por persistencia local offline-first en SQLite, integración con backend Spring Boot (`api-drivewallet`), sincronización en la nube con Google Drive y Widgets nativos para Android.

## 1. Núcleo Global, Seguridad y Autenticación
- **Gestión de Sesión y Perfiles:** Sistema de inicio de sesión y registro rápido de conductores vinculado al backend, con persistencia híbrida en `AsyncStorage`.
- **Seguridad Biométrica:** Bloqueo de seguridad integrado con autenticación local por huella dactilar o PIN (`expo-local-authentication`) antes de cargar las rutas principales.
- **Personalización Visual:** Gestor global de preferencias con soporte nativo y dinámico para Modo Claro y Modo Oscuro (`ThemeContext`).
- **Sistema de Alertas:** Gestor unificado de modales, confirmaciones críticas y notificaciones personalizadas.

## 2. Panel Financiero y Control de Garage (`/(tabs)/index` y `/(tabs)/garage`)
- **Dashboard Financiero:** Cálculo automático y en tiempo real de ingresos, gastos y beneficio neto del mes actual, respaldado por un historial completo de movimientos almacenados en SQLite local.
- **Administración del Vehículo:** Registro y visualización de ficha técnica (tipo, marca, modelo, año, placa y kilometraje actual).
- **Mantenimientos y Obligaciones:** Configuración y control de vencimientos para cambio de aceite (km/fecha), revisión de transmisión, renovación de seguro vehicular, pagos recurrentes (préstamos y tarjetas) y metas de ahorro personalizadas.
- **Rutina de Chequeo Rápido:** Creación en una línea con plantillas de un toque, frecuencias diarias o por día de la semana y seguimiento visual diario de tareas completadas (`ultimoCheck`).

## 3. Sistema Inteligente de Notificaciones Preventivas y Acciones Nativas
- **Alertas de Rutina Automatizadas:** Sincronización de recordatorios preventivos diarios y semanales programados a las 4:00 a. m. (`sincronizarNotificaciones4AM`) en canal de prioridad máxima en Android (`DriveWallet_Max_Channel`).
- **Persistencia en Segundo Plano y Alarmas Exactas:** Configuración nativa con permisos de alarmas exactas (`SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM`, `WAKE_LOCK` y `RECEIVE_BOOT_COMPLETED`) y disparadores `DATE` para garantizar ejecución puntual incluso con la aplicación en estado *killed* (cerrada por completo).
- **Acciones Interactivas en Barra de Notificaciones:** Botones nativos de respuesta rápida (`Marcar Completado` y `Posponer 3h`) con captura de arranque en frío (`verificarNotificacionEnFrio`) y refresco automático de la interfaz mediante `AppState`.

## 4. Asistente IA Multimodal (Texto, Voz y Visión Artificial)
- **Asistente Contextual (`FloatingAIChat`):** Chat flotante inteligente alimentado en vivo con el estado actual del conductor (balance financiero, especificaciones del vehículo, mantenimientos, pagos y metas).
- **Grabador de Voz Inteligente (`GrabadorVozMinimal`):** Interfaz minimalista con visualización de ondas de audio en tiempo real (`expo-audio`) conectada al endpoint `/api/audio` para transcribir dictados complejos y registrar múltiples ingresos o gastos simultáneos en SQLite.
- **Escáner de Facturas por Visión Artificial:** Módulo de captura/galería (`expo-image-picker`) conectado al motor de visión (`/api/vision`) para extraer montos, conceptos y tipos de comprobantes o vouchers, inyectándolos directamente como movimientos financieros.

## 5. Respaldos en la Nube, Widgets y Onboarding
- **Copias de Seguridad en Google Drive:** Respaldo y restauración integral de la base de datos local (`drivewallet_db.db`) y preferencias (`prefs_backup.json`) mediante la API de Google Drive en el espacio privado `appDataFolder`.
- **Widget Nativo Android (`QuickAddWidget`):** Módulo de acceso rápido para la pantalla de inicio desarrollado con `react-native-android-widget`.
- **Onboarding Interactivo (5 Pasos):** Flujo de bienvenida diseñado para guiar al usuario en las funciones clave de la aplicación y gestionar de forma ordenada y contextual los permisos nativos (notificaciones, micrófono y galería/cámara).

## 6. Módulo de Reservas y Servicios Vehiculares (`/reservations`)
- **WIP (Próximamente):** Interfaz y ruta reservada a nivel estructural dentro del proyecto; actualmente en fase de desarrollo sin funcionalidad activa en producción.