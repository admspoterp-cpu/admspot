/**
 * Proxy do `ng serve` → API em produção.
 * Usar `onProxyReq` (e não `headers` no JSON): alguns setups com Vite/esbuild
 * ignoram ou rejeitam `headers` no proxy e o POST cai no handler padrão ("Cannot POST /api/...").
 */
const COOKIE = 'PHPSESSID=ba832f1772c56eb7fb76a591cf310f5f';

module.exports = {
  '/api': {
    target: 'https://www.gestor.admspot.com.br',
    secure: true,
    changeOrigin: true,
    onProxyReq(proxyReq) {
      proxyReq.setHeader('Cookie', COOKIE);
    },
  },
};
