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
 * Initialize and get IndexedDB connection with proper upgrade handling
 */
const getDB = async (): Promise<IDBPDatabase> => {
  try {
    let needsUpgrade = false;
    let currentVersion = 1;
    
    // Check if database exists and has the required store
    try {
      const existingDb = await openDB(DB_NAME);
      currentVersion = existingDb.version;
      needsUpgrade = !existingDb.objectStoreNames.contains(STORE_NAME);
      existingDb.close();
      
      console.log(`🔍 Database exists with version ${currentVersion}, needs upgrade: ${needsUpgrade}`);
    } catch {
      // Database doesn't exist
      needsUpgrade = true;
      console.log(`� Database doesn't exist, will create new one`);
    }
    
    // If we need to upgrade, increment version
    if (needsUpgrade) {
      currentVersion = Math.max(currentVersion + 1, 2);
    }
    
    // Open database with proper version and upgrade handling
    const db = await openDB(DB_NAME, currentVersion, {
      upgrade(db, oldVersion, newVersion) {
        console.log(`🔧 Upgrading database from v${oldVersion} to v${newVersion}`);
        
        // Remove existing store if it exists (clean upgrade)
        if (db.objectStoreNames.contains(STORE_NAME)) {
          console.log(`🗑️ Removing existing ${STORE_NAME} store`);
          db.deleteObjectStore(STORE_NAME);
        }
        
        // Create new object store
        console.log(`🔧 Creating object store: ${STORE_NAME}`);
        db.createObjectStore(STORE_NAME);
      },
    });
    
    return db;
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
 * Clear all documents from IndexedDB
 */
export const clearAllFromIndexedDB = async (): Promise<void> => {
  const variants: Array<{ name: string; store: string; viaHelper?: boolean }> = [
    { name: DB_NAME, store: STORE_NAME, viaHelper: true },
    { name: 'DocumentsDB', store: 'documents' },
    { name: 'cutpay-documents', store: 'files' },
    { name: 'fileStorage', store: 'documents' },
  ];

  let primaryError: Error | null = null;

  for (const { name, store, viaHelper } of variants) {
    try {
      const db = viaHelper ? await getDB() : await openDB(name);

      if (!db.objectStoreNames.contains(store)) {
        console.log(`ℹ️ Store ${store} not found in ${name}, skipping.`);
        db.close();
        continue;
      }

      console.log(`🗑️ Clearing store ${store} in ${name}...`);
      const tx = db.transaction(store, 'readwrite');
      await tx.objectStore(store).clear();
      await tx.done;
      db.close();
      console.log(`✅ Cleared store ${store} in ${name}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`❌ Failed clearing store ${store} in ${name}:`, err);
      if (viaHelper && !primaryError) {
        primaryError = err;
      }
    }
  }

  if (primaryError) {
    throw primaryError;
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
