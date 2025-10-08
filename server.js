const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');

const app = express();
// L'endpoint pour forcer la fin du timer (skip) a été supprimé car il n'est plus utilisé
// Configuration du stockage des images
// Expose le dossier d'images en statique pour le frontend
app.use('/assets/img', express.static(path.join(__dirname, 'public', 'assets', 'img')));
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'public', 'assets', 'img'));
  },
  filename: function (req, file, cb) {
    // Nom unique : timestamp + nom original
    const uniqueName = Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
    cb(null, uniqueName);
  }
});
const upload = multer({ storage: storage });
const server = http.createServer(app);

// Configuration WebSocket sur la racine pour compatibilité avec client actuel
const wss = new WebSocket.Server({ 
  server: server
  // Pas de path spécifié pour écouter sur la racine
});

const PORT = process.env.PORT || 3000;

// WebSocket connections pour synchronisation temps réel
const clients = new Set();

wss.on('connection', (ws) => {
  // console.log('🔌 Nouveau client WebSocket connecté');
  clients.add(ws);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Si c'est un message de score utilisateur, vérifier d'abord si l'utilisateur est valide
      if (data.type === 'user-score') {
        const userId = data.data.userId;
        const userName = data.data.userName;
        let scoreValue = data.data.score;
        const questionIndex = data.data.questionIndex;
        
        console.log(`📊 Score reçu pour l'utilisateur ${userName} (${userId}): ${scoreValue}`);
        
        // Vérifier que le score n'est pas excessif (protection anti-triche)
        const SCORE_MAX_PAR_QUESTION = 1000; // Valeur maximale théorique pour une question
        if (scoreValue > SCORE_MAX_PAR_QUESTION) {
          console.log(`⚠️ Score suspect détecté: ${userName} (${userId}) → ${scoreValue} points. Score limité à ${SCORE_MAX_PAR_QUESTION}`);
          scoreValue = SCORE_MAX_PAR_QUESTION;
        }
        
        // Vérifier si l'utilisateur est enregistré comme participant légitime
        db.get('SELECT id, score as currentScore FROM participants WHERE id = ?', [userId], (err, participant) => {
          if (err) {
            console.error('❌ Erreur vérification participant pour score:', err);
            return;
          }
          
          // Si le participant n'existe pas, rejeter le score
          if (!participant) {
            console.log(`🚫 Score rejeté: utilisateur non autorisé ${userName} (${userId})`);
            return;
          }
          
          // Mettre à jour le score dans la base de données pour persistance
          db.run('UPDATE participants SET score = ? WHERE id = ?', 
            [scoreValue, userId], 
            function(err) {
              if (err) {
                console.error(`❌ Erreur mise à jour score dans la base de données pour ${userName} (${userId}):`, err);
                return;
              }
              
              console.log(`💾 Score enregistré dans la base de données: ${userName} (${userId}) → ${scoreValue}`);
              
              // Créer le message à broadcaster pour un participant légitime
              const scoreMessage = JSON.stringify({
                type: 'user-score',
                data: {
                  userId: userId,
                  userName: userName,
                  score: scoreValue,
                  questionIndex: questionIndex,
                  timestamp: Date.now()
                }
              });
              
              // Envoyer à tous les clients connectés
              clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(scoreMessage);
                } else {
                  clients.delete(client);
                }
              });
              
              console.log(`📡 Score validé et broadcast vers ${clients.size} clients`);
            });
        });
      }
    } catch (error) {
      console.error('❌ Erreur de parsing du message WebSocket:', error);
    }
  });
  
  ws.on('close', () => {
  // console.log('🔌 Client WebSocket déconnecté');
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
  
  // if (clients.size > 0) {
  //   console.log(`📡 Timer broadcast vers ${clients.size} clients: ${timerData.timeRemaining}s`);
  // }
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
  
  // console.log(`📡 Step transition broadcast vers ${clients.size} clients: ${fromStep} -> ${toStep}`);
  
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
    
  // console.log(`📡 Step activation broadcast vers ${clients.size} clients: ${toStep}`);
  }, loadingDuration);
}

// Fonction pour broadcaster les changements de questions
function broadcastQuestionsSync() {
  const message = JSON.stringify({
    type: 'questions-sync',
    data: {
      timestamp: Date.now(),
      action: 'reload'
    }
  });
  
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    } else {
      clients.delete(client);
    }
  });
  
  // console.log(`🔄 Questions sync broadcast vers ${clients.size} clients`);
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
        let shouldBroadcast = false;
        
        if (row?.questionStartTime && row?.questionStartTime > 0) {
          const timeDiff = row.questionStartTime - serverTime;
          
          if (timeDiff > 0) {
            // Countdown mode
            countdownToStart = Math.ceil(timeDiff / 1000);
            isTimerActive = false;
            timeRemaining = countdownToStart;
            shouldBroadcast = row.step === 'question';
          } else {
            // Timer actif ou expiré
            const elapsedMs = serverTime - row.questionStartTime;
            const elapsedSeconds = elapsedMs / 1000;
            const preciseRemaining = Math.max(0, TIMER_MAX - elapsedSeconds);
            timeRemaining = Math.floor(preciseRemaining);
            isTimerActive = preciseRemaining > 0;
            countdownToStart = 0;
            shouldBroadcast = true; // Toujours broadcaster quand le timer a été démarré
            
            // Timer expiré - basculer automatiquement vers 'result'
            if (!isTimerActive && timeRemaining <= 0 && row.step === 'question') {
              console.log('⏰ Timer expiré, basculement automatique vers result');
  // console.log('⏰ Timer expiré, basculement automatique vers result');
              db.run('UPDATE quiz_state SET step = ? WHERE id = 1', ['result'], (updateErr) => {
                if (updateErr) {
                  console.error('❌ Erreur basculement vers result:', updateErr);
                } else {
                  console.log('✅ Basculement automatique vers result réussi');
  // console.log('✅ Basculement automatique vers result réussi');
                  // ✅ NOUVEAU: Broadcaster immédiatement la transition d'étape
                  broadcastStepTransition('question', 'result', 500); // Transition rapide de 500ms
                }
              });
            }
          }
          
          // Broadcaster l'état du timer
          if (shouldBroadcast) {
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
          }
        } else {
          // Aucun timer démarré - broadcaster l'état par défaut si on est en étape question
          if (row.step === 'question') {
            broadcastTimerUpdate({
              timeRemaining: TIMER_MAX,
              timerMax: TIMER_MAX,
              isTimerActive: false,
              countdownToStart: 0,
              serverTime: serverTime,
              questionStartTime: null, // Timer pas encore démarré
              step: row.step,
              currentQuestionIndex: row.currentQuestionIndex
            });
          }
        }
      }
    );
  }, 200); // Broadcast toutes les 200ms pour réduire la charge serveur en production
}

// Démarrer le timer serveur
startServerTimer();

// Configuration CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [
        'https://frontendurl',
        'http://localhost:4200' // Ajouter l'URL de développement Angular
      ]
    : true, // En développement, autoriser toutes les origines
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Route d’upload d’image
app.post('/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier reçu' });
  }
  // URL accessible depuis le frontend
  const imageUrl = `/assets/img/${req.file.filename}`;
  res.json({ url: imageUrl });
});

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
  // console.log('✅ Base de données SQLite connectée:', dbPath);
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
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        "order" INTEGER DEFAULT NULL
      )`);

      // Migration douce pour les colonnes manquantes
      db.all("PRAGMA table_info(questions)", (err, columns) => {
        if (Array.isArray(columns)) {
          // Ajout du champ 'order'
          if (!columns.some(col => col.name === 'order')) {
            db.run('ALTER TABLE questions ADD COLUMN "order" INTEGER DEFAULT NULL');
          }
          
          // Ajout des champs pour les images
          if (!columns.some(col => col.name === 'imageUrl')) {
            db.run('ALTER TABLE questions ADD COLUMN imageUrl TEXT DEFAULT ""');
          }
          
          if (!columns.some(col => col.name === 'imageUrlResult')) {
            db.run('ALTER TABLE questions ADD COLUMN imageUrlResult TEXT DEFAULT ""');
          }
          
          if (!columns.some(col => col.name === 'imageUrlEnd')) {
            db.run('ALTER TABLE questions ADD COLUMN imageUrlEnd TEXT DEFAULT ""');
          }
        }
      });
// Endpoint pour réordonner les questions (admin)
app.post('/api/admin/questions/reorder', requireAdminAuth, (req, res) => {
  const { order } = req.body; // Tableau d'IDs dans le nouvel ordre
  if (!Array.isArray(order) || order.length === 0) {
    return res.status(400).json({ error: 'Format de l\'ordre invalide' });
  }
  // Mettre à jour le champ 'order' pour chaque question
  const updateQueries = order.map((id, idx) => {
    return new Promise((resolve, reject) => {
      db.run('UPDATE questions SET "order" = ? WHERE id = ?', [idx, id], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  });
  Promise.all(updateQueries)
    .then(() => {
      // Diffuser la synchro questions (pour forcer le reload côté clients)
      broadcastQuestionsSync();
      res.json({ success: true, message: 'Ordre des questions mis à jour' });
    })
    .catch((err) => {
      console.error('Erreur update ordre questions:', err);
      res.status(500).json({ error: 'Erreur serveur lors du réordonnancement' });
    });
});

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

      // Ne plus insérer de questions par défaut automatiquement
      console.log('✅ Base de données initialisée avec les tables (sans questions par défaut)');
  // console.log('✅ Base de données initialisée avec les tables (sans questions par défaut)');
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
  db.all('SELECT id, text, options, correctIndex, imageUrl, imageUrlResult, imageUrlEnd FROM questions ORDER BY COALESCE("order", id)', (err, rows) => {
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

// Mettre à jour l’URL d’image d’une question
app.patch('/api/questions/:id/image', (req, res) => {
  const questionId = req.params.id;
  const { imageUrl } = req.body;
  if (!imageUrl) {
    return res.status(400).json({ error: 'imageUrl manquant' });
  }
  db.run('UPDATE questions SET imageUrl = ? WHERE id = ?', [imageUrl, questionId], function(err) {
    if (err) {
      console.error('Erreur mise à jour imageUrl:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    } else {
      res.json({ success: true, id: questionId, imageUrl });
    }
  });
});

// Ajouter une question
app.post('/api/questions', (req, res) => {
  const { id, text, options, correctIndex, imageUrl, imageUrlResult, imageUrlEnd } = req.body;

  if (!text || !options || typeof correctIndex !== 'number') {
    return res.status(400).json({ error: 'Données manquantes' });
  }

  const optionsJson = JSON.stringify(options);

  db.run('INSERT OR REPLACE INTO questions (id, text, options, correctIndex, imageUrl, imageUrlResult, imageUrlEnd) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, text, optionsJson, correctIndex, imageUrl || '', imageUrlResult || '', imageUrlEnd || ''],
    function(err) {
      if (err) {
        console.error('Erreur ajout question:', err);
        res.status(500).json({ error: 'Erreur serveur' });
      } else {
        res.json({
          success: true,
          question: { id, text, options, correctIndex, imageUrl, imageUrlResult, imageUrlEnd }
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

// Mettre à jour le score d'un participant
app.put('/api/participants/:userId/score', (req, res) => {
  const userId = req.params.userId;
  const { score, name, userName } = req.body;
  
  console.log(`[API] Mise à jour du score pour le participant ${userId}: ${score}`);
  
  if (!userId) {
    return res.status(400).json({ error: 'ID utilisateur manquant' });
  }
  
  // Vérifier l'état actuel du quiz et si le participant existe
  db.get('SELECT step FROM quiz_state WHERE id = 1', (err, quizState) => {
    if (err) {
      console.error('Erreur vérification état quiz:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    db.get('SELECT id FROM participants WHERE id = ?', [userId], (err, row) => {
      if (err) {
        console.error('Erreur vérification participant:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      
      // Si le participant n'existe pas
      if (!row) {
        // Si le quiz n'est plus en phase de lobby ou d'attente, refuser l'ajout de nouveaux participants
        if (quizState && quizState.step !== 'lobby' && quizState.step !== 'waiting') {
          console.log(`🚫 Création de participant refusée pour ${userId}: le quiz est déjà en cours (étape: ${quizState.step})`);
          return res.status(403).json({ 
            error: 'Les inscriptions sont fermées, le quiz a déjà commencé',
            step: quizState.step 
          });
        }

        const participantName = name || userName || 'Participant inconnu';
        console.log(`[API] Participant ${userId} non trouvé, création avec nom=${participantName}`);
        
        db.run('INSERT INTO participants (id, name, score) VALUES (?, ?, ?)',
          [userId, participantName, score || 0],
          function(err) {
            if (err) {
              console.error('Erreur création participant:', err);
              return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            console.log(`[API] Participant ${userId} créé avec succès`);
            return res.json({ 
              success: true,
              message: 'Participant créé et score mis à jour',
              userId,
              score: score || 0
            });
          });
      } else {
        // Mettre à jour le score du participant existant
      db.run('UPDATE participants SET score = ? WHERE id = ?',
        [score || 0, userId],
        function(err) {
          if (err) {
            console.error('Erreur mise à jour score:', err);
            return res.status(500).json({ error: 'Erreur serveur' });
          }
          
          console.log(`[API] Score du participant ${userId} mis à jour avec succès: ${score}`);
          return res.json({
            success: true,
            message: 'Score mis à jour',
            userId,
            score: score || 0
          });
        });
      }
    });
  });
});

// Créer un participant
app.post('/api/participants', (req, res) => {
  const { id, name, avatarUrl } = req.body;

  if (!id || !name) {
    return res.status(400).json({ error: 'ID et nom requis' });
  }

  // Vérifier d'abord l'état actuel du quiz
  db.get('SELECT step FROM quiz_state WHERE id = 1', (err, quizState) => {
    if (err) {
      console.error('Erreur vérification état quiz:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    
    // Si le quiz n'est plus en phase de lobby ou d'attente, refuser les inscriptions
    if (quizState && quizState.step !== 'lobby' && quizState.step !== 'waiting') {
      console.log(`🚫 Inscription refusée pour ${name} (${id}): le quiz est déjà en cours (étape: ${quizState.step})`);
      return res.status(403).json({ 
        error: 'Les inscriptions sont fermées, le quiz a déjà commencé',
        step: quizState.step 
      });
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
          console.log(`✅ Nouveau participant inscrit: ${name} (${id})`);
          res.json({ success: true, participant });
        }
      });
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

// Fonction utilitaire pour calculer et mettre à jour le score d'un participant
function calculateAndUpdateScore(userId, userName, questionIndex, answerIndex, callback) {
  // D'abord, charger la question pour vérifier si la réponse est correcte
  db.get('SELECT correctIndex FROM questions WHERE id = ?', [questionIndex], (err, question) => {
    if (err) {
      return callback(err, null);
    }
    
    if (!question) {
      return callback(new Error('Question non trouvée'), null);
    }
    
    const isCorrect = answerIndex === question.correctIndex;
    console.log(`📊 Réponse ${answerIndex} pour question ${questionIndex}: ${isCorrect ? 'CORRECTE' : 'INCORRECTE'} (attendue: ${question.correctIndex})`);
    
    // Calculer le score total du participant en comptant toutes ses bonnes réponses
    db.all(`SELECT a.questionIndex, a.answerIndex, q.correctIndex 
            FROM answers a 
            JOIN questions q ON a.questionIndex = q.id 
            WHERE a.userId = ?`, [userId], (err, userAnswers) => {
      if (err) {
        return callback(err, null);
      }
      
      // Compter les bonnes réponses
      const correctAnswers = userAnswers.filter(answer => answer.answerIndex === answer.correctIndex);
      const totalScore = correctAnswers.length;
      
      console.log(`🎯 ${userName} (${userId}): ${correctAnswers.length} bonnes réponses sur ${userAnswers.length} total`);
      
      // Mettre à jour le score dans la table participants
      db.run('UPDATE participants SET score = ? WHERE id = ?', [totalScore, userId], function(updateErr) {
        if (updateErr) {
          return callback(updateErr, null);
        }
        
        console.log(`💾 Score mis à jour dans la BDD: ${userName} (${userId}) → ${totalScore} points`);
        callback(null, totalScore);
      });
    });
  });
}

// Soumission d'une réponse
app.post('/api/answers', (req, res) => {
  const { questionIndex, userId, userName, answerIndex } = req.body;

  if (typeof questionIndex !== 'number' || !userId || !userName || typeof answerIndex !== 'number') {
    return res.status(400).json({ error: 'Données manquantes' });
  }

  // ✅ PROTECTION: Vérifier si l'utilisateur a déjà voté pour cette question
  db.get('SELECT id FROM answers WHERE questionIndex = ? AND userId = ?',
    [questionIndex, userId],
    (err, existingAnswer) => {
      if (err) {
        console.error('Erreur vérification réponse existante:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }

      if (existingAnswer) {
        console.log(`❌ Vote rejeté - L'utilisateur ${userId} a déjà voté pour la question ${questionIndex}`);
  // console.log(`❌ Vote rejeté - L'utilisateur ${userId} a déjà voté pour la question ${questionIndex}`);
        return res.status(400).json({ 
          error: 'Vous avez déjà voté pour cette question',
          alreadyAnswered: true 
        });
      }

      // Insérer la réponse si pas de doublon
      db.run('INSERT INTO answers (questionIndex, userId, userName, answerIndex) VALUES (?, ?, ?, ?)',
        [questionIndex, userId, userName, answerIndex],
        function(err) {
          if (err) {
            console.error('Erreur soumission réponse:', err);
            res.status(500).json({ error: 'Erreur serveur' });
          } else {
            console.log(`✅ Vote accepté - Utilisateur ${userId} a voté ${answerIndex} pour la question ${questionIndex}`);
            
            // ✨ NOUVEAU: Calculer et mettre à jour le score du participant
            calculateAndUpdateScore(userId, userName, questionIndex, answerIndex, (scoreErr, newScore) => {
              if (scoreErr) {
                console.error('❌ Erreur calcul du score:', scoreErr);
                // Répondre quand même avec succès pour l'insertion de la réponse
                res.json({ success: true, answerId: this.lastID, scoreError: true });
              } else {
                console.log(`🏆 Score mis à jour: ${userName} (${userId}) → ${newScore} points`);
                res.json({ 
                  success: true, 
                  answerId: this.lastID, 
                  newScore: newScore,
                  scoreUpdated: true 
                });
              }
            });
          }
        });
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
          // console.log(`⏳ Question démarre dans ${countdownToStart}s`);
        } else if (isTimerActive) {
          console.log(`⏱️  Timer actif: ${timeRemaining}s restant`);
          // console.log(`⏱️  Timer actif: ${timeRemaining}s restant`);
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
  // console.log('[TIMER] Nouvelle question détectée, timer non démarré (démarrage manuel requis)');
      }
      
      // IMPORTANT: Forcer la réinitialisation du timer chaque fois qu'on passe à l'étape "question"
      // pour s'assurer que le timer ne démarre pas automatiquement
      if (step === 'question') {
        newStartTime = 0;
        console.log('[TIMER] Passage à l\'étape question - timer réinitialisé (démarrage manuel requis)');
  // console.log('[TIMER] Passage à l\'étape question - timer réinitialisé (démarrage manuel requis)');
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
            // console.log(`🔄 Changement d'étape détecté: ${oldStep} -> ${step}`);
            
            // ✅ NOUVEAU: Transitions plus rapides pour certains cas
            let loadingDuration = 2000; // 2 secondes par défaut
            
            // Transitions rapides pour l'affichage des résultats (skip, timer expiré)
            if (step === 'result' && oldStep === 'question') {
              loadingDuration = 300; // 300ms seulement pour l'affichage immédiat des résultats
              console.log(`⚡ Transition rapide question->result (${loadingDuration}ms)`);
              // console.log(`⚡ Transition rapide question->result (${loadingDuration}ms)`);
            }
            
            // Transition rapide pour lobby->waiting
            if (step === 'waiting' && oldStep === 'lobby') {
              loadingDuration = 300; // 300ms seulement pour passer rapidement à l'étape waiting
              console.log(`⚡ Transition rapide lobby->waiting (${loadingDuration}ms) - amélioration bouton Start`);
            }
            
            broadcastStepTransition(oldStep, step, loadingDuration);
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
  // console.log('[MANUAL-TIMER] Démarrage manuel du timer:', { duration, currentQuestionIndex });
  
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
  // console.log('[MANUAL-TIMER] Timer démarré et diffusé:', timerData);
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
  console.log(`[AUTH] Tentative connexion admin. Saisi: '${password}', Attendu: '${ADMIN_PASSWORD}'`);
  // console.log(`[AUTH] Tentative connexion admin. Saisi: '${password}', Attendu: '${ADMIN_PASSWORD}'`);
  if (password !== ADMIN_PASSWORD) {
    console.warn(`[AUTH] Échec admin. Saisi: '${password}', Attendu: '${ADMIN_PASSWORD}'`);
    return res.status(401).json({ error: 'Mot de passe administrateur incorrect' });
  }
  next();
}

// Lister toutes les questions
app.post('/api/admin/questions', requireAdminAuth, (req, res) => {
  db.all('SELECT * FROM questions ORDER BY COALESCE("order", id)', (err, rows) => {
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
  const { text, options, correctIndex, imageUrl, imageUrlResult, imageUrlEnd } = req.body;
  
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
    'INSERT INTO questions (text, options, correctIndex, imageUrl, imageUrlResult, imageUrlEnd) VALUES (?, ?, ?, ?, ?, ?)',
    [text, JSON.stringify(options), correctIndex, imageUrl || '', imageUrlResult || '', imageUrlEnd || ''],
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
  const { text, options, correctIndex, imageUrl, imageUrlResult } = req.body;

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
    'UPDATE questions SET text = ?, options = ?, correctIndex = ?, imageUrl = ?, imageUrlResult = ? WHERE id = ?',
    [text, JSON.stringify(options), correctIndex, imageUrl || '', imageUrlResult || '', id],
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

// Corriger les IDs des questions pour les faire correspondre à leurs indices
app.post('/api/admin/fix-question-ids', (req, res) => {
  const { updates } = req.body;

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ error: 'Format des mises à jour invalide' });
  }

  console.log('[QUESTION-ID-FIX] Début de la correction des IDs de questions:', updates);

  // Créer une table temporaire pour stocker les questions pendant la mise à jour
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Créer une table temporaire
    db.run(`CREATE TEMPORARY TABLE temp_questions AS SELECT * FROM questions`);

    // Vider la table originale
    db.run('DELETE FROM questions');

    // Fonction récursive pour réinsérer les questions avec les bons IDs
    const insertWithNewIds = (index) => {
      if (index >= updates.length) {
        // Terminer la transaction quand toutes les questions sont traitées
        db.run('COMMIT', (commitErr) => {
          if (commitErr) {
            console.error('[QUESTION-ID-FIX] Erreur commit transaction:', commitErr);
            return res.status(500).json({ error: 'Erreur lors de la validation des modifications' });
          }

          console.log('[QUESTION-ID-FIX] IDs de questions corrigés avec succès');

          // Broadcast pour synchroniser les questions mises à jour
          broadcastQuestionsSync();
          
          return res.json({
            success: true,
            message: `${updates.length} questions ont été mises à jour avec succès`,
            updatedCount: updates.length
          });
        });
        return;
      }

      const update = updates[index];
      
      // Récupérer la question originale depuis la table temporaire
      db.get('SELECT * FROM temp_questions WHERE id = ?', [update.id], (err, question) => {
        if (err) {
          console.error(`[QUESTION-ID-FIX] Erreur lecture question ${update.id}:`, err);
          db.run('ROLLBACK');
          return res.status(500).json({ error: `Erreur lors de la lecture de la question ${update.id}` });
        }

        if (!question) {
          console.error(`[QUESTION-ID-FIX] Question ${update.id} non trouvée`);
          insertWithNewIds(index + 1); // Passer à la question suivante
          return;
        }

        // Insérer la question avec le nouvel ID
        db.run(
          'INSERT INTO questions (id, text, options, correctIndex, imageUrl, imageUrlResult, imageUrlEnd, "order") VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            update.newId,
            question.text,
            question.options,
            question.correctIndex,
            question.imageUrl || '',
            question.imageUrlResult || '',
            question.imageUrlEnd || '',
            question.order
          ],
          (insertErr) => {
            if (insertErr) {
              console.error(`[QUESTION-ID-FIX] Erreur insertion question avec ID=${update.newId}:`, insertErr);
              db.run('ROLLBACK');
              return res.status(500).json({ error: `Erreur lors de l'insertion de la question avec le nouvel ID ${update.newId}` });
            }

            console.log(`[QUESTION-ID-FIX] Question ID ${update.id} -> ${update.newId} mise à jour avec succès`);
            insertWithNewIds(index + 1); // Passer à la question suivante
          }
        );
      });
    };

    // Démarrer le processus d'insertion
    insertWithNewIds(0);
  });
});

// Reset complet du quiz - SÉCURISÉ avec mot de passe admin
app.post('/api/quiz/reset', requireAdminAuth, (req, res) => {
  console.log('🔄 Demande de reset quiz avec authentification admin');
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
          // CORRECTION: Broadcaster un message de reset pour s'assurer que tous les clients nettoient leurs caches
          const resetMessage = JSON.stringify({
            type: 'quiz-reset',
            data: {
              timestamp: Date.now(),
              action: 'reset-all'
            }
          });
          
          // Envoyer le message à tous les clients connectés
          clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(resetMessage);
            } else {
              clients.delete(client);
            }
          });
          
          console.log(`📢 Message de reset diffusé à ${clients.size} clients`);
          
          res.json({
            success: true,
            message: 'Quiz reset avec succès',
            database: 'SQLite'
          });
        }
      });
  });
});

// Endpoint pour déclencher la synchronisation des questions - SÉCURISÉ
app.post('/api/quiz/sync-questions', requireAdminAuth, async (req, res) => {
  console.log('🔄 Demande de sync questions avec authentification admin');
  try {
    console.log('🔄 Déclenchement synchronisation questions via WebSocket');
    // Broadcaster la notification de synchronisation
    broadcastQuestionsSync();

    // Appeler le reset juste après la synchro
    db.serialize(() => {
      db.run('DELETE FROM participants');
      db.run('DELETE FROM answers');
      db.run('UPDATE quiz_state SET step = ?, currentQuestionIndex = ?, questionStartTime = ?, questionStartTimes = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = 1',
        ['lobby', 0, Date.now(), '{}'],
        function(err) {
          if (err) {
            console.error('Erreur reset quiz après sync:', err);
            res.status(500).json({ success: false, error: 'Erreur reset quiz après sync' });
          } else {
            res.json({
              success: true,
              message: 'Questions synchronization broadcast sent + quiz reset',
              timestamp: Date.now()
            });
          }
        });
    });
  } catch (error) {
    console.error('❌ Erreur synchronisation questions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
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

// === ENDPOINTS ADMIN CRUD COMPLET ===

// CRUD Participants
app.post('/api/admin/participants', requireAdminAuth, (req, res) => {
  db.all('SELECT * FROM participants ORDER BY createdAt DESC', (err, rows) => {
    if (err) {
      console.error('Erreur récupération participants:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    } else {
      const participants = rows.map(row => ({
        ...row,
        answers: JSON.parse(row.answers || '[]')
      }));
      res.json(participants);
    }
  });
});

app.put('/api/admin/participants/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const { name, score, avatarUrl } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Le nom est requis' });
  }

  db.run(
    'UPDATE participants SET name = ?, score = ?, avatarUrl = ? WHERE id = ?',
    [name, score || 0, avatarUrl || null, id],
    function(err) {
      if (err) {
        console.error('Erreur modification participant:', err);
        res.status(500).json({ error: 'Erreur serveur' });
      } else if (this.changes === 0) {
        res.status(404).json({ error: 'Participant non trouvé' });
      } else {
        res.json({ 
          success: true,
          message: 'Participant modifié avec succès'
        });
      }
    }
  );
});

app.delete('/api/admin/participants/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Mot de passe administrateur incorrect' });
  }

  db.serialize(() => {
    // Supprimer les réponses associées
    db.run('DELETE FROM answers WHERE userId = ?', [id]);
    // Supprimer le participant
    db.run('DELETE FROM participants WHERE id = ?', [id], function(err) {
      if (err) {
        console.error('Erreur suppression participant:', err);
        res.status(500).json({ error: 'Erreur serveur' });
      } else if (this.changes === 0) {
        res.status(404).json({ error: 'Participant non trouvé' });
      } else {
        res.json({ 
          success: true,
          message: 'Participant et ses réponses supprimés avec succès'
        });
      }
    });
  });
});

// CRUD Réponses
app.post('/api/admin/answers', requireAdminAuth, (req, res) => {
  db.all(`
    SELECT a.*, p.name as participantName 
    FROM answers a 
    LEFT JOIN participants p ON a.userId = p.id 
    ORDER BY a.timestamp DESC
  `, (err, rows) => {
    if (err) {
      console.error('Erreur récupération réponses:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    } else {
      res.json(rows);
    }
  });
});

app.delete('/api/admin/answers/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Mot de passe administrateur incorrect' });
  }

  db.run('DELETE FROM answers WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Erreur suppression réponse:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Réponse non trouvée' });
    } else {
      res.json({ 
        success: true,
        message: 'Réponse supprimée avec succès'
      });
    }
  });
});

// CRUD État du Quiz
app.post('/api/admin/quiz-state', requireAdminAuth, (req, res) => {
  db.get('SELECT * FROM quiz_state WHERE id = 1', (err, row) => {
    if (err) {
      console.error('Erreur récupération état quiz:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    } else {
      const state = {
        ...row,
        questionStartTimes: JSON.parse(row?.questionStartTimes || '{}')
      };
      res.json(state);
    }
  });
});

app.put('/api/admin/quiz-state/force', requireAdminAuth, (req, res) => {
  const { step, currentQuestionIndex, questionStartTime } = req.body;
  
  let updateFields = [];
  let updateValues = [];

  if (step) {
    updateFields.push('step = ?');
    updateValues.push(step);
  }
  if (typeof currentQuestionIndex === 'number') {
    updateFields.push('currentQuestionIndex = ?');
    updateValues.push(currentQuestionIndex);
  }
  if (questionStartTime !== undefined) {
    updateFields.push('questionStartTime = ?');
    updateValues.push(questionStartTime);
  }
  
  updateFields.push('updatedAt = CURRENT_TIMESTAMP');
  updateValues.push(1);

  const sql = `UPDATE quiz_state SET ${updateFields.join(', ')} WHERE id = ?`;
  
  db.run(sql, updateValues, function(err) {
    if (err) {
      console.error('Erreur modification forcée état quiz:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    } else {
      res.json({ 
        success: true,
        message: 'État du quiz modifié avec succès'
      });
    }
  });
});

// Statistiques globales pour le dashboard admin
app.post('/api/admin/stats', requireAdminAuth, (req, res) => {
  const stats = {};
  
  // Compter les questions
  db.get('SELECT COUNT(*) as count FROM questions', (err, questionsCount) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    stats.questions = questionsCount.count;
    
    // Compter les participants
    db.get('SELECT COUNT(*) as count FROM participants', (err, participantsCount) => {
      if (err) {
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      stats.participants = participantsCount.count;
      
      // Compter les réponses
      db.get('SELECT COUNT(*) as count FROM answers', (err, answersCount) => {
        if (err) {
          return res.status(500).json({ error: 'Erreur serveur' });
        }
        stats.answers = answersCount.count;
        
        // État actuel du quiz
        db.get('SELECT step, currentQuestionIndex FROM quiz_state WHERE id = 1', (err, quizState) => {
          if (err) {
            return res.status(500).json({ error: 'Erreur serveur' });
          }
          stats.currentStep = quizState?.step || 'lobby';
          stats.currentQuestionIndex = quizState?.currentQuestionIndex || 0;
          
          res.json(stats);
        });
      });
    });
  });
});

// Démarrage du serveur
async function startServer() {
  try {
  console.log('[DEBUG] 1. Début de startServer');
  console.log(`[INFO] Mot de passe admin utilisé : ${ADMIN_PASSWORD}`);
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
