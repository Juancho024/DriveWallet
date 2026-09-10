import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeContextType {
    darkMode: boolean;
    toggleDarkMode: (value?: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType>({
    darkMode: true, // Lo dejamos en true por defecto para evitar pantallas blancas de golpe en dispositivos oscuros
    toggleDarkMode: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [darkMode, setDarkMode] = useState(true);

    useEffect(() => {
        const cargarTema = async () => {
            try {
                const savedTheme = await AsyncStorage.getItem('app_dark_mode');
                if (savedTheme !== null) {
                    setDarkMode(savedTheme === 'true');
                }
            } catch (error) {
                console.error("Error al cargar el modo oscuro:", error);
            }
        };
        cargarTema();
    }, []);

    const toggleDarkMode = async (value?: boolean) => {
        const nuevoEstado = value !== undefined ? value : !darkMode;
        setDarkMode(nuevoEstado);
        try {
            await AsyncStorage.setItem('app_dark_mode', nuevoEstado.toString());
        } catch (error) {
            console.error("Error al guardar el modo oscuro:", error);
        }
    };

    return (
        <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);