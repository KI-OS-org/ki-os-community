import { startTemplate } from '@/lib/adapters/templates';

export async function POST(request: Request) {
  const body = await request.json();
  return Response.json(startTemplate(body.templateId));
}
