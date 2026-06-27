class InMemoryAtomicKeyValueStore {
  constructor() {
    this.values = new Map();
  }

  setIfAbsent(key, value, ttlMs) {
    const current = this.values.get(key);
    const now = Date.now();
    if (current && current.expiresAt > now) return false;
    this.values.set(key, { value, expiresAt: now + ttlMs });
    return true;
  }

  get(key) {
    const current = this.values.get(key);
    if (!current) return null;
    if (current.expiresAt <= Date.now()) {
      this.values.delete(key);
      return null;
    }
    return current.value;
  }
}

module.exports = { InMemoryAtomicKeyValueStore };
