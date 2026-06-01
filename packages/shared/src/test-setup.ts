// Install all fake-indexeddb globals (IDBRequest, IDBKeyRange, IDBFactory, etc.)
// so the idb library works in a Node.js test environment.
import 'fake-indexeddb/auto';
