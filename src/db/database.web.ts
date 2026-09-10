export interface Movimiento {
    id?: number;
    tipo: 'INGRESO' | 'GASTO';
    categoria: string;
    monto: number;
    fechaTimestamp: number;
    nota?: string;
}

export function initDatabase() {}
export function insertarMovimiento(movimiento: Movimiento) {}
export function borrarMovimiento(id: number) {}
export function obtenerUltimosMovimientos(): Movimiento[] { return []; }
export function obtenerMovimientosDelMes(inicioDia: number, finDia: number): Movimiento[] { return []; }
export function sumarIngresosDelMes(inicioDia: number, finDia: number): number { return 0; }
export function sumarGastosDelMes(inicioDia: number, finDia: number): number { return 0; }
export function actualizarMovimiento(id: number, tipo: 'INGRESO' | 'GASTO', monto: number, nota: string) {}