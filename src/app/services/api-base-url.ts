import { environment } from '../../environments/environment';

const GESTOR_ORIGIN = 'https://www.gestor.admspot.com.br';

export function isLocalDevBrowserHost(hostname: string): boolean {
  if (!hostname) {
    return false;
  }
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.localhost')
  );
}

/**
 * Origem do `ng serve` / `ionic serve` com proxy (não XAMPP em 80/443).
 */
export function isAngularDevServerOrigin(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const { hostname, port } = window.location;
  if (!isLocalDevBrowserHost(hostname)) {
    return false;
  }
  const p = port || '';
  if (p === '' || p === '80' || p === '443') {
    return false;
  }
  const n = Number.parseInt(p, 10);
  return Number.isFinite(n) && environment.localDevServerPorts.includes(n);
}

/** `path` deve começar por `/api/...`. */
export function getGestorApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (isAngularDevServerOrigin()) {
    return normalized;
  }
  return `${GESTOR_ORIGIN}${normalized}`;
}

export { GESTOR_ORIGIN };
