const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [
        'https://frontendurl'
      ]
    : true, // En développement, autoriser toutes les origines
  credentials: true
}));

app.use(express.json());

// Configuration SQLite
const dbPath = process.env.NODE_ENV === 'production'
  ? path.join('/db', 'quiz.db')
  : path.join(__dirname, 'quiz.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Erreur ouverture base SQLite:', err);
    process.exit(1);
  } else {
    console.log('✅ Base de données SQLite connectée:', dbPath);
  }
});

// Initialisation des tables
function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Table des questions
      db.run(`CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY,
        text TEXT NOT NULL,
        options TEXT NOT NULL, -- JSON array
        correctIndex INTEGER NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Table des participants
      db.run(`CREATE TABLE IF NOT EXISTS participants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        score INTEGER DEFAULT 0,
        answers TEXT DEFAULT '[]', -- JSON array
        avatarUrl TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Table de l'état du quiz
      db.run(`CREATE TABLE IF NOT EXISTS quiz_state (
        id INTEGER PRIMARY KEY DEFAULT 1,
        step TEXT DEFAULT 'lobby',
        currentQuestionIndex INTEGER DEFAULT 0,
        questionStartTime INTEGER,
        questionStartTimes TEXT DEFAULT '{}', -- JSON object
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Table des réponses
      db.run(`CREATE TABLE IF NOT EXISTS answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        questionIndex INTEGER NOT NULL,
        userId TEXT NOT NULL,
        userName TEXT NOT NULL,
        answerIndex INTEGER NOT NULL,
        timestamp INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        FOREIGN KEY (userId) REFERENCES participants(id)
      )`);

      // Insérer l'état initial du quiz
      db.run(`INSERT OR IGNORE INTO quiz_state (id, step) VALUES (1, 'lobby')`);

      // Insérer les questions par défaut
      const defaultQuestions = [
        {
          id: 1,
          text: "Quelle est la capitale de la France ?",
          options: JSON.stringify(["Lyon", "Paris", "Marseille", "Bordeaux"]),
          correctIndex: 1
        },
        {
          id: 2,
          text: "Combien font 2 + 2 ?",
          options: JSON.stringify(["3", "4", "5", "6"]),
          correctIndex: 1
        },
        {
          id: 3,
          text: "Quelle est la couleur du ciel par beau temps ?",
          options: JSON.stringify(["Rouge", "Vert", "Bleu", "Jaune"]),
          correctIndex: 2
        }
      ];

      const insertQuestion = db.prepare(`INSERT OR IGNORE INTO questions (id, text, options, correctIndex) VALUES (?, ?, ?, ?)`);
      defaultQuestions.forEach(q => {
        insertQuestion.run(q.id, q.text, q.options, q.correctIndex);
      });
      insertQuestion.finalize();

      console.log('✅ Base de données initialisée avec les tables et données par défaut');
      resolve();
    });
  });
}

// === ROUTES API ===

// Route de santé
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    message: 'Serveur quiz SQLite opérationnel',
    database: 'SQLite'
  });
});

// Token d'authentification (simplifié pour SQLite)
app.post('/api/auth/token', (req, res) => {
  const token = 'sqlite-token-' + Date.now();
  res.json({
    token: token,
    message: 'Token SQLite créé avec succès'
  });
});

// === QUESTIONS ===

// Obtenir toutes les questions
app.get('/api/questions', (req, res) => {
  db.all('SELECT id, text, options, correctIndex, imageUrl, imageUrlResult, imageUrlEnd FROM questions ORDER BY id', (err, rows) => {
    if (err) {
      console.error('Erreur récupération questions:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    } else {
      const questions = rows.map(row => ({
        id: row.id,
        text: row.text,
        options: JSON.parse(row.options),
        correctIndex: row.correctIndex,
        imageUrl: row.imageUrl,
        imageUrlResult: row.imageUrlResult,
        imageUrlEnd: row.imageUrlEnd
      }));
      res.json(questions);
    }
  });
});

// Ajouter une question
app.post('/api/questions', (req, res) => {
  const { id, text, options, correctIndex } = req.body;

  if (!text || !options || typeof correctIndex !== 'number') {
    return res.status(400).json({ error: 'Données manquantes' });
  }

  const optionsJson = JSON.stringify(options);

  db.run('INSERT OR REPLACE INTO questions (id, text, options, correctIndex) VALUES (?, ?, ?, ?)',
    [id, text, optionsJson, correctIndex],
    function(err) {
      if (err) {
        console.error('Erreur ajout question:', err);
        res.status(500).json({ error: 'Erreur serveur' });
      } else {
        res.json({
          success: true,
          question: { id, text, options, correctIndex }
        });
      }
    });
});

// === PARTICIPANTS ===

// Obtenir tous les participants
app.get('/api/participants', (req, res) => {
  db.all('SELECT id, name, score, answers, avatarUrl, createdAt FROM participants ORDER BY createdAt', (err, rows) => {
    if (err) {
      console.error('Erreur récupération participants:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    } else {
      const participants = rows.map(row => ({
        id: row.id,
        name: row.name,
        score: row.score,
        answers: JSON.parse(row.answers || '[]'),
        avatarUrl: row.avatarUrl,
        createdAt: row.createdAt
      }));
      res.json(participants);
    }
  });
});

// Créer un participant
app.post('/api/participants', (req, res) => {
  const { id, name, avatarUrl } = req.body;

  if (!id || !name) {
    return res.status(400).json({ error: 'ID et nom requis' });
  }

  const participant = {
    id,
    name: name.trim(),
    score: 0,
    answers: JSON.stringify([]),
    avatarUrl: avatarUrl || null,
    createdAt: new Date().toISOString()
  };

  db.run('INSERT OR REPLACE INTO participants (id, name, score, answers, avatarUrl) VALUES (?, ?, ?, ?, ?)',
    [participant.id, participant.name, participant.score, participant.answers, participant.avatarUrl],
    function(err) {
      if (err) {
        console.error('Erreur création participant:', err);
        res.status(500).json({ error: 'Erreur serveur' });
      } else {
        res.json({ success: true, participant });
      }
    });
});

// === RÉPONSES ===

// Obtenir les réponses d'une question
app.get('/api/answers/:questionIndex', (req, res) => {
  const questionIndex = parseInt(req.params.questionIndex);

  db.all('SELECT userId, userName, answerIndex, timestamp FROM answers WHERE questionIndex = ? ORDER BY timestamp',
    [questionIndex],
    (err, rows) => {
      if (err) {
        console.error('Erreur récupération réponses:', err);
        res.status(500).json({ error: 'Erreur serveur' });
      } else {
        res.json({ answers: rows });
      }
    });
});

// Soumission d'une réponse
app.post('/api/answers', (req, res) => {
  const { questionIndex, userId, userName, answerIndex } = req.body;

  if (typeof questionIndex !== 'number' || !userId || !userName || typeof answerIndex !== 'number') {
    return res.status(400).json({ error: 'Données manquantes' });
  }

  db.run('INSERT INTO answers (questionIndex, userId, userName, answerIndex) VALUES (?, ?, ?, ?)',
    [questionIndex, userId, userName, answerIndex],
    function(err) {
      if (err) {
        console.error('Erreur soumission réponse:', err);
        res.status(500).json({ error: 'Erreur serveur' });
      } else {
        res.json({ success: true, answerId: this.lastID });
      }
    });
});

// === ÉTAT DU QUIZ ===

// Obtenir l'état du quiz
app.get('/api/quiz-state', (req, res) => {
  db.get('SELECT step, currentQuestionIndex, questionStartTime, questionStartTimes FROM quiz_state WHERE id = 1',
    (err, row) => {
      if (err) {
        console.error('Erreur récupération état quiz:', err);
        res.status(500).json({ error: 'Erreur serveur' });
      } else {
        // Ajout timerMax pour synchronisation stricte
        const TIMER_MAX = 20; // valeur à adapter si besoin
        const state = {
          step: row?.step || 'lobby',
          currentQuestionIndex: row?.currentQuestionIndex || 0,
          questionStartTime: row?.questionStartTime || null,
          questionStartTimes: JSON.parse(row?.questionStartTimes || '{}'),
          timerMax: TIMER_MAX
        };
        res.json(state);
      }
    });
});

// Mettre à jour l'état du quiz
app.put('/api/quiz-state', (req, res) => {
  const { step, currentQuestionIndex, questionStartTime, questionStartTimes } = req.body;

  let updateFields = [];
  let updateValues = [];

    // On récupère l'état actuel pour détecter le changement de question
    db.get('SELECT currentQuestionIndex, questionStartTime, questionStartTimes FROM quiz_state WHERE id = 1', (err, row) => {
      if (err) {
        console.error('Erreur lecture quiz_state:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      let oldQuestionIndex = row?.currentQuestionIndex ?? 0;
      let oldStartTimes = JSON.parse(row?.questionStartTimes || '{}');
      let newStartTime = row?.questionStartTime;

      // Si on change de question, on réinitialise le timer
      if (typeof currentQuestionIndex === 'number' && currentQuestionIndex !== oldQuestionIndex) {
        newStartTime = Date.now();
        oldStartTimes[currentQuestionIndex] = newStartTime;
      }
      // Construction des champs à mettre à jour
      if (step) {
        updateFields.push('step = ?');
        updateValues.push(step);
      }
      if (typeof currentQuestionIndex === 'number') {
        updateFields.push('currentQuestionIndex = ?');
        updateValues.push(currentQuestionIndex);
      }
      // On force la mise à jour du timer si nouvelle question
      if (typeof currentQuestionIndex === 'number' && currentQuestionIndex !== oldQuestionIndex) {
        updateFields.push('questionStartTime = ?');
        updateValues.push(newStartTime);
        updateFields.push('questionStartTimes = ?');
        updateValues.push(JSON.stringify(oldStartTimes));
      } else {
        if (questionStartTime) {
          updateFields.push('questionStartTime = ?');
          updateValues.push(questionStartTime);
        }
        if (questionStartTimes) {
          updateFields.push('questionStartTimes = ?');
          updateValues.push(JSON.stringify(questionStartTimes));
        }
      }
      updateFields.push('updatedAt = CURRENT_TIMESTAMP');
      updateValues.push(1); // WHERE id = 1
      const sql = `UPDATE quiz_state SET ${updateFields.join(', ')} WHERE id = ?`;
      db.run(sql, updateValues, function(err) {
        if (err) {
          console.error('Erreur mise à jour état quiz:', err);
          res.status(500).json({ error: 'Erreur serveur' });
        } else {
          res.json({ success: true });
        }
      });
    });
});

// === GESTION DU QUIZ ===

// === ENDPOINTS ADMIN POUR GESTION DES QUESTIONS ===

// Authentification admin simple
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'; // À changer en production

// Middleware d'authentification admin
function requireAdminAuth(req, res, next) {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Mot de passe administrateur incorrect' });
  }
  next();
}

// Lister toutes les questions
app.post('/api/admin/questions', requireAdminAuth, (req, res) => {
  db.all('SELECT * FROM questions ORDER BY id', (err, rows) => {
    if (err) {
      console.error('Erreur récupération questions:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    } else {
      const questions = rows.map(row => ({
        ...row,
        options: JSON.parse(row.options)
      }));
      res.json(questions);
    }
  });
});

// Ajouter une nouvelle question
app.post('/api/admin/questions/add', requireAdminAuth, (req, res) => {
  const { text, options, correctIndex } = req.body;
  
  if (!text || !Array.isArray(options) || options.length < 2 || typeof correctIndex !== 'number') {
    return res.status(400).json({ 
      error: 'Données invalides. Requis: text, options (array), correctIndex (number)' 
    });
  }

  if (correctIndex < 0 || correctIndex >= options.length) {
    return res.status(400).json({ 
      error: 'correctIndex doit être un index valide dans options' 
    });
  }

  db.run(
    'INSERT INTO questions (text, options, correctIndex) VALUES (?, ?, ?)',
    [text, JSON.stringify(options), correctIndex],
    function(err) {
      if (err) {
        console.error('Erreur ajout question:', err);
        res.status(500).json({ error: 'Erreur serveur' });
      } else {
        res.json({ 
          success: true, 
          id: this.lastID,
          message: 'Question ajoutée avec succès'
        });
      }
    }
  );
});

// Modifier une question existante
app.put('/api/admin/questions/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const { text, options, correctIndex } = req.body;

  if (!text || !Array.isArray(options) || options.length < 2 || typeof correctIndex !== 'number') {
    return res.status(400).json({ 
      error: 'Données invalides. Requis: text, options (array), correctIndex (number)' 
    });
  }

  if (correctIndex < 0 || correctIndex >= options.length) {
    return res.status(400).json({ 
      error: 'correctIndex doit être un index valide dans options' 
    });
  }

  db.run(
    'UPDATE questions SET text = ?, options = ?, correctIndex = ? WHERE id = ?',
    [text, JSON.stringify(options), correctIndex, id],
    function(err) {
      if (err) {
        console.error('Erreur modification question:', err);
        res.status(500).json({ error: 'Erreur serveur' });
      } else if (this.changes === 0) {
        res.status(404).json({ error: 'Question non trouvée' });
      } else {
        res.json({ 
          success: true,
          message: 'Question modifiée avec succès'
        });
      }
    }
  );
});

// Supprimer une question
app.delete('/api/admin/questions/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Mot de passe administrateur incorrect' });
  }

  db.run('DELETE FROM questions WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Erreur suppression question:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Question non trouvée' });
    } else {
      res.json({ 
        success: true,
        message: 'Question supprimée avec succès'
      });
    }
  });
});

// Reset complet du quiz
app.post('/api/quiz/reset', (req, res) => {
  db.serialize(() => {
    db.run('DELETE FROM participants');
    db.run('DELETE FROM answers');
    db.run('UPDATE quiz_state SET step = ?, currentQuestionIndex = ?, questionStartTime = ?, questionStartTimes = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = 1',
      ['lobby', 0, Date.now(), '{}'],
      function(err) {
        if (err) {
          console.error('Erreur reset quiz:', err);
          res.status(500).json({ error: 'Erreur serveur' });
        } else {
          res.json({
            success: true,
            message: 'Quiz reset avec succès',
            database: 'SQLite'
          });
        }
      });
  });
});

// Obtenir le leaderboard
app.get('/api/leaderboard', (req, res) => {
  db.all('SELECT id, name, score, avatarUrl FROM participants ORDER BY score DESC', (err, rows) => {
    if (err) {
      console.error('Erreur récupération leaderboard:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    } else {
      res.json(rows);
    }
  });
});

// Démarrage du serveur
async function startServer() {
  try {
    console.log('[DEBUG] 1. Début de startServer');
    await initDatabase();
    console.log('[DEBUG] 2. initDatabase terminé');

    const server = app.listen(PORT, () => {
      console.log(`🚀 Serveur SQLite démarré`);
      console.log(`📊 Base de données: ${dbPath}`);
      console.log(`🌐 API disponible sur: https://backendurl`);
      console.log('[DEBUG] 3. Serveur en écoute');
    });
    
    console.log('[DEBUG] 4. app.listen appelé');
    
    // Garder le serveur vivant
    process.on('SIGTERM', () => {
      console.log('SIGTERM reçu, fermeture du serveur...');
      server.close(() => {
        console.log('Serveur fermé');
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('❌ Erreur démarrage serveur:', error);
    process.exit(1);
  }
}

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du serveur...');
  db.close((err) => {
    if (err) {
      console.error('Erreur fermeture base:', err);
    } else {
      console.log('✅ Base de données fermée proprement');
    }
    process.exit(0);
  });
});

startServer();
