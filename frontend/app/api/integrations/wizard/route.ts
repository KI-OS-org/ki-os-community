export async function GET() {
  return Response.json({
    stepOrder: ['app', 'auth', 'credentials', 'test', 'save'],
    authTypes: ['apiKey', 'basic', 'bearer', 'oauthPrepared', 'webhook'],
    connectionTypes: ['sap', 'salesforce', 'shopify', 'generic-rest', 'webhook'],
  });
}
