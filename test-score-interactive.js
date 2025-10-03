// Script pour tester les mises à jour de score WebSocket de manière interactive

const WebSocket = require('ws');
const readline = require('readline');

// Créer une interface de ligne de commande pour l'interaction utilisateur
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// URL du serveur WebSocket (par défaut)
const wsUrl = 'ws://localhost:3000';
let ws = null;

// Fonction pour se connecter au WebSocket
function connect() {
  console.log(`⚡ Connexion au serveur WebSocket: ${wsUrl}`);
  
  ws = new WebSocket(wsUrl);
  
  ws.on('open', () => {
    console.log('✅ Connexion WebSocket établie');
    console.log('---------------------------------------');
    showMenu();
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
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
    ws = null;
  });
}

// Menu principal
function showMenu() {
  console.log('\n--- MENU DE TEST DES SCORES ---');
  console.log('1. Envoyer une mise à jour de score simple');
  console.log('2. Simuler plusieurs mises à jour de score');
  console.log('3. Envoyer un score pour un participant existant');
  console.log('4. Quitter');
  console.log('---------------------------------------');
  
  rl.question('Choix: ', (answer) => {
    switch(answer) {
      case '1':
        sendScoreUpdate();
        break;
      case '2':
        simulateMultipleUpdates();
        break;
      case '3':
        sendExistingParticipantScore();
        break;
      case '4':
        console.log('Au revoir!');
        if (ws) {
          ws.close();
        }
        rl.close();
        break;
      default:
        console.log('Option invalide, veuillez réessayer.');
        showMenu();
        break;
    }
  });
}

// Fonction pour envoyer une mise à jour de score
function sendScoreUpdate() {
  rl.question('ID utilisateur: ', (userId) => {
    rl.question('Nom utilisateur: ', (userName) => {
      rl.question('Score (nombre): ', (scoreStr) => {
        const score = parseInt(scoreStr, 10);
        
        if (isNaN(score)) {
          console.log('❌ Score invalide, veuillez entrer un nombre.');
          showMenu();
          return;
        }
        
        const message = {
          type: 'user-score',
          data: {
            userId: userId,
            userName: userName,
            score: score
          }
        };
        
        console.log(`📤 Envoi de mise à jour de score: ${JSON.stringify(message, null, 2)}`);
        
        try {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
            console.log('✅ Message envoyé avec succès');
          } else {
            console.error('❌ WebSocket non connecté');
            connect();
          }
        } catch (error) {
          console.error(`❌ Erreur lors de l'envoi: ${error.message}`);
        }
        
        showMenu();
      });
    });
  });
}

// Fonction pour simuler plusieurs mises à jour de score
function simulateMultipleUpdates() {
  rl.question('Nombre de mises à jour à simuler: ', (numUpdatesStr) => {
    const numUpdates = parseInt(numUpdatesStr, 10);
    
    if (isNaN(numUpdates) || numUpdates <= 0) {
      console.log('❌ Nombre invalide, veuillez entrer un nombre positif.');
      showMenu();
      return;
    }
    
    rl.question('Intervalle entre les mises à jour (ms): ', (intervalStr) => {
      const interval = parseInt(intervalStr, 10);
      
      if (isNaN(interval) || interval < 100) {
        console.log('❌ Intervalle invalide, veuillez entrer un nombre >= 100.');
        showMenu();
        return;
      }
      
      console.log(`🔄 Simulation de ${numUpdates} mises à jour avec intervalle de ${interval}ms...`);
      
      let count = 0;
      const userIds = ['user1', 'user2', 'user3', 'user4', 'user5'];
      const userNames = ['Alice', 'Bob', 'Charlie', 'David', 'Eve'];
      
      // Fonction pour envoyer une mise à jour de score aléatoire
      function sendRandomScore() {
        if (count < numUpdates) {
          const userIndex = Math.floor(Math.random() * userIds.length);
          const userId = userIds[userIndex];
          const userName = userNames[userIndex];
          const score = Math.floor(Math.random() * 10) + 1;
          
          const message = {
            type: 'user-score',
            data: {
              userId: userId,
              userName: userName,
              score: score
            }
          };
          
          try {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(message));
              console.log(`✅ [${count + 1}/${numUpdates}] Score envoyé pour ${userName}: ${score}`);
            } else {
              console.error('❌ WebSocket non connecté');
              return;
            }
          } catch (error) {
            console.error(`❌ Erreur lors de l'envoi: ${error.message}`);
          }
          
          count++;
          
          if (count < numUpdates) {
            setTimeout(sendRandomScore, interval);
          } else {
            console.log('✅ Toutes les mises à jour ont été envoyées');
            showMenu();
          }
        }
      }
      
      // Démarrer la simulation
      sendRandomScore();
    });
  });
}

// Fonction pour envoyer un score pour un participant existant dans l'application
function sendExistingParticipantScore() {
  rl.question('ID du participant existant: ', (userId) => {
    rl.question('Score à envoyer: ', (scoreStr) => {
      const score = parseInt(scoreStr, 10);
      
      if (isNaN(score)) {
        console.log('❌ Score invalide, veuillez entrer un nombre.');
        showMenu();
        return;
      }
      
      const message = {
        type: 'user-score',
        data: {
          userId: userId,
          score: score
        }
      };
      
      console.log(`📤 Envoi de mise à jour de score: ${JSON.stringify(message, null, 2)}`);
      
      try {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
          console.log('✅ Message envoyé avec succès');
        } else {
          console.error('❌ WebSocket non connecté');
          connect();
        }
      } catch (error) {
        console.error(`❌ Erreur lors de l'envoi: ${error.message}`);
      }
      
      showMenu();
    });
  });
}

// Démarrer la connexion WebSocket
connect();

// Gestion de l'arrêt propre du script
process.on('SIGINT', () => {
  console.log('\nFermeture de la connexion WebSocket...');
  if (ws) {
    ws.close();
  }
  rl.close();
  process.exit(0);
});

console.log('Script de test des scores WebSocket');
console.log('=================================');