import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import * as cheerio from 'cheerio';
import multer from 'multer';
import pdf from 'pdf-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    mode TEXT DEFAULT 'research',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
  
  CREATE TABLE IF NOT EXISTS generated_content (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
`);

// Migration for existing chats table
try {
  const columns = db.prepare("PRAGMA table_info(chats)").all() as any[];
  if (!columns.find(c => c.name === 'mode')) {
    db.prepare("ALTER TABLE chats ADD COLUMN mode TEXT DEFAULT 'research'").run();
  }
} catch (e) {
  console.error("Migration error:", e);
}

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  
  app.post('/api/fetch-url', async (req, res) => {
    try {
      const { url } = req.body;
      const response = await fetch(url);
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Remove scripts, styles, etc
      $('script, style, nav, footer, header, aside').remove();
      
      const title = $('title').text() || url;
      const text = $('body').text().replace(/\s+/g, ' ').trim();
      
      res.json({ title, text });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/upload-pdf', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const dataBuffer = req.file.buffer;
      const data = await pdf(dataBuffer);
      
      // Clean up text slightly
      const text = data.text.replace(/\s+/g, ' ').trim();
      const title = req.file.originalname;
      
      res.json({ title, text });
    } catch (error: any) {
      console.error('PDF parsing error:', error);
      res.status(500).json({ error: 'Failed to parse PDF' });
    }
  });

  // Projects
  app.get('/api/projects', (req, res) => {
    const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
    res.json(projects);
  });

  app.post('/api/projects', (req, res) => {
    const { id, title, description } = req.body;
    db.prepare('INSERT INTO projects (id, title, description) VALUES (?, ?, ?)').run(id, title, description);
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.json(project);
  });

  app.get('/api/projects/:id', (req, res) => {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  });

  app.delete('/api/projects/:id', (req, res) => {
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // Sources
  app.get('/api/projects/:id/sources', (req, res) => {
    const sources = db.prepare('SELECT * FROM sources WHERE project_id = ? ORDER BY created_at DESC').all(req.params.id);
    res.json(sources);
  });

  app.post('/api/projects/:id/sources', (req, res) => {
    const { id, type, title, content } = req.body;
    db.prepare('INSERT INTO sources (id, project_id, type, title, content) VALUES (?, ?, ?, ?, ?)').run(id, req.params.id, type, title, content);
    const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(id);
    res.json(source);
  });

  app.delete('/api/sources/:id', (req, res) => {
    db.prepare('DELETE FROM sources WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // Chats
  app.get('/api/projects/:id/chats', (req, res) => {
    const { mode } = req.query;
    const stmt = mode 
      ? db.prepare('SELECT * FROM chats WHERE project_id = ? AND mode = ? ORDER BY created_at ASC')
      : db.prepare('SELECT * FROM chats WHERE project_id = ? ORDER BY created_at ASC');
    
    const chats = mode ? stmt.all(req.params.id, mode) : stmt.all(req.params.id);
    res.json(chats);
  });

  app.post('/api/projects/:id/chats', (req, res) => {
    const { id, role, content, mode } = req.body;
    const chatMode = mode || 'research';
    db.prepare('INSERT INTO chats (id, project_id, role, content, mode) VALUES (?, ?, ?, ?, ?)').run(id, req.params.id, role, content, chatMode);
    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(id);
    res.json(chat);
  });
  
  app.delete('/api/projects/:id/chats', (req, res) => {
    db.prepare('DELETE FROM chats WHERE project_id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // Generated Content (Audio, etc)
  app.get('/api/projects/:id/generated', (req, res) => {
    const content = db.prepare('SELECT * FROM generated_content WHERE project_id = ? ORDER BY created_at DESC').all(req.params.id);
    res.json(content);
  });

  app.post('/api/projects/:id/generated', (req, res) => {
    const { id, type, title, content_url } = req.body;
    db.prepare('INSERT INTO generated_content (id, project_id, type, title, content_url) VALUES (?, ?, ?, ?, ?)').run(id, req.params.id, type, title, content_url);
    const content = db.prepare('SELECT * FROM generated_content WHERE id = ?').get(id);
    res.json(content);
  });

  // Activity Feed
  app.get('/api/activity', (req, res) => {
    // Union projects, sources, and generated content to create a feed
    // We select id, type, title, created_at, and 'project_id' (or null)
    const activity = db.prepare(`
      SELECT id, 'project' as type, title, created_at, id as project_id FROM projects
      UNION ALL
      SELECT id, 'source' as type, title, created_at, project_id FROM sources
      UNION ALL
      SELECT id, 'generated' as type, title, created_at, project_id FROM generated_content
      ORDER BY created_at DESC
      LIMIT 20
    `).all();
    res.json(activity);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
