import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('drivewallet_db.db');

export interface Movimiento {
    id?: number;
    tipo: 'INGRESO' | 'GASTO';
    categoria: string;
    monto: number;
    fechaTimestamp: number;
    nota?: string;
}

// Nueva función de diagnóstico para ver qué trajo el Backup
export function debugDatabase() {
    try {
        // 1. Ver qué tablas existen realmente en el archivo físico
        const tablas = db.getAllSync(`SELECT name FROM sqlite_master WHERE type='table'`);
        console.log("🗂️ [Autopsia SQLite] Tablas que existen en el archivo descargado:", JSON.stringify(tablas));

        const count: any = db.getFirstSync(`SELECT COUNT(*) as total FROM tabla_movimientos`);
        console.log("🕵️‍♂️ [SQLite] Total de movimientos encontrados en la tabla:", count?.total);

    } catch (error) {
        console.error("❌ [SQLite] Error leyendo la base de datos:", error);
    }
}

export function initDatabase() {
    db.execSync(`
        CREATE TABLE IF NOT EXISTS tabla_movimientos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT NOT NULL,
            categoria TEXT NOT NULL,
            monto REAL NOT NULL,
            fechaTimestamp INTEGER NOT NULL,
            nota TEXT
        );
    `);
}

initDatabase();

export function insertarMovimiento(movimiento: Movimiento) {
    db.runSync(
        `INSERT INTO tabla_movimientos (tipo, categoria, monto, fechaTimestamp, nota) VALUES (?, ?, ?, ?, ?)`,
        [movimiento.tipo, movimiento.categoria, movimiento.monto, movimiento.fechaTimestamp, movimiento.nota || '']
    );
}

export function borrarMovimiento(id: number) {
    db.runSync(`DELETE FROM tabla_movimientos WHERE id = ?`, [id]);
}

export function obtenerUltimosMovimientos(): Movimiento[] {
    return db.getAllSync(
        `SELECT * FROM tabla_movimientos ORDER BY fechaTimestamp DESC LIMIT 5`
    ) as Movimiento[];
}

export function obtenerMovimientosDelMes(inicioDia: number, finDia: number): Movimiento[] {
    return db.getAllSync(
        `SELECT * FROM tabla_movimientos WHERE fechaTimestamp BETWEEN ? AND ? ORDER BY fechaTimestamp DESC`,
        [inicioDia, finDia]
    ) as Movimiento[];
}

export function sumarIngresosDelMes(inicioDia: number, finDia: number): number {
    const result = db.getFirstSync(
        `SELECT SUM(monto) as total FROM tabla_movimientos WHERE tipo = 'INGRESO' AND fechaTimestamp BETWEEN ? AND ?`,
        [inicioDia, finDia]
    ) as { total: number | null } | null;
    return result?.total ?? 0;
}

export function sumarGastosDelMes(inicioDia: number, finDia: number): number {
    const result = db.getFirstSync(
        `SELECT SUM(monto) as total FROM tabla_movimientos WHERE tipo = 'GASTO' AND fechaTimestamp BETWEEN ? AND ?`,
        [inicioDia, finDia]
    ) as { total: number | null } | null;
    return result?.total ?? 0;
}

export function actualizarMovimiento(id: number, tipo: 'INGRESO' | 'GASTO', monto: number, nota: string) {
    db.runSync(
        `UPDATE tabla_movimientos SET tipo = ?, monto = ?, nota = ? WHERE id = ?`,
        [tipo, monto, nota, id]
    );
}

export function insertarMovimientoRapido(tipo: 'INGRESO' | 'GASTO', monto: number, nota: string) {
    const db = SQLite.openDatabaseSync('drivewallet_db.db');
    const timestamp = Date.now();
    // Categoría por defecto rápida según el tipo
    const categoria = tipo === 'INGRESO' ? 'General' : 'Varios';

    db.runSync(
        `INSERT INTO movimientos (tipo, categoria, monto, nota, fechaTimestamp) VALUES (?, ?, ?, ?, ?)`,
        [tipo, categoria, monto, nota, timestamp]
    );
}