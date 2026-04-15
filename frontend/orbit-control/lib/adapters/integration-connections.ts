export const supportedConnectionTypes = [
  'sap',
  'salesforce',
  'shopify',
  'generic-rest',
  'webhook',
] as const;

export const supportedAuthTypes = [
  'apiKey',
  'basic',
  'bearer',
  'oauthPrepared',
  'webhook',
] as const;

export function maskSecret(secret: string) {
  if (!secret) return '';
  if (secret.length <= 4) return '****';
  return `${secret.slice(0,2)}***${secret.slice(-2)}`;
}

export function buildCredentialProfile(name: string, authType: string) {
  return { id: `${name}-${authType}`.toLowerCase(), name, authType, storedSecurely: true };
}
