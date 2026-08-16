/**
 * Local browser-trust fence for the Web UI's read-only API route.
 *
 * Mirrors the semantics of `@deepseek-ai/dsh-client-connection`'s
 * `isTrustedApiRequest` (loopback/trusted Host + same-origin browser markers)
 * so a request that passes it is either our own page or a loopback client.
 * That function is NOT exported from the package's public entry, so we
 * re-implement the ~40-line rule locally instead of importing an unstable
 * deep path or adding a runtime dependency. This is not an auth layer.
 */

/** Whether a hostname is loopback (localhost, 127.0.0.0/8, ::1, 0.0.0.0). */
function isLoopbackHostname(hostname) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname === '0.0.0.0' ||
    /^127\.\d{1,3}(\.\d{1,3}){2}$/.test(hostname)
  )
}

/**
 * Decide whether one request may reach the task-state route.
 * @param {import('node:http').IncomingHttpHeaders} headers the request headers.
 * @param {string[]} [trustedHosts] non-loopback `host`/`host:port` authorities
 *   this deployment serves (empty for the loopback-only web profile).
 * @returns {boolean} true when the Host is ours and any attached browser
 *   markers (sec-fetch-site, origin) are same-origin.
 */
export function isTrustedApiRequest(headers, trustedHosts = []) {
  const host = headers && typeof headers.host === 'string' ? headers.host : undefined
  if (!host) return false
  let hostUrl
  try {
    hostUrl = new URL('http://' + host)
  } catch {
    return false
  }
  const entries = Array.isArray(trustedHosts) ? trustedHosts : []
  const hostOk =
    isLoopbackHostname(hostUrl.hostname) ||
    entries.some((entry) => {
      try {
        return new URL('http://' + entry).host === hostUrl.host
      } catch {
        return false
      }
    })
  if (!hostOk) return false
  if (headers['sec-fetch-site'] === 'cross-site') return false
  const origin = headers.origin
  if (origin === undefined || origin === '') return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}
