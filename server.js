const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// WebSocket connections pour synchronisation temps réel
const clients = new Set();

wss.on('connection', (ws) => {
  console.log('🔌 Nouveau client WebSocket connecté');
  clients.add(ws);
  
  ws.on('close', () => {
    console.log('🔌 Client WebSocket déconnecté');
    clients.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error('❌ Erreur WebSocket:', error);
    clients.delete(ws);
  });
});

// Fonction pour broadcaster à tous les clients connectés
function broadcastTimerUpdate(timerData) {
  const message = JSON.stringify({
    type: 'timer-update',
    data: timerData
  });
  
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    } else {
      clients.delete(client);
    }
  });
  
  if (clients.size > 0) {
    console.log(`📡 Timer broadcast vers ${clients.size} clients: ${timerData.timeRemaining}s`);
  }
}

// Fonction pour broadcaster les transitions d'étapes avec loading synchronisé
function broadcastStepTransition(fromStep, toStep, loadingDuration = 2000) {
  const message = JSON.stringify({
    type: 'step-transition',
    data: {
      fromStep,
      toStep,
      loadingDuration,
      timestamp: Date.now()
    }
  });
  
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    } else {
      clients.delete(client);
    }
  });
  
  console.log(`📡 Step transition broadcast vers ${clients.size} clients: ${fromStep} -> ${toStep}`);
  
  // Programmer l'activation de la nouvelle étape après le loading
  setTimeout(() => {
    const activationMessage = JSON.stringify({
      type: 'step-activation',
      data: {
        step: toStep,
        timestamp: Date.now()
      }
    });
    
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(activationMessage);
      }
    });
    
    console.log(`📡 Step activation broadcast vers ${clients.size} clients: ${toStep}`);
  }, loadingDuration);
}

// Timer serveur qui broadcast en temps réel toutes les 100ms
let serverTimerInterval;

function startServerTimer() {
  if (serverTimerInterval) {
    clearInterval(serverTimerInterval);
  }
  
  serverTimerInterval = setInterval(() => {
    // Récupérer l'état actuel du timer
    db.get('SELECT step, currentQuestionIndex, questionStartTime, questionStartTimes FROM quiz_state WHERE id = 1',
      (err, row) => {
        if (err || !row) return;
        
        const TIMER_MAX = 20;
        const serverTime = Date.now();
        let timeRemaining = 0;
        let isTimerActive = false;
        let countdownToStart = 0;
        
        if (row?.questionStartTime && row?.questionStartTime > 0 && row?.step === 'question') {
          const timeDiff = row.questionStartTime - serverTime;
          
          if (timeDiff > 0) {
            // Countdown mode
            countdownToStart = Math.ceil(timeDiff / 1000);
            isTimerActive = false;
            timeRemaining = countdownToStart;
          } else {
            // Timer actif
            const elapsedMs = serverTime - row.questionStartTime;
            const elapsedSeconds = elapsedMs / 1000;
            const preciseRemaining = Math.max(0, TIMER_MAX - elapsedSeconds);
            timeRemaining = Math.floor(preciseRemaining);
            isTimerActive = preciseRemaining > 0;
            countdownToStart = 0;
          }
          
          // Broadcaster seulement si timer actif ou countdown
          if (isTimerActive || countdownToStart > 0) {
            broadcastTimerUpdate({
              timeRemaining: timeRemaining,
              timerMax: TIMER_MAX,
              isTimerActive: isTimerActive,
              countdownToStart: countdownToStart,
              serverTime: serverTime,
              questionStartTime: row.questionStartTime, // ✅ Inclure questionStartTime du serveur
              step: row.step,
              currentQuestionIndex: row.currentQuestionIndex
            });
          } else if (!isTimerActive && timeRemaining <= 0 && row.step === 'question') {
            // ✅ Timer expiré - basculer automatiquement vers 'result'
            console.log('⏰ Timer expiré, basculement automatique vers result');
            db.run('UPDATE quiz_state SET step = ? WHERE id = 1', ['result'], (updateErr) => {
              if (updateErr) {
                console.error('❌ Erreur basculement vers result:', updateErr);
              } else {
                console.log('✅ Basculement automatique vers result réussi');
              }
            });
          }
        }
      }
    );
  }, 100); // Broadcast toutes les 100ms
}

// Démarrer le timer serveur
startServerTimer();

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
        const serverTime = Date.now();
        
        // Calculer le temps restant côté serveur pour synchronisation parfaite
        let timeRemaining = 0;
        let isTimerActive = false;
        let countdownToStart = 0;
        let preciseTimeRemaining = 0; // Version plus précise avec décimales
        
        if (row?.questionStartTime && row?.step === 'question') {
          const timeDiff = row.questionStartTime - serverTime;
          
          if (timeDiff > 0) {
            // Question pas encore démarrée - mode countdown
            countdownToStart = Math.ceil(timeDiff / 1000);
            isTimerActive = false;
            timeRemaining = TIMER_MAX; // Prêt à démarrer
            preciseTimeRemaining = TIMER_MAX;
          } else {
            // Question en cours - calcul ultra-précis
            const elapsedMs = serverTime - row.questionStartTime;
            const elapsedSeconds = elapsedMs / 1000;
            preciseTimeRemaining = Math.max(0, TIMER_MAX - elapsedSeconds);
            timeRemaining = Math.max(0, Math.floor(preciseTimeRemaining));
            isTimerActive = preciseTimeRemaining > 0;
            countdownToStart = 0;
          }
        }
        
        const state = {
          step: row?.step || 'lobby',
          currentQuestionIndex: row?.currentQuestionIndex || 0,
          questionStartTime: row?.questionStartTime || null,
          questionStartTimes: JSON.parse(row?.questionStartTimes || '{}'),
          timerMax: TIMER_MAX,
          // Nouveaux champs pour synchronisation parfaite
          timeRemaining: timeRemaining,
          preciseTimeRemaining: preciseTimeRemaining, // Temps avec décimales pour sync parfaite
          isTimerActive: isTimerActive,
          serverTime: serverTime, // Timestamp serveur pour référence
          countdownToStart: countdownToStart // Compte à rebours avant démarrage
        };
        
        // Log pour debugging
        if (countdownToStart > 0) {
          console.log(`⏳ Question démarre dans ${countdownToStart}s`);
        } else if (isTimerActive) {
          console.log(`⏱️  Timer actif: ${timeRemaining}s restant`);
        }
        
        res.json(state);
      }
    });
});

// Mettre à jour l'état du quiz
app.put('/api/quiz-state', (req, res) => {
  const { step, currentQuestionIndex, questionStartTime, questionStartTimes } = req.body;

  let updateFields = [];
  let updateValues = [];

    // On récupère l'état actuel pour détecter le changement de question et d'étape
    db.get('SELECT step, currentQuestionIndex, questionStartTime, questionStartTimes FROM quiz_state WHERE id = 1', (err, row) => {
      if (err) {
        console.error('Erreur lecture quiz_state:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      let oldStep = row?.step || 'lobby';
      let oldQuestionIndex = row?.currentQuestionIndex ?? 0;
      let oldStartTimes = JSON.parse(row?.questionStartTimes || '{}');
      let newStartTime = row?.questionStartTime;

      // Si on change de question, on réinitialise le timestamp mais on ne démarre pas le timer automatiquement
      if (typeof currentQuestionIndex === 'number' && currentQuestionIndex !== oldQuestionIndex) {
        // Réinitialiser le questionStartTime à 0 pour indiquer que le timer n'est pas encore démarré
        newStartTime = 0; // 0 = timer pas encore démarré manuellement
        oldStartTimes[currentQuestionIndex] = newStartTime;
        console.log('[TIMER] Nouvelle question détectée, timer non démarré (démarrage manuel requis)');
      }
      
      // IMPORTANT: Forcer la réinitialisation du timer chaque fois qu'on passe à l'étape "question"
      // pour s'assurer que le timer ne démarre pas automatiquement
      if (step === 'question') {
        newStartTime = 0;
        console.log('[TIMER] Passage à l\'étape question - timer réinitialisé (démarrage manuel requis)');
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
      // On force la mise à jour du timer si nouvelle question OU si passage à l'étape question
      if ((typeof currentQuestionIndex === 'number' && currentQuestionIndex !== oldQuestionIndex) || step === 'question') {
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
          // Broadcaster la transition d'étape synchronisée si l'étape a changé
          if (step && step !== oldStep) {
            console.log(`🔄 Changement d'étape détecté: ${oldStep} -> ${step}`);
            broadcastStepTransition(oldStep, step, 2000); // 2 secondes de loading
          }
          
          res.json({ success: true });
        }
      });
    });
});

// Démarrer manuellement le timer (synchronisé via WebSocket)
app.post('/api/start-timer', (req, res) => {
  const { duration = 20, currentQuestionIndex } = req.body;
  
  console.log('[MANUAL-TIMER] Démarrage manuel du timer:', { duration, currentQuestionIndex });
  
  // Mettre à jour la base de données avec le nouveau timestamp
  const questionStartTime = Date.now();
  
  db.run(
    'UPDATE quiz_state SET questionStartTime = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = 1',
    [questionStartTime],
    function(err) {
      if (err) {
        console.error('[MANUAL-TIMER] Erreur mise à jour timer:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      
      // Broadcaster immédiatement le démarrage du timer à tous les clients
      const timerData = {
        timeRemaining: duration,
        timerMax: duration,
        isTimerActive: true,
        questionStartTime: questionStartTime,
        currentQuestionIndex: currentQuestionIndex || 0,
        serverTime: Date.now(),
        countdownToStart: 0
      };
      
      broadcastTimerUpdate(timerData);
      
      console.log('[MANUAL-TIMER] Timer démarré et diffusé:', timerData);
      res.json({ 
        success: true, 
        questionStartTime,
        message: 'Timer démarré et synchronisé avec tous les clients'
      });
    }
  );
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

    server.listen(PORT, () => {
      console.log(`🚀 Serveur SQLite + WebSocket démarré`);
      console.log(`📊 Base de données: ${dbPath}`);
      console.log(`🌐 API + WebSocket disponible sur: http://localhost:${PORT}`);
      console.log(`🔌 WebSocket prêt pour synchronisation temps réel`);
      console.log('[DEBUG] 3. Serveur en écoute avec WebSocket');
    });
    
    console.log('[DEBUG] 4. server.listen (WebSocket) appelé');
    
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
