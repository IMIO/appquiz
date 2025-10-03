// Ce script permet de tester les mises à jour de score via WebSocket

const WebSocket = require('ws');
const readline = require('readline');

// Créer une interface de ligne de commande pour l'interaction utilisateur
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// URL du serveur WebSocket (par défaut)
const wsUrl = 'ws://localhost:3000';

// Connexion au serveur WebSocket
console.log(`⚡ Connexion au serveur WebSocket: ${wsUrl}`);
const ws = new WebSocket(wsUrl);

// Gestionnaire d'événements pour la connexion WebSocket
ws.on('open', () => {
  console.log('✅ Connexion WebSocket établie');
  console.log('---------------------------------------');
  showMenu();
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data);
    console.log(`📥 Message reçu: ${JSON.stringify(message, null, 2)}`);
  } catch (e) {
    console.log(`📥 Message reçu (format brut): ${data}`);
  }
});

ws.on('error', (error) => {
  console.error(`❌ Erreur WebSocket: ${error.message}`);
});

ws.on('close', () => {
  console.log('🔌 Connexion WebSocket fermée');
  rl.close();
});

function showMenu() {
  console.log('\n--- MENU DE TEST DES SCORES ---');
  console.log('1. Envoyer une mise à jour de score');
  console.log('2. Envoyer une mise à jour aléatoire');
  console.log('3. Simuler plusieurs mises à jour de score');
  console.log('4. Quitter');
  console.log('---------------------------------------');
  
  rl.question('Choix: ', (answer) => {
    switch(answer) {
      case '1':
        promptScoreUpdate();
        break;
      case '2':
        sendRandomScoreUpdate();
        break;
      case '3':
        simulateMultipleUpdates();
        break;
      case '4':
        console.log('Au revoir!');
        ws.close();
        rl.close();
        break;
      default:
        console.log('Option invalide, veuillez réessayer.');
        showMenu();
        break;
    }
  });
}

function promptScoreUpdate() {
  rl.question('ID utilisateur: ', (userId) => {
    rl.question('Nom utilisateur: ', (userName) => {
      rl.question('Score (nombre): ', (score) => {
        sendScoreUpdate(userId, userName, parseInt(score, 10));
        showMenu();
      });
    });
  });
}

function sendScoreUpdate(userId, userName, score) {
  const message = {
    type: 'user-score',
    data: {
      userId,
      userName,
      score,
      questionIndex: 0
    }
  };
  
  console.log(`📤 Envoi de mise à jour de score: ${JSON.stringify(message, null, 2)}`);
  
  try {
    ws.send(JSON.stringify(message));
    console.log('✅ Message envoyé avec succès');
  } catch (error) {
    console.error(`❌ Erreur lors de l'envoi: ${error.message}`);
  }
}

function sendRandomScoreUpdate() {
  // Générer un ID aléatoire
  const randomId = Math.floor(Math.random() * 1000).toString();
  const randomName = `Participant_${randomId}`;
  const randomScore = Math.floor(Math.random() * 10) + 1;
  
  sendScoreUpdate(randomId, randomName, randomScore);
  showMenu();
}

function simulateMultipleUpdates() {
  rl.question('Nombre de mises à jour à simuler: ', (count) => {
    const numUpdates = parseInt(count, 10) || 5;
    
    console.log(`🔄 Simulation de ${numUpdates} mises à jour de score...`);
    
    let counter = 0;
    
    // Fonction pour envoyer une mise à jour avec un délai
    function sendDelayedUpdate() {
      if (counter < numUpdates) {
        setTimeout(() => {
          const userId = `user_${Math.floor(Math.random() * 5) + 1}`; // Limiter à 5 utilisateurs différents
          const userName = `Participant_${userId.split('_')[1]}`;
          const score = Math.floor(Math.random() * 10) + 1;
          
          sendScoreUpdate(userId, userName, score);
          counter++;
          sendDelayedUpdate();
        }, 2000); // Délai de 2 secondes entre chaque mise à jour
      } else {
        console.log('✅ Toutes les mises à jour ont été envoyées');
        showMenu();
      }
    }
    
    // Démarrer les envois
    sendDelayedUpdate();
  });
}

// Gestion de l'arrêt du programme
process.on('SIGINT', () => {
  console.log('\nFermeture de la connexion WebSocket...');
  ws.close();
  rl.close();
});

console.log('Script de test des scores WebSocket démarré...');
