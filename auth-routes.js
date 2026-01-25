import jwt from 'jsonwebtoken';

export function setupAuthRoutes(app, conversationalAuth, CONFIG, logger) {
  app.post('/auth/init', (req, res) => {
    try {
      const { port = 0 } = req.body;
      const sessionId = conversationalAuth.createSession(port);
      const authUrl = conversationalAuth.getAuthUrl(sessionId);
      res.json({ sessionId, authUrl });
    } catch (err) {
      logger.error('Auth init failed', { error: err.message });
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/auth/callback', (req, res) => {
    try {
      const { sessionId, code, error } = req.body;
      const result = conversationalAuth.handleCallback(sessionId, code, error);
      if (result.error) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (err) {
      logger.error('Callback handler failed', { error: err.message });
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/auth/exchange', async (req, res) => {
    try {
      const { sessionId, code } = req.body;
      const result = await conversationalAuth.exchangeCode(sessionId, code);
      const mcp_token = jwt.sign(
        { sessionId, acquired: Date.now() },
        CONFIG.jwt_secret,
        { expiresIn: '24h' }
      );
      res.json({ ...result, mcp_token });
    } catch (err) {
      logger.error('Token exchange failed', { error: err.message });
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/auth/session/:sessionId', (req, res) => {
    try {
      const session = conversationalAuth.getSession(req.params.sessionId);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      res.json(session);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/auth/sessions', (req, res) => {
    try {
      const sessions = conversationalAuth.listSessions();
      res.json({ sessions });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
}
