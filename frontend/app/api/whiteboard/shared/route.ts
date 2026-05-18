export async function GET() {
  return Response.json({
    boardId: 'workspace-default',
    sharedStateVisible: true,
    members: [
      { id: 'ingo', role: 'owner', active: true },
      { id: 'demo-operator', role: 'editor', active: true }
    ]
  });
}
