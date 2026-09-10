import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
    const { darkMode } = useTheme();
    const insets = useSafeAreaInsets();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: [
                    styles.tabBar,
                    {
                        backgroundColor: darkMode ? '#1E1E1E' : '#ffffff',
                        bottom: Math.max(insets.bottom + 10, 15),
                    }
                ],
                tabBarShowLabel: false,
                tabBarActiveTintColor: darkMode ? '#ffffff' : '#000000',
                tabBarInactiveTintColor: darkMode ? '#888888' : '#A0A0A0',
                tabBarItemStyle: {
                    height: 55,
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingTop: 8, // <--- ESTO BAJA LOS ÍCONOS EXACTAMENTE UN CHIN AL CENTRO VISUAL
                },
            }}>
            <Tabs.Screen
                name="index"
                options={{
                    tabBarIcon: ({ color }) => <Ionicons name="home" size={26} color={color} />,
                }}
            />
            <Tabs.Screen
                name="statistics"
                options={{
                    tabBarIcon: ({ color }) => <Ionicons name="pie-chart" size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="garage"
                options={{
                    tabBarIcon: ({ color }) => <Ionicons name="car" size={28} color={color} />,
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    tabBarIcon: ({ color }) => <Ionicons name="settings" size={26} color={color} />,
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        position: 'absolute',
        marginHorizontal: 60,
        left: 0,
        right: 0,
        elevation: 5,
        borderRadius: 28,
        height: 55,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        borderTopWidth: 0,
    }
});