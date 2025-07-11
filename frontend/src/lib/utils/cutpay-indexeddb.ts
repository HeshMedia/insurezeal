// IndexedDB utility for storing cutpay documents locally
const DB_NAME = 'CutPayDB'
const DB_VERSION = 1
const DOCUMENTS_STORE = 'documents'

interface StoredDocument {
  id: string
  file: File
  url: string
  type: 'policy_pdf' | 'kyc_documents' | 'rc_document' | 'previous_policy'
  timestamp: number
}

class CutPayIndexedDB {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        if (!db.objectStoreNames.contains(DOCUMENTS_STORE)) {
          const store = db.createObjectStore(DOCUMENTS_STORE, { keyPath: 'id' })
          store.createIndex('type', 'type', { unique: false })
          store.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })
  }

  async storeDocument(file: File, type: StoredDocument['type']): Promise<string> {
    if (!this.db) await this.init()
    
    const url = URL.createObjectURL(file)
    const document: StoredDocument = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      file,
      url,
      type,
      timestamp: Date.now()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([DOCUMENTS_STORE], 'readwrite')
      const store = transaction.objectStore(DOCUMENTS_STORE)
      const request = store.put(document)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(url)
      
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async getDocument(id: string): Promise<StoredDocument | null> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([DOCUMENTS_STORE], 'readonly')
      const store = transaction.objectStore(DOCUMENTS_STORE)
      const request = store.get(id)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || null)
    })
  }

  async getDocumentsByType(type: StoredDocument['type']): Promise<StoredDocument[]> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([DOCUMENTS_STORE], 'readonly')
      const store = transaction.objectStore(DOCUMENTS_STORE)
      const index = store.index('type')
      const request = index.getAll(type)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  async deleteDocument(id: string): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([DOCUMENTS_STORE], 'readwrite')
      const store = transaction.objectStore(DOCUMENTS_STORE)
      const request = store.delete(id)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async clearAll(): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([DOCUMENTS_STORE], 'readwrite')
      const store = transaction.objectStore(DOCUMENTS_STORE)
      const request = store.clear()
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }
}

export const cutpayDB = new CutPayIndexedDB()

// Helper functions for easier usage
export const storeDocumentInDB = async (file: File, type: StoredDocument['type']): Promise<string> => {
  try {
    const url = await cutpayDB.storeDocument(file, type)
    console.log(`✅ Document stored in IndexedDB:`, { type, filename: file.name, url })
    return url
  } catch (error) {
    console.error(`❌ Failed to store document in IndexedDB:`, { type, filename: file.name, error })
    throw error
  }
}

export const getDocumentFromDB = async (id: string): Promise<StoredDocument | null> => {
  try {
    const document = await cutpayDB.getDocument(id)
    console.log(`📄 Retrieved document from IndexedDB:`, { id, found: !!document })
    return document
  } catch (error) {
    console.error(`❌ Failed to retrieve document from IndexedDB:`, { id, error })
    throw error
  }
}

export const clearCutPayDocuments = async (): Promise<void> => {
  try {
    await cutpayDB.clearAll()
    console.log(`🗑️ Cleared all cutpay documents from IndexedDB`)
  } catch (error) {
    console.error(`❌ Failed to clear cutpay documents:`, error)
    throw error
  }
}
