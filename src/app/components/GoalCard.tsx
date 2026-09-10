import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface GoalCardProps {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    timeLeftText: string;
    percentage: number;
}

export default function GoalCard({ title, icon, timeLeftText, percentage }: GoalCardProps) {
    return (
        <TouchableOpacity style={styles.goalCard}>
            <View style={styles.goalHeader}>
                <View style={styles.iconContainer}>
                    <Ionicons name={icon} size={20} color="#4CAF50" />
                </View>
                <Text style={styles.goalTitle}>{title}</Text>
                <Ionicons name="chevron-forward" size={20} color="#A0A0A0" style={styles.chevron} />
            </View>
            <View style={styles.progressTextContainer}>
                <Text style={styles.progressTextLeft}>{timeLeftText}</Text>
                <Text style={styles.progressTextRight}>{percentage}%</Text>
            </View>
            <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${percentage}%` }]} />
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    goalCard: {
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 20,
        marginBottom: 15,
    },
    goalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    iconContainer: {
        backgroundColor: '#E8F5E9',
        padding: 10,
        borderRadius: 12,
        marginRight: 15,
    },
    goalTitle: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
    },
    chevron: {
        marginLeft: 'auto',
    },
    progressTextContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    progressTextLeft: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    progressTextRight: {
        fontSize: 14,
        color: '#000',
        fontWeight: 'bold',
    },
    progressBarBg: {
        height: 6,
        backgroundColor: 'y#F0F0F0',
        borderRadius: 3,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#FF9800',
        borderRadius: 3,
    },
});