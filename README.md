# 🚗 DriveWallet

![Android](https://img.shields.io/badge/Android-3DDC84?style=for-the-badge&logo=android&logoColor=white)
![Java](https://img.shields.io/badge/Java-ED8B00?style=for-the-badge&logo=java&logoColor=white)
![Google Drive API](https://img.shields.io/badge/Google_Drive_API-4285F4?style=for-the-badge&logo=google-drive&logoColor=white)
![Room Database](https://img.shields.io/badge/Room_Database-0081CB?style=for-the-badge&logo=sqlite&logoColor=white)

**DriveWallet** es el copiloto definitivo para conductores. Una aplicación móvil nativa diseñada para gestionar las finanzas diarias (ingresos, gastos y cuadres) y llevar un control inteligente del mantenimiento del vehículo, garantizando que los datos nunca se pierdan gracias a sus copias de seguridad en la nube.

---

## ✨ Características Principales

* 💰 **Gestión Financiera**: Registro detallado de viajes, ingresos diarios y gastos operativos.
* 🛠️ **Mi Garage**: Perfil del vehículo para monitorear marca, modelo y kilometraje actual.
* 🔔 **Alertas Inteligentes**: Sistema de notificaciones en segundo plano que avisa automáticamente sobre el vencimiento del seguro, cambio de aceite y mantenimiento de transmisión.
* ☁️ **Backup en la Nube (Estilo WhatsApp)**: Integración con la API de Google Drive para crear copias de seguridad silenciosas. Los datos se guardan en la bóveda oculta (`appDataFolder`) del usuario para máxima seguridad.
* 📄 **Reportes Profesionales**: Generación y exportación de reportes y cuadres en formato PDF.

---

## 📸 Capturas de Pantalla

> *(Nota para el desarrollador: Aquí puedes arrastrar y soltar 3 o 4 imágenes de tu app funcionando, como la pantalla principal, el garage y la configuración).*

<p align="center">
  <img src="URL_DE_TU_IMAGEN_1" width="250" />
  <img src="URL_DE_TU_IMAGEN_2" width="250" />
  <img src="URL_DE_TU_IMAGEN_3" width="250" />
</p>

---

## 🛠️ Stack Tecnológico

La aplicación fue desarrollada utilizando herramientas y librerías modernas del ecosistema Android:

* **Lenguaje**: Java (JDK 21)
* **Arquitectura de UI**: XML, ViewBinding, Material Design Components
* **Base de Datos Local**: [Room Database](https://developer.android.com/training/data-storage/room)
* **Trabajos en Segundo Plano**: [WorkManager](https://developer.android.com/topic/libraries/architecture/workmanager)
* **Nube y Autenticación**: Google SignIn API & Google Drive REST API v3
* **Generación de Archivos**: iTextPDF
* **Otras Librerías**: ZXing (Códigos de Barras), Glide (Carga de imágenes)

---

## 🚀 Instalación y Configuración

Si deseas clonar y correr este proyecto en tu máquina local:

1. Clona el repositorio:
   ```bash
   git clone [https://github.com/TU_USUARIO/DriveWallet.git](https://github.com/TU_USUARIO/DriveWallet.git)
