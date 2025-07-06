// IndexedDB utility functions for CutPay document management

export interface StoredDocument {
  key: string;
  name: string;
  size: number;
  type: string;
  content: ArrayBuffer; // Store as ArrayBuffer for better compatibility
  timestamp: string;
}

const DB_NAME = 'CutPayDB';
const DB_VERSION = 3; // Increment version to force schema update
const STORE_NAME = 'documents';

// Open IndexedDB connection
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(new Error('Failed to open IndexedDB'));
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Clear existing stores if they exist (for clean upgrade)
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      
      // Create new object store
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      
      // Create indexes for better querying
      store.createIndex('timestamp', 'timestamp', { unique: false });
      store.createIndex('type', 'type', { unique: false });
      
      console.log('✅ IndexedDB schema upgraded to version', DB_VERSION);
    };
    
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      console.log('✅ IndexedDB opened successfully');
      resolve(db);
    };
  });
};

// Store file in IndexedDB
export const storeFileInIndexedDB = async (file: File, key: string): Promise<void> => {
  console.log(`📄 Storing file in IndexedDB:`, { key, name: file.name, size: file.size });
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        const db = await openDB();
        
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const fileData: StoredDocument = {
          key,
          name: file.name,
          size: file.size,
          type: file.type,
          content: arrayBuffer,
          timestamp: new Date().toISOString()
        };
        
        const request = store.put(fileData);
        
        request.onsuccess = () => {
          console.log(`✅ File stored successfully:`, key);
          resolve();
        };
        
        request.onerror = () => {
          console.error('❌ Failed to store file:', request.error);
          reject(new Error('Failed to store file'));
        };
        
        transaction.onerror = () => {
          console.error('❌ Transaction error:', transaction.error);
          reject(new Error('Transaction failed'));
        };
        
      } catch (error) {
        console.error('❌ Error in store operation:', error);
        reject(error);
      }
    };
    
    reader.onerror = () => {
      console.error('❌ Failed to read file');
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
};

// Retrieve file from IndexedDB
export const getFileFromIndexedDB = async (key: string): Promise<StoredDocument | null> => {
  console.log(`📄 Retrieving file from IndexedDB:`, key);
  
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          console.log(`✅ File retrieved successfully:`, key);
        } else {
          console.log(`📭 File not found:`, key);
        }
        resolve(result || null);
      };
      
      request.onerror = () => {
        console.error('❌ Failed to retrieve file:', request.error);
        reject(new Error('Failed to retrieve file'));
      };
    });
  } catch (error) {
    console.error('❌ Error retrieving file:', error);
    throw error;
  }
};

// Get all stored documents
export const getAllStoredDocuments = async (): Promise<StoredDocument[]> => {
  console.log('📂 Retrieving all documents from IndexedDB');
  
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        const results = request.result || [];
        console.log(`📂 Retrieved ${results.length} documents from IndexedDB`);
        resolve(results);
      };
      
      request.onerror = () => {
        console.error('❌ Failed to retrieve documents:', request.error);
        reject(new Error('Failed to retrieve documents'));
      };
    });
  } catch (error) {
    console.error('❌ Error retrieving documents:', error);
    throw error;
  }
};

// Remove file from IndexedDB (renamed for consistency)
export const removeFileFromIndexedDB = async (key: string): Promise<void> => {
  console.log(`🗑️ Removing file from IndexedDB:`, key);
  
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.delete(key);
      
      request.onsuccess = () => {
        console.log(`✅ File removed successfully:`, key);
        resolve();
      };
      
      request.onerror = () => {
        console.error('❌ Failed to remove file:', request.error);
        reject(new Error('Failed to remove file'));
      };
    });
  } catch (error) {
    console.error('❌ Error removing file:', error);
    throw error;
  }
};

// Delete file from IndexedDB (alias for backward compatibility)
export const deleteFileFromIndexedDB = removeFileFromIndexedDB;

// Convert ArrayBuffer back to File object
export const arrayBufferToFile = (arrayBuffer: ArrayBuffer, name: string, type: string): File => {
  return new File([arrayBuffer], name, { type });
};

// Clear all documents
export const clearAllDocuments = async (): Promise<void> => {
  console.log('🗑️ Clearing all documents from IndexedDB');
  
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.clear();
      
      request.onsuccess = () => {
        console.log('✅ All documents cleared from IndexedDB');
        resolve();
      };
      
      request.onerror = () => {
        console.error('❌ Failed to clear documents:', request.error);
        reject(new Error('Failed to clear documents'));
      };
    });
  } catch (error) {
    console.error('❌ Error clearing documents:', error);
    throw error;
  }
};

// Debug function to log all stored documents
export const debugIndexedDB = async (): Promise<void> => {
  try {
    console.log('🔍 Debugging IndexedDB...');
    const documents = await getAllStoredDocuments();
    
    console.log('📂 IndexedDB Debug Information:');
    console.log('Database Name:', DB_NAME);
    console.log('Database Version:', DB_VERSION);
    console.log('Store Name:', STORE_NAME);
    console.log('Total Documents:', documents.length);
    
    if (documents.length === 0) {
      console.log('📭 No documents stored in IndexedDB');
    } else {
      documents.forEach((doc, index) => {
        console.log(`📄 Document ${index + 1}:`, {
          key: doc.key,
          name: doc.name,
          size: `${(doc.size / 1024 / 1024).toFixed(2)}MB`,
          type: doc.type,
          timestamp: doc.timestamp,
          hasContent: !!doc.content
        });
      });
    }
    
    // Also check storage quota
    await checkStorageQuota();
    
  } catch (error) {
    console.error('❌ Error debugging IndexedDB:', error);
  }
};

// Check IndexedDB storage quota
export const checkStorageQuota = async (): Promise<void> => {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || 0;
      
      console.log('💾 Storage Usage:', {
        used: `${(used / 1024 / 1024).toFixed(2)}MB`,
        quota: `${(quota / 1024 / 1024).toFixed(2)}MB`,
        percentage: `${((used / quota) * 100).toFixed(2)}%`
      });
    } catch (error) {
      console.error('❌ Error checking storage quota:', error);
    }
  } else {
    console.log('⚠️ Storage quota API not supported');
  }
};

// Initialize IndexedDB (call this once when your app starts)
export const initializeIndexedDB = async (): Promise<void> => {
  try {
    await openDB();
    console.log('✅ IndexedDB initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize IndexedDB:', error);
    throw error;
  }
};
