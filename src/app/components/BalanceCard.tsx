import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import QuickActions from './QuickActions';
import { useTheme } from '@/context/ThemeContext';

interface BalanceCardProps {
    amount: string;
    onMovimientoGuardado?: () => void; // Función para actualizar los datos al registrar un ingreso/gasto
}

export default function BalanceCard({ amount, onMovimientoGuardado }: BalanceCardProps) {
    const { darkMode } = useTheme();

    return (
        <View style={[
            styles.balanceCard,
            {
                backgroundColor: darkMode ? '#1A1A1A' : '#1E1E1E',
                shadowOpacity: darkMode ? 0.5 : 0.2
            }
        ]}>
            <Text style={styles.balanceLabel}>Ingresos del Mes</Text>
            <Text style={styles.balanceAmount}>{amount}</Text>

            {/* Pasamos el evento hacia QuickActions para que actualice la app al guardar */}
            <QuickActions onMovimientoGuardado={onMovimientoGuardado} />
        </View>
    );
}

const styles = StyleSheet.create({
    balanceCard: {
        borderRadius: 24,
        padding: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 15,
        elevation: 8,
        marginVertical: 10,
    },
    balanceLabel: {
        color: '#A0A0A0',
        fontSize: 14,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    balanceAmount: {
        color: '#FFF',
        fontSize: 36,
        fontWeight: 'bold',
        textAlign: 'center',
        marginVertical: 10,
    },
});