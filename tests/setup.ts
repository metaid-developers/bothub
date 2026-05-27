import '@testing-library/jest-dom/vitest'

const localStore = new Map<string, string>()

const localStorageMock: Storage = {
  getItem: (key) => localStore.get(key) ?? null,
  setItem: (key, value) => {
    localStore.set(key, value)
  },
  removeItem: (key) => {
    localStore.delete(key)
  },
  clear: () => localStore.clear(),
  key: (index) => Array.from(localStore.keys())[index] ?? null,
  get length() {
    return localStore.size
  },
}

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
})

const sessionStore = new Map<string, string>()

const sessionStorageMock: Storage = {
  getItem: (key) => sessionStore.get(key) ?? null,
  setItem: (key, value) => {
    sessionStore.set(key, value)
  },
  removeItem: (key) => {
    sessionStore.delete(key)
  },
  clear: () => sessionStore.clear(),
  key: (index) => Array.from(sessionStore.keys())[index] ?? null,
  get length() {
    return sessionStore.size
  },
}

Object.defineProperty(globalThis, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
  configurable: true,
})

export function clearTestLocalStorage() {
  localStore.clear()
}

export function clearTestSessionStorage() {
  sessionStore.clear()
}
