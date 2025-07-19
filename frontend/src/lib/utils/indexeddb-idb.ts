/**
 * Modern IndexedDB utilities using the idb package
 * Centralized functions for all document storage operations
 */

import { openDB, IDBPDatabase } from 'idb';

export interface StoredDocument {
  name: string;
  type: string;
  size: number;
  content: File;
  timestamp: string;
}

const DB_NAME = 'CutPayDB';
const STORE_NAME = 'documents';

/**
 * Initialize and get IndexedDB connection with auto-version detection
 */
const getDB = async (): Promise<IDBPDatabase> => {
  try {
    // First try to open existing database to get current version
    try {
      const existingDb = await openDB(DB_NAME);
      const currentVersion = existingDb.version;
      existingDb.close();
      
      // Open with upgrade if needed
      const db = await openDB(DB_NAME, currentVersion, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            console.log(`🔧 Creating object store: ${STORE_NAME}`);
            db.createObjectStore(STORE_NAME);
          }
        },
      });
      return db;
    } catch {
      // Database doesn't exist, create new one
      const db = await openDB(DB_NAME, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            console.log(`🔧 Creating object store: ${STORE_NAME}`);
            db.createObjectStore(STORE_NAME);
          }
        },
      });
      return db;
    }
  } catch (error) {
    console.error(`❌ Failed to initialize ${DB_NAME}:`, error);
    throw error;
  }
};

/**
 * Save file to IndexedDB with smart key handling
 */
export const saveToIndexedDB = async (file: File, key: string): Promise<void> => {
  try {
    console.log(`📄 Storing ${key} in IndexedDB using idb...`);
    
    const db = await getDB();
    console.log(`🔍 Database version: ${db.version}`);
    console.log(`🔍 Object store names:`, Array.from(db.objectStoreNames));
    
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      console.error(`❌ ${STORE_NAME} store not found in ${DB_NAME}`);
      db.close();
      throw new Error('IndexedDB store not found');
    }

    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    // Debug the object store properties
    console.log(`🔍 Object store keyPath:`, store.keyPath);
    console.log(`🔍 Object store autoIncrement:`, store.autoIncrement);
    
    const documentData: StoredDocument = {
      name: file.name,
      type: file.type,
      size: file.size,
      content: file,
      timestamp: new Date().toISOString()
    };
    
    // Smart key handling based on object store configuration
    if (store.keyPath === null) {
      // Out-of-line keys - key as separate parameter
      await store.put(documentData, key);
    } else {
      // In-line keys - include key as property in the object
      const dataWithKey = {
        ...documentData,
        [store.keyPath as string]: key
      };
      await store.put(dataWithKey);
    }
    
    await tx.done;
    db.close();
    
    console.log(`✅ Successfully stored ${key} in IndexedDB`);
  } catch (error) {
    console.error(`❌ Failed to store ${key} in IndexedDB:`, error);
    throw error;
  }
};

/**
 * Retrieve file from IndexedDB
 */
export const getFromIndexedDB = async (key: string): Promise<StoredDocument | null> => {
  try {
    console.log(`🔍 Retrieving ${key} from IndexedDB...`);
    
    const db = await getDB();
    
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      console.error(`❌ ${STORE_NAME} store not found in ${DB_NAME}`);
      db.close();
      return null;
    }

    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const result = await store.get(key);
    
    await tx.done;
    db.close();
    
    if (result) {
      console.log(`✅ Retrieved ${key} from IndexedDB`);
      return result as StoredDocument;
    } else {
      console.log(`⚠️ ${key} not found in IndexedDB`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Failed to retrieve ${key} from IndexedDB:`, error);
    return null;
  }
};

/**
 * Remove file from IndexedDB
 */
export const removeFromIndexedDB = async (key: string): Promise<void> => {
  try {
    console.log(`🗑️ Removing ${key} from IndexedDB...`);
    
    const db = await getDB();
    
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      console.error(`❌ ${STORE_NAME} store not found in ${DB_NAME}`);
      db.close();
      return;
    }

    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    await store.delete(key);
    await tx.done;
    db.close();
    
    console.log(`✅ Successfully removed ${key} from IndexedDB`);
  } catch (error) {
    console.error(`❌ Failed to remove ${key} from IndexedDB:`, error);
    throw error;
  }
};

/**
 * Get all stored documents from IndexedDB
 */
export const getAllFromIndexedDB = async (): Promise<Array<{ key: string; document: StoredDocument }>> => {
  try {
    console.log(`🔍 Retrieving all documents from IndexedDB...`);
    
    const db = await getDB();
    
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      console.error(`❌ ${STORE_NAME} store not found in ${DB_NAME}`);
      db.close();
      return [];
    }

    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const keys = await store.getAllKeys();
    const values = await store.getAll();
    
    await tx.done;
    db.close();
    
    const documents = keys.map((key, index) => ({
      key: key as string,
      document: values[index] as StoredDocument
    }));
    
    console.log(`✅ Retrieved ${documents.length} documents from IndexedDB`);
    return documents;
  } catch (error) {
    console.error(`❌ Failed to retrieve all documents from IndexedDB:`, error);
    return [];
  }
};

/**
 * Clear all documents from IndexedDB
 */
export const clearAllFromIndexedDB = async (): Promise<void> => {
  try {
    console.log(`🗑️ Clearing all documents from IndexedDB...`);
    
    const db = await getDB();
    
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      console.error(`❌ ${STORE_NAME} store not found in ${DB_NAME}`);
      db.close();
      return;
    }

    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    await store.clear();
    await tx.done;
    db.close();
    
    console.log(`✅ Successfully cleared all documents from IndexedDB`);
  } catch (error) {
    console.error(`❌ Failed to clear all documents from IndexedDB:`, error);
    throw error;
  }
};

/**
 * Debug function to log database structure
 */
export const debugIndexedDB = async (): Promise<void> => {
  try {
    const db = await getDB();
    
    console.log(`🔍 === IndexedDB Debug Info ===`);
    console.log(`Database name: ${db.name}`);
    console.log(`Database version: ${db.version}`);
    console.log(`Object stores:`, Array.from(db.objectStoreNames));
    
    if (db.objectStoreNames.contains(STORE_NAME)) {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const count = await store.count();
      
      console.log(`${STORE_NAME} store details:`);
      console.log(`  - keyPath: ${store.keyPath}`);
      console.log(`  - autoIncrement: ${store.autoIncrement}`);
      console.log(`  - document count: ${count}`);
      
      await tx.done;
    }
    
    db.close();
  } catch (error) {
    console.error(`❌ Failed to debug IndexedDB:`, error);
  }
};
