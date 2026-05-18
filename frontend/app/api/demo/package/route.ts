export async function GET() {
  return Response.json({
    package: 'orbit-control-demo-investor-pilot',
    version: '0.3.4-f24-demo-investor-pilot-packaging',
    sections: ['demo', 'investor', 'pilot', 'artifacts'],
    capabilitySnapshot: true
  });
}
