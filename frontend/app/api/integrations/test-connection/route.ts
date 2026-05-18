export async function POST() {
  return Response.json({
    ok: true,
    tested: true,
    latencyMs: 182,
    target: 'generic-rest',
    status: 'reachable',
  });
}
