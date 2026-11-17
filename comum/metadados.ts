// Conferência do documento de metadados do servidor de autorização contra a
// tabela de valores obrigatórios da seção 5.2. Usada pela suíte (AUT-026) e
// pelo receptor mínimo (RCP-031).

export function divergenciasDosMetadados(m: Record<string, unknown>, issuerDoRegistro: string, escoposDoRegistro: string[]): string[] {
  const erros: string[] = [];
  const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const https = (v: unknown) => typeof v === 'string' && v.startsWith('https://');
  if (m.issuer !== issuerDoRegistro) erros.push(`issuer ${String(m.issuer)} diferente do registro (${issuerDoRegistro})`);
  for (const k of ['authorization_endpoint', 'token_endpoint', 'pushed_authorization_request_endpoint', 'jwks_uri']) {
    if (!https(m[k])) erros.push(`${k} ausente ou sem https`);
  }
  for (const k of ['require_pushed_authorization_requests', 'authorization_response_iss_parameter_supported', 'tls_client_certificate_bound_access_tokens']) {
    if (m[k] !== true) erros.push(`${k} precisa ser true (veio ${JSON.stringify(m[k])})`);
  }
  if (!igual(m.response_types_supported, ['code'])) erros.push('response_types_supported precisa ser exatamente ["code"]');
  const grants = m.grant_types_supported;
  if (!Array.isArray(grants) || !['authorization_code', 'refresh_token', 'client_credentials'].every((g) => grants.includes(g)) || grants.includes('password') || grants.includes('implicit')) {
    erros.push('grant_types_supported precisa conter authorization_code, refresh_token e client_credentials, sem password nem implicit');
  }
  if (!igual(m.token_endpoint_auth_methods_supported, ['private_key_jwt'])) erros.push('token_endpoint_auth_methods_supported precisa ser exatamente ["private_key_jwt"]');
  if (!igual(m.token_endpoint_auth_signing_alg_values_supported, ['PS256'])) erros.push('token_endpoint_auth_signing_alg_values_supported precisa ser exatamente ["PS256"]');
  if (!igual(m.code_challenge_methods_supported, ['S256'])) erros.push('code_challenge_methods_supported precisa ser exatamente ["S256"]');
  const escopos = m.scopes_supported;
  if (!Array.isArray(escopos) || !escoposDoRegistro.every((s) => escopos.includes(s))) erros.push('scopes_supported não contém todos os escopos do provedor no registro');
  return erros;
}

/** Endereço do documento de metadados: /.well-known/oauth-authorization-server entre o host e o caminho do issuer (RFC 8414, seção 3). */
export function urlDosMetadados(issuer: string): string {
  const u = new URL(issuer);
  const caminho = u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '');
  return `${u.origin}/.well-known/oauth-authorization-server${caminho}`;
}

/**
 * Link de paginação dentro do fhir_base_url: esquema, host, porta, prefixo em
 * fronteira de segmento e sem componente de usuário (seção 5.1). Link relativo
 * é resolvido antes contra a URL da requisição (`relativoA`), pelo RFC 3986.
 */
export function dentroDaBase(url: string, base: string, relativoA?: string): boolean {
  let u: URL;
  let b: URL;
  try {
    u = relativoA ? new URL(url, relativoA) : new URL(url);
    b = new URL(base);
  } catch {
    return false;
  }
  if (u.username || u.password) return false;
  const porta = (x: URL) => x.port || (x.protocol === 'https:' ? '443' : '80');
  if (u.protocol !== b.protocol || u.hostname !== b.hostname || porta(u) !== porta(b)) return false;
  const prefixo = b.pathname.replace(/\/$/, '');
  return u.pathname === prefixo || u.pathname.startsWith(`${prefixo}/`);
}

/** Link de paginação como o provedor DEVE emitir (API-013): URL absoluta, https, sem componente de usuário. */
export function linkAbsolutoHttps(url: string): boolean {
  if (!/^https:\/\//i.test(url)) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password && !/^https:\/\/[^/]*@/i.test(url);
  } catch {
    return false;
  }
}
