// Inspect driver errors internally, but return only fixed, credential-free messages.
// Never print raw error objects: they may contain URIs, credentials or server names.
function diagnoseDatabaseError(error) {
  const pending = [error];
  const visited = new Set();
  const codes = new Set();
  let description = "";
  while (pending.length && visited.size < 100) {
    const current = pending.shift();
    if (!current || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);
    if (current.code !== undefined) codes.add(String(current.code));
    description += ` ${current.name || ""} ${current.message || ""} ${current.errmsg || ""} ${current.code || ""}`;
    pending.push(current.cause, current.reason, current.error, current.originalError, current.errorResponse);
    if (current.servers instanceof Map) {
      for (const server of current.servers.values()) pending.push(server.error);
    }
    if (Array.isArray(current.errors)) pending.push(...current.errors);
  }
  const matches = pattern => pattern.test(description);
  const has = (...values) => values.some(value => codes.has(value));
  if (has("18") || matches(/authentication failed|bad auth|auth failed/i)) {
    return { category: "AUTHENTICATION", retryable: false, message: "Atlas rejected database authentication. Verify the database user's credentials and authSource in your private configuration; no credentials were changed." };
  }
  if (has("13") || matches(/not authorized|unauthorized/i)) {
    return { category: "AUTHORIZATION", retryable: false, message: "The database user lacks permission for this database or operation. Check Atlas database-user roles." };
  }
  if (has("ENOTFOUND", "EAI_AGAIN", "ESERVFAIL", "ENODATA") || matches(/querySrv|queryTxt|dns lookup/i)) {
    return { category: "DNS", retryable: true, message: "Atlas DNS resolution failed. Check cluster availability, the URI hostname and DNS/network access." };
  }
  if (matches(/certificate|ERR_TLS_CERT|CERT_HAS_EXPIRED|SELF_SIGNED|UNABLE_TO_VERIFY/i)) {
    return { category: "TLS_CERTIFICATE", retryable: false, message: "Atlas TLS certificate verification failed. Check the system clock, certificate trust and network TLS interception; do not disable TLS verification." };
  }
  if (matches(/ERR_TLS|ERR_SSL|SSL routines|TLS alert|SSL alert|tlsv1 alert/i)) {
    return { category: "TLS_HANDSHAKE", retryable: true, message: "Atlas TLS negotiation failed or the remote peer sent a TLS alert. Check Atlas current-IP access, cluster status and firewall/VPN TLS interception. Credentials are not proven invalid; TLS verification remains enabled." };
  }
  if (has("ECONNRESET", "EPIPE") || matches(/connection.*(?:closed|reset)|socket.*closed|before secure TLS connection/i)) {
    return { category: "NETWORK_RESET", retryable: true, message: "The Atlas connection was closed or reset. Check network stability, Atlas current-IP access and firewall rules." };
  }
  if (has("ECONNREFUSED", "ENETUNREACH", "EHOSTUNREACH") || matches(/connection refused|network is unreachable/i)) {
    return { category: "NETWORK_ACCESS", retryable: true, message: "Atlas cannot be reached. Check cluster availability, the current-IP access list and outbound firewall access." };
  }
  if (has("ETIMEDOUT") || matches(/timeout|timed out|server selection/i)) {
    return { category: "TIMEOUT", retryable: true, message: "Atlas did not become reachable within the connection timeout. Check network access and cluster availability; a timeout alone does not prove invalid credentials." };
  }
  if (matches(/MongoParseError|MongoInvalidArgumentError|invalid scheme|connection string|Invalid URL/i)) {
    return { category: "CONFIGURATION", retryable: false, message: "MONGODB_URI is invalid. Verify its structure and percent-encoding privately without logging the URI." };
  }
  return { category: "UNKNOWN", retryable: true, message: "MongoDB connection failed without a recognized safe diagnostic. Check Atlas cluster status and network access." };
}

function safeDatabaseError(error) {
  const diagnostic = diagnoseDatabaseError(error);
  const safe = new Error(`MongoDB [${diagnostic.category}]: ${diagnostic.message}`);
  safe.name = "DatabaseConnectionError";
  safe.diagnostic = diagnostic;
  // Intentionally omit cause, raw errors and URI fields from the public error.
  return safe;
}
module.exports = { diagnoseDatabaseError, safeDatabaseError };
