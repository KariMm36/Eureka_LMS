import NodeCache from 'node-cache';

// Standard cache with 1 hour default TTL (Time-To-Live)
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

export const CacheUtil = {
  get: (key) => cache.get(key),
  set: (key, value, ttl = 3600) => cache.set(key, value, ttl),
  del: (key) => cache.del(key),
  flush: () => cache.flushAll(),
};
