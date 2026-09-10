const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Soporte obligatorio para archivos .wasm en expo-sqlite (web)
if (!config.resolver.assetExts.includes('wasm')) {
    config.resolver.assetExts.push('wasm');
}

module.exports = config;