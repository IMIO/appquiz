const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Cache en mémoire pour gérer les quotas Firebase
const cache = {
  questions: [],
  participants: [],
  quizState: { step: 'lobby', currentQuestionIndex: 0, questionStartTime: Date.now() },
  answers: {}, // { questionIndex: [answers] }
  lastUpdate: Date.now()
};

// Questions par défaut si Firebase est indisponible
const defaultQuestions = [
  {
    id: 1,
    text: "Quelle est la capitale de la France ?",
    options: ["Lyon", "Paris", "Marseille", "Bordeaux"],
    correctIndex: 1
  },
  {
    id: 2,
    text: "Combien font 2 + 2 ?",
    options: ["3", "4", "5", "6"],
    correctIndex: 1
  },
  {
    id: 3,
    text: "Quelle est la couleur du ciel par beau temps ?",
    options: ["Rouge", "Vert", "Bleu", "Jaune"],
    correctIndex: 2
  }
];

// Configuration CORS
app.use(cors({
  origin: ['http://localhost:4200', 'https://your-domain.com'],
  credentials: true
}));

app.use(express.json());

// Initialisation Firebase Admin avec serviceAccountKey.json
try {
  const serviceAccount = require('./serviceAccountKey.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
  });
  
  console.log('✅ Firebase Admin initialisé avec serviceAccountKey.json');
} catch (error) {
  console.error('❌ Erreur lors de l\'initialisation Firebase Admin:', error);
  console.error('⚠️  Assurez-vous que serviceAccountKey.json existe dans ce dossier');
  process.exit(1);
}

const db = admin.firestore();

// Middleware pour créer des tokens personnalisés
async function createCustomToken(req, res, next) {
  try {
    // Créer un token personnalisé avec des claims admin
    const customToken = await admin.auth().createCustomToken('admin-service-account', {
      admin: true,
      service: 'quiz-app'
    });
    req.customToken = customToken;
    next();
  } catch (error) {
    console.error('Erreur création token:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

// === ROUTES API ===

// Route de santé
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Serveur quiz avec Admin SDK opérationnel'
  });
});

// Obtenir un token d'authentification pour le frontend
app.post('/api/auth/token', createCustomToken, (req, res) => {
  res.json({ 
    token: req.customToken,
    message: 'Token créé avec succès'
  });
});

// === QUESTIONS ===

// Obtenir toutes les questions
app.get('/api/questions', async (req, res) => {
  try {
    // Essayer d'abord Firebase
    const questionsRef = db.collection('questions');
    const snapshot = await questionsRef.orderBy('id', 'asc').get();
    const questions = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));
    
    // Mettre à jour le cache
    cache.questions = questions;
    cache.lastUpdate = Date.now();
    
    res.json(questions);
  } catch (error) {
    console.error('Erreur récupération questions (utilisation du cache):', error.message);
    
    // En cas d'erreur (quota dépassé), utiliser le cache ou les questions par défaut
    if (cache.questions.length > 0) {
      res.json(cache.questions);
    } else {
      cache.questions = defaultQuestions;
      res.json(defaultQuestions);
    }
  }
});

// Ajouter une question (admin)
app.post('/api/questions', async (req, res) => {
  try {
    const { id, text, options, correctIndex } = req.body;
    
    if (!text || !options || typeof correctIndex !== 'number') {
      return res.status(400).json({ error: 'Données manquantes' });
    }
    
    const questionData = { id, text, options, correctIndex };
    await db.collection('questions').doc(String(id)).set(questionData);
    
    res.json({ success: true, question: questionData });
  } catch (error) {
    console.error('Erreur ajout question:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// === PARTICIPANTS ===

// Obtenir tous les participants
app.get('/api/participants', async (req, res) => {
  try {
    console.log('[DEBUG] GET /api/participants - Tentative Firebase...');
    const participantsRef = db.collection('participants');
    const snapshot = await participantsRef.get();
    const participants = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));
    
    // Mettre à jour le cache
    cache.participants = participants;
    console.log('[DEBUG] GET /api/participants - Firebase OK, participants:', participants.length);
    res.json(participants);
  } catch (error) {
    console.error('Erreur récupération participants (utilisation du cache):', error.message);
    console.log('[DEBUG] GET /api/participants - Cache utilisé, participants:', cache.participants.length);
    // Utiliser le cache en cas d'erreur
    res.json(cache.participants);
  }
});

// Créer un participant
app.post('/api/participants', async (req, res) => {
  try {
    const { id, name } = req.body;
    
    if (!id || !name) {
      return res.status(400).json({ error: 'ID et nom requis' });
    }
    
    const participant = {
      id,
      name: name.trim(),
      score: 0,
      answers: [],
      createdAt: new Date().toISOString()
    };
    
    try {
      await db.collection('participants').doc(id).set(participant);
    } catch (firebaseError) {
      console.error('Firebase non disponible, utilisation du cache seul');
    }
    
    // Ajouter au cache local
    const existingIndex = cache.participants.findIndex(p => p.id === id);
    if (existingIndex >= 0) {
      cache.participants[existingIndex] = participant;
    } else {
      cache.participants.push(participant);
    }
    
    res.json({ success: true, participant });
  } catch (error) {
    console.error('Erreur création participant:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// === RÉPONSES ===

// Obtenir les réponses pour une question
app.get('/api/answers/:questionIndex', async (req, res) => {
  try {
    const { questionIndex } = req.params;
    const answerDoc = await db.collection('answers').doc(questionIndex).get();
    
    if (answerDoc.exists) {
      res.json(answerDoc.data());
    } else {
      res.json({ answers: [] });
    }
  } catch (error) {
    console.error('Erreur récupération réponses:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Soumettre une réponse
app.post('/api/answers', async (req, res) => {
  try {
    const { questionIndex, userId, userName, answerIndex } = req.body;
    
    if (typeof questionIndex !== 'number' || !userId || !userName || typeof answerIndex !== 'number') {
      return res.status(400).json({ error: 'Données manquantes ou invalides' });
    }
    
    const answerData = {
      questionIndex,
      userId,
      userName,
      answerIndex,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Utiliser une transaction pour éviter les conflits
    await db.runTransaction(async (transaction) => {
      const answerRef = db.collection('answers').doc(String(questionIndex));
      const doc = await transaction.get(answerRef);
      
      if (!doc.exists) {
        // Créer le document avec la première réponse
        transaction.set(answerRef, { answers: [answerData] });
      } else {
        // Supprimer l'ancienne réponse de ce user et ajouter la nouvelle
        const existingAnswers = doc.data().answers || [];
        const filteredAnswers = existingAnswers.filter(a => a.userId !== userId);
        filteredAnswers.push(answerData);
        transaction.update(answerRef, { answers: filteredAnswers });
      }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur soumission réponse:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// === ÉTAT DU QUIZ ===

// Obtenir l'état du quiz
app.get('/api/quiz-state', async (req, res) => {
  try {
    const stateDoc = await db.collection('quizState').doc('main').get();
    if (stateDoc.exists) {
      const data = stateDoc.data();
      cache.quizState = data; // Mettre à jour le cache
      res.json(data);
    } else {
      res.json(cache.quizState);
    }
  } catch (error) {
    console.error('Erreur récupération état quiz (utilisation du cache):', error.message);
    res.json(cache.quizState);
  }
});

// Mettre à jour l'état du quiz
app.put('/api/quiz-state', async (req, res) => {
  try {
    const { step, currentQuestionIndex, questionStartTime, questionStartTimes } = req.body;
    
    const stateData = {
      ...(step && { step }),
      ...(typeof currentQuestionIndex === 'number' && { currentQuestionIndex }),
      ...(questionStartTime && { questionStartTime }),
      ...(questionStartTimes && { questionStartTimes }),
      updatedAt: new Date().toISOString()
    };
    
    // Mettre à jour le cache local
    cache.quizState = { ...cache.quizState, ...stateData };
    
    try {
      await db.collection('quizState').doc('main').set(stateData, { merge: true });
    } catch (firebaseError) {
      console.error('Firebase non disponible, utilisation du cache seul');
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur mise à jour état quiz:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// === GESTION DU QUIZ ===

// Reset complet du quiz
app.post('/api/quiz/reset', async (req, res) => {
  try {
    // Reset du cache local (toujours possible)
    cache.participants = [];
    cache.answers = {};
    cache.quizState = { 
      step: 'lobby', 
      currentQuestionIndex: 0, 
      questionStartTime: Date.now() 
    };
    
    try {
      // Essayer de reset Firebase si possible
      const batch = db.batch();
      
      // Supprimer tous les participants
      const participantsSnapshot = await db.collection('participants').get();
      participantsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Supprimer toutes les réponses
      const answersSnapshot = await db.collection('answers').get();
      answersSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Reset de l'état du quiz
      const quizStateRef = db.collection('quizState').doc('main');
      batch.set(quizStateRef, cache.quizState);
      
      await batch.commit();
      console.log('✅ Reset Firebase et cache réussi');
    } catch (firebaseError) {
      console.error('Firebase non disponible, reset du cache seulement:', firebaseError.message);
    }
    
    res.json({ 
      success: true, 
      message: 'Quiz reset avec succès',
      cacheOnly: true
    });
  } catch (error) {
    console.error('Erreur reset quiz:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir le leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const participantsSnapshot = await db.collection('participants').get();
    const participants = participantsSnapshot.docs.map(doc => doc.data());
    
    // Trier par score décroissant
    const leaderboard = participants.sort((a, b) => b.score - a.score);
    
    res.json(leaderboard);
  } catch (error) {
    console.error('Erreur récupération leaderboard:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur quiz sécurisé démarré sur le port ${PORT}`);
  console.log(`📱 Frontend: http://localhost:4200`);
  console.log(`🌐 API: http://localhost:${PORT}`);
  console.log(`🔒 Toutes les opérations Firestore passent par serviceAccountKey.json`);
});

module.exports = app;