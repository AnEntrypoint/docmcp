import * as docs from './docs.js';
import * as sheets from './sheets.js';

export function setupMcpRoutes(app, oauth2Client, tokenStore, auth, logger) {
  app.post('/mcp/docs/read', auth, async (req, res) => {
    try {
      const { doc_id } = req.body;
      if (!doc_id) return res.status(400).json({ error: 'doc_id required' });

      const user = tokenStore.get(req.user.userId);
      oauth2Client.setCredentials({ access_token: user.access_token });

      const content = await docs.readDocument(oauth2Client, doc_id);
      res.json({ doc_id, content });
    } catch (err) {
      logger.error('Read doc', { error: err.message });
      res.status(500).json({ error: 'Read failed' });
    }
  });

  app.post('/mcp/docs/edit', auth, async (req, res) => {
    try {
      const { doc_id, old_text, new_text } = req.body;
      if (!doc_id || !old_text || new_text === undefined) return res.status(400).json({ error: 'Missing params' });

      const user = tokenStore.get(req.user.userId);
      oauth2Client.setCredentials({ access_token: user.access_token });

      await docs.editDocument(oauth2Client, doc_id, old_text, new_text);
      res.json({ doc_id, status: 'edited' });
    } catch (err) {
      logger.error('Edit doc', { error: err.message });
      res.status(500).json({ error: 'Edit failed' });
    }
  });

  app.post('/mcp/docs/insert', auth, async (req, res) => {
    try {
      const { doc_id, text, position } = req.body;
      if (!doc_id || !text) return res.status(400).json({ error: 'Missing params' });

      const user = tokenStore.get(req.user.userId);
      oauth2Client.setCredentials({ access_token: user.access_token });

      await docs.insertDocument(oauth2Client, doc_id, text, position || 'end');
      res.json({ doc_id, status: 'inserted' });
    } catch (err) {
      logger.error('Insert doc', { error: err.message });
      res.status(500).json({ error: 'Insert failed' });
    }
  });

  app.post('/mcp/sheets/read', auth, async (req, res) => {
    try {
      const { sheet_id, range = 'Sheet1' } = req.body;
      if (!sheet_id) return res.status(400).json({ error: 'sheet_id required' });

      const user = tokenStore.get(req.user.userId);
      oauth2Client.setCredentials({ access_token: user.access_token });

      const values = await sheets.readSheet(oauth2Client, sheet_id, range);
      res.json({ sheet_id, range, values });
    } catch (err) {
      logger.error('Read sheet', { error: err.message });
      res.status(500).json({ error: 'Read failed' });
    }
  });

  app.post('/mcp/sheets/edit', auth, async (req, res) => {
    try {
      const { sheet_id, range, values } = req.body;
      if (!sheet_id || !range || !values) return res.status(400).json({ error: 'Missing params' });

      const user = tokenStore.get(req.user.userId);
      oauth2Client.setCredentials({ access_token: user.access_token });

      await sheets.editSheet(oauth2Client, sheet_id, range, values);
      res.json({ sheet_id, range, status: 'edited' });
    } catch (err) {
      logger.error('Edit sheet', { error: err.message });
      res.status(500).json({ error: 'Edit failed' });
    }
  });

  app.post('/mcp/sheets/insert', auth, async (req, res) => {
    try {
      const { sheet_id, range = 'Sheet1', values } = req.body;
      if (!sheet_id || !values) return res.status(400).json({ error: 'Missing params' });

      const user = tokenStore.get(req.user.userId);
      oauth2Client.setCredentials({ access_token: user.access_token });

      await sheets.insertSheet(oauth2Client, sheet_id, range, values);
      res.json({ sheet_id, range, status: 'inserted' });
    } catch (err) {
      logger.error('Insert sheet', { error: err.message });
      res.status(500).json({ error: 'Insert failed' });
    }
  });
}
