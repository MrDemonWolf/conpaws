import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Env = {
  BREVO_API_KEY: string;
  BREVO_LIST_ID: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use(
  '*',
  cors({
    origin: ['https://conpaws.com', 'http://localhost:3000', 'http://localhost:3001'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  }),
);

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

app.post('/subscribe', async (c) => {
  let body: { name?: string; email?: string; honeypot?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const { name, email, honeypot } = body;

  // Honeypot — silent success for bots
  if (honeypot) {
    return c.json({ success: true });
  }

  // Validation
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return c.json({ error: 'Name is required' }, 400);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
    return c.json({ error: 'Valid email is required' }, 400);
  }

  // Add to Brevo
  try {
    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': c.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        attributes: { FIRSTNAME: name.trim() },
        listIds: [parseInt(c.env.BREVO_LIST_ID, 10)],
        updateEnabled: true,
      }),
    });

    if (res.status === 204 || res.status === 201 || res.status === 200) {
      return c.json({ success: true });
    }

    const data = await res.json() as { code?: string; message?: string };

    // Duplicate contact — treat as success
    if (data.code === 'duplicate_parameter') {
      return c.json({ success: true });
    }

    // Bad email format reported by Brevo
    if (res.status === 400) {
      return c.json({ error: 'Invalid email address' }, 400);
    }

    return c.json({ error: 'Failed to subscribe. Please try again.' }, 500);
  } catch {
    return c.json({ error: 'Network error. Please try again.' }, 500);
  }
});

export default app;
