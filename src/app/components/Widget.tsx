import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

export function QuickAddWidget() {
    return (
        <FlexWidget
            style={{
                height: 'match_parent',
                width: 'match_parent',
                backgroundColor: '#1E1E1E',
                borderRadius: 16,
                padding: 16,
                flexDirection: 'column',
                justifyContent: 'space-between',
            }}
        >
            <TextWidget text="DriveWallet" style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold' }} />

            <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {/* Botón de Ingreso con el Scheme correcto */}
                <FlexWidget
                    clickAction="OPEN_URI"
                    clickActionData={{ uri: 'com.jrdev.drivewallet://add?tipo=INGRESO' }}
                    style={{ backgroundColor: '#4CAF50', borderRadius: 8, padding: 12, flex: 1, marginRight: 8, alignItems: 'center' }}
                >
                    <TextWidget text="+ Ingreso" style={{ color: '#FFF', fontWeight: 'bold' }} />
                </FlexWidget>

                {/* Botón de Gasto con el Scheme correcto */}
                <FlexWidget
                    clickAction="OPEN_URI"
                    clickActionData={{ uri: 'com.jrdev.drivewallet://add?tipo=GASTO' }}
                    style={{ backgroundColor: '#E57373', borderRadius: 8, padding: 12, flex: 1, marginLeft: 8, alignItems: 'center' }}
                >
                    <TextWidget text="- Gasto" style={{ color: '#FFF', fontWeight: 'bold' }} />
                </FlexWidget>
            </FlexWidget>
        </FlexWidget>
    );
}