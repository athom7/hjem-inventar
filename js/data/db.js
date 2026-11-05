// The only module that touches IndexedDB. Two stores: "doc" holds the whole inventory as one record,
// "images" holds the floor-plan images as Blobs (kept out of the document so it stays small and fast to save).

const DB_NAME = 'hjem-inventar';
const DB_VERSION = 1;
const DOC_KEY = 'main';

let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('doc')) db.createObjectStore('doc');
        if (!db.objectStoreNames.contains('images')) db.createObjectStore('images');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Databasen er låst af en anden fane. Luk andre faner med appen.'));
    });
  }
  return dbPromise;
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Gemning blev afbrudt.'));
  });
}

export const loadDoc = () => run('doc', 'readonly', (s) => s.get(DOC_KEY));
export const saveDoc = (doc) => run('doc', 'readwrite', (s) => s.put(doc, DOC_KEY));

export const getImage = (id) => run('images', 'readonly', (s) => s.get(id));
export const putImage = (id, blob) => run('images', 'readwrite', (s) => s.put(blob, id));
export const deleteImage = (id) => run('images', 'readwrite', (s) => s.delete(id));
export const clearImages = () => run('images', 'readwrite', (s) => s.clear());

// Ask the browser not to evict our data under storage pressure. Returns whether storage is persistent.
export async function requestPersist() {
  try {
    if (await navigator.storage?.persisted?.()) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export async function isPersisted() {
  try {
    return (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    return false;
  }
}
