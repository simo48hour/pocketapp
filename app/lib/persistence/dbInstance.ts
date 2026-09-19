import { openDatabase } from './db';

const persistenceEnabled = !import.meta.env.VITE_DISABLE_PERSISTENCE;

export const db: IDBDatabase | undefined = persistenceEnabled ? await openDatabase() : undefined;
