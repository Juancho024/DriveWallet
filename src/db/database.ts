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

export function debugDatabase() {
    try {
        const tablas = db.getAllSync(`SELECT name FROM sqlite_master WHERE type='table'`);
        console.log("🗂️ [Autopsia SQLite] Tablas que existen en el archivo descargado:", JSON.stringify(tablas));

        const count: any = db.getFirstSync(`SELECT COUNT(*) as total FROM tabla_movimientos`);
        console.log("🕵️‍♂️ [SQLite] Total de movimientos encontrados en la tabla:", count?.total);
    } catch (error) {
        console.error("❌ [SQLite] Error leyendo la base de datos:", error);
    }
}

export function initDatabase() {
    try {
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
    } catch(e) {
        console.log("Error creando tabla:", e);
    }
}

initDatabase();

export function insertarMovimiento(movimiento: Movimiento) {
    const montoSeguro = isNaN(Number(movimiento.monto)) ? 0 : Number(movimiento.monto);
    db.runSync(
        `INSERT INTO tabla_movimientos (tipo, categoria, monto, fechaTimestamp, nota) VALUES (?, ?, ?, ?, ?)`,
        [movimiento.tipo, movimiento.categoria, montoSeguro, movimiento.fechaTimestamp, movimiento.nota || '']
    );
}

export function borrarMovimiento(id: number) {
    db.runSync(`DELETE FROM tabla_movimientos WHERE id = ?`, [id]);
}

export function obtenerUltimosMovimientos(): Movimiento[] {
    try {
        return db.getAllSync(`SELECT * FROM tabla_movimientos ORDER BY fechaTimestamp DESC LIMIT 5`) as Movimiento[];
    } catch(e) { return []; }
}

export function obtenerMovimientosDelMes(inicioDia: number, finDia: number): Movimiento[] {
    try {
        return db.getAllSync(
            `SELECT * FROM tabla_movimientos WHERE fechaTimestamp BETWEEN ? AND ? ORDER BY fechaTimestamp DESC`,
            [inicioDia, finDia]
        ) as Movimiento[];
    } catch(e) { return []; }
}

export function sumarIngresosDelMes(inicioDia: number, finDia: number): number {
    try {
        const result = db.getFirstSync(
            `SELECT SUM(monto) as total FROM tabla_movimientos WHERE tipo = 'INGRESO' AND fechaTimestamp BETWEEN ? AND ?`,
            [inicioDia, finDia]
        ) as { total: number | null } | null;
        return result?.total ?? 0;
    } catch(e) { return 0; }
}

export function sumarGastosDelMes(inicioDia: number, finDia: number): number {
    try {
        const result = db.getFirstSync(
            `SELECT SUM(monto) as total FROM tabla_movimientos WHERE tipo = 'GASTO' AND fechaTimestamp BETWEEN ? AND ?`,
            [inicioDia, finDia]
        ) as { total: number | null } | null;
        return result?.total ?? 0;
    } catch(e) { return 0; }
}

export function actualizarMovimiento(id: number, tipo: 'INGRESO' | 'GASTO', monto: number, nota: string) {
    const montoSeguro = isNaN(Number(monto)) ? 0 : Number(monto);
    db.runSync(
        `UPDATE tabla_movimientos SET tipo = ?, monto = ?, nota = ? WHERE id = ?`,
        [tipo, montoSeguro, nota || '', id]
    );
}

export function insertarMovimientoRapido(tipo: 'INGRESO' | 'GASTO', monto: number, nota: string) {
    const timestamp = Date.now();
    const categoria = tipo === 'INGRESO' ? 'General' : 'Varios';

    // 🔥 PROTECCIÓN EXTREMA: Evita que entre un NaN o un Null a SQLite
    const montoSeguro = (monto === null || monto === undefined || isNaN(Number(monto))) ? 0 : Number(monto);
    const notaSegura = nota ? String(nota) : '';

    try {
        db.runSync(
            `INSERT INTO tabla_movimientos (tipo, categoria, monto, nota, fechaTimestamp) VALUES (?, ?, ?, ?, ?)`,
            [tipo, categoria, montoSeguro, notaSegura, timestamp]
        );
    } catch (error) {
        console.log("Error insertando movimiento rápido:", error);
    }
}

export function forzarCheckpointDB() {
    try {
        db.execSync('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch (error) {}
}