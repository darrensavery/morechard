export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? '0.0.0.0';
}
