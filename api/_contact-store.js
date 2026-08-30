const memory = globalThis.__venusHourContactMemory || {
  values: new Map(),
  counters: new Map(),
};

globalThis.__venusHourContactMemory = memory;

const redisUrl = String(
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "",
).replace(/\/$/, "");
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";

export const hasDurableStore = Boolean(redisUrl && redisToken);

async function redis(command) {
  if (!hasDurableStore) return null;

  const response = await fetch(redisUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Contact store returned HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.error) throw new Error(payload.error);
  return payload.result;
}

function cleanupMemory(key) {
  const item = memory.values.get(key);
  if (item?.expiresAt && item.expiresAt <= Date.now()) memory.values.delete(key);
}

export async function getValue(key) {
  if (hasDurableStore) return redis(["GET", key]);
  cleanupMemory(key);
  return memory.values.get(key)?.value ?? null;
}

export async function setValue(key, value, ttlSeconds) {
  if (hasDurableStore) {
    return redis(["SET", key, value, "EX", ttlSeconds]);
  }

  memory.values.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
  return "OK";
}

export async function setIfAbsent(key, value, ttlSeconds) {
  if (hasDurableStore) {
    return (await redis(["SET", key, value, "EX", ttlSeconds, "NX"])) === "OK";
  }

  cleanupMemory(key);
  if (memory.values.has(key)) return false;
  await setValue(key, value, ttlSeconds);
  return true;
}

export async function deleteValue(key) {
  if (hasDurableStore) return redis(["DEL", key]);
  memory.values.delete(key);
  return 1;
}

export async function incrementWithWindow(key, ttlSeconds) {
  if (hasDurableStore) {
    const current = Number(await redis(["INCR", key]));
    if (current === 1) await redis(["EXPIRE", key, ttlSeconds]);
    return current;
  }

  const now = Date.now();
  const previous = memory.counters.get(key);
  const item = !previous || previous.expiresAt <= now
    ? { value: 0, expiresAt: now + ttlSeconds * 1000 }
    : previous;
  item.value += 1;
  memory.counters.set(key, item);
  return item.value;
}

export async function saveEnquiry(enquiry) {
  const json = JSON.stringify(enquiry);
  await setValue(`contact:enquiry:${enquiry.id}`, json, 60 * 60 * 24 * 365);

  if (hasDurableStore) {
    await redis(["ZADD", "contact:enquiries", Date.now(), enquiry.id]);
    await redis([
      "ZREMRANGEBYSCORE",
      "contact:enquiries",
      "-inf",
      Date.now() - 60 * 60 * 24 * 365 * 1000,
    ]);
  }
}

export async function getEnquiry(id) {
  const value = await getValue(`contact:enquiry:${id}`);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function linkMessage(messageId, enquiryId, recipientType) {
  if (!messageId) return;
  await setValue(
    `contact:message:${messageId}`,
    JSON.stringify({ enquiryId, recipientType }),
    60 * 60 * 24 * 365,
  );
}

export async function getMessageLink(messageId) {
  const value = await getValue(`contact:message:${messageId}`);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
