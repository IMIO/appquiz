const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');

const app = express();
// Endpoint pour forcer la fin du timer (skip)
app.post('/api/quiz/skip-timer', (req, res) => {
  let responded = false;
  // Timeout de sécurité : 3 secondes max pour répondre
  const timeout = setTimeout(() => {
    if (!responded) {
      responded = true;
      console.error('⏰ Timeout /api/quiz/skip-timer');
      res.status(504).json({ error: 'Timeout serveur' });
    }
  }, 3000);
  try {
    db.get('SELECT step, currentQuestionIndex FROM quiz_state WHERE id = 1', (err, row) => {
      if (responded) return;
      if (err || !row) {
        clearTimeout(timeout);
        responded = true;
        console.error('❌ Erreur lecture état quiz:', err);
        return res.status(500).json({ error: 'Erreur lecture état quiz' });
      }
      if (row.step !== 'question') {
        clearTimeout(timeout);
        responded = true;
        return res.status(400).json({ error: 'Impossible de skip: pas en phase question' });
      }
      // Broadcast timer à 0
      broadcastTimerUpdate({
        timeRemaining: 0,
        timerMax: 20,
        isTimerActive: false,
        countdownToStart: 0,
        serverTime: Date.now(),
        questionStartTime: null,
        step: row.step,
        currentQuestionIndex: row.currentQuestionIndex
      });
      // Basculer l'étape vers 'result' immédiatement
      db.run('UPDATE quiz_state SET step = ? WHERE id = 1', ['result'], (updateErr) => {
        if (responded) return;
        clearTimeout(timeout);
        if (updateErr) {
          responded = true;
          console.error('❌ Erreur mise à jour étape:', updateErr);
          return res.status(500).json({ error: 'Erreur mise à jour étape' });
        }
        broadcastStepTransition('question', 'result', 300);
        responded = true;
        res.json({ success: true });
      });
    });
  } catch (e) {
    if (!responded) {
      clearTimeout(timeout);
      responded = true;
      console.error('❌ Exception /api/quiz/skip-timer:', e);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
});
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
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// WebSocket connections pour synchronisation temps réel
const clients = new Set();

wss.on('connection', (ws) => {
  // console.log('🔌 Nouveau client WebSocket connecté');
  clients.add(ws);
  
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

      // Ajout du champ 'order' si la table existe déjà (migration douce)
      db.all("PRAGMA table_info(questions)", (err, columns) => {
        if (Array.isArray(columns) && !columns.some(col => col.name === 'order')) {
          db.run('ALTER TABLE questions ADD COLUMN "order" INTEGER DEFAULT NULL');
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
            // console.log(`✅ Vote accepté - Utilisateur ${userId} a voté ${answerIndex} pour la question ${questionIndex}`);
            res.json({ success: true, answerId: this.lastID });
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

// Endpoint pour déclencher la synchronisation des questions
app.post('/api/quiz/sync-questions', async (req, res) => {
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
