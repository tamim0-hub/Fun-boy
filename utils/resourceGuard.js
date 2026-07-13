const v8 = require('v8');

const MB = 1024 * 1024;
const DEFAULT_RSS_LIMIT_MB = 460;
const DEFAULT_HEAP_LIMIT_MB = 384;
const DEFAULT_CHECK_INTERVAL_MS = 30000;

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

const rssLimitMb = toNumber(process.env.MEMORY_RSS_LIMIT_MB, DEFAULT_RSS_LIMIT_MB);
const heapLimitMb = toNumber(process.env.MEMORY_HEAP_LIMIT_MB, DEFAULT_HEAP_LIMIT_MB);
const checkIntervalMs = toNumber(process.env.MEMORY_CHECK_INTERVAL_MS, DEFAULT_CHECK_INTERVAL_MS);
let lastWarningAt = 0;
let installed = false;

function getMemorySnapshot() {
  const memory = process.memoryUsage();
  const heapStats = v8.getHeapStatistics();
  return {
    rssMb: Math.round(memory.rss / MB),
    heapUsedMb: Math.round(memory.heapUsed / MB),
    heapTotalMb: Math.round(memory.heapTotal / MB),
    externalMb: Math.round(memory.external / MB),
    heapLimitMb: Math.round(heapStats.heap_size_limit / MB)
  };
}

function logMemory(prefix, snapshot = getMemorySnapshot()) {
  console.log(`[MemoryGuard] ${prefix} rss=${snapshot.rssMb}MB heap=${snapshot.heapUsedMb}/${snapshot.heapTotalMb}MB external=${snapshot.externalMb}MB v8Limit=${snapshot.heapLimitMb}MB`);
}

function requestGcIfAvailable() {
  if (typeof global.gc === 'function') {
    try {
      global.gc();
      return true;
    } catch (_) {
      return false;
    }
  }
  return false;
}

function checkMemory() {
  const snapshot = getMemorySnapshot();
  const now = Date.now();
  const nearLimit = snapshot.rssMb >= Math.floor(rssLimitMb * 0.88) || snapshot.heapUsedMb >= Math.floor(heapLimitMb * 0.88);

  if (nearLimit && now - lastWarningAt > 120000) {
    lastWarningAt = now;
    const didGc = requestGcIfAvailable();
    logMemory(`near limit${didGc ? ' after gc' : ''}`, getMemorySnapshot());
  }

  const latest = getMemorySnapshot();
  if (latest.rssMb >= rssLimitMb || latest.heapUsedMb >= heapLimitMb) {
    logMemory(`limit exceeded, exiting for supervisor restart (rssLimit=${rssLimitMb}MB heapLimit=${heapLimitMb}MB)`, latest);
    setTimeout(() => process.exit(78), 250).unref();
  }
}

function installMemoryGuard() {
  if (installed || process.env.DISABLE_MEMORY_GUARD === '1') return;
  installed = true;
  logMemory(`installed (rssLimit=${rssLimitMb}MB heapLimit=${heapLimitMb}MB interval=${checkIntervalMs}ms)`);
  setInterval(checkMemory, checkIntervalMs).unref();
}

installMemoryGuard();

module.exports = {
  installMemoryGuard,
  getMemorySnapshot,
  checkMemory
};
