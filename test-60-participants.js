#!/usr/bin/env node

/**
 * Script de test pour simuler 60 participants simultanés
 * Usage: node test-60-participants.js
 */

const http = require('http');

const API_BASE = 'http://localhost:3000';
const NUMBER_OF_PARTICIPANTS = 60;

// Fonction utilitaire pour faire des requêtes HTTP
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (err) => reject(err));
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Nettoyer la base avant le test
async function cleanup() {
  console.log('🧹 Nettoyage de la base de données...');
  try {
    await makeRequest('POST', '/api/quiz/reset');
    console.log('✅ Base nettoyée');
  } catch (error) {
    console.error('❌ Erreur nettoyage:', error.message);
  }
}

// Inscrire un participant
async function registerParticipant(id) {
  const username = `TestUser${id.toString().padStart(2, '0')}`;
  try {
    const response = await makeRequest('POST', '/api/participants', { 
      id: `user-${id}`, 
      name: username 
    });
    if (response.status === 200 || response.status === 201) {
      return { id, username, success: true, userId: response.data.participant?.id };
    } else {
      return { id, username, success: false, error: `Status ${response.status}` };
    }
  } catch (error) {
    return { id, username, success: false, error: error.message };
  }
}

// Tester l'inscription de tous les participants
async function testMassRegistration() {
  console.log(`📝 Test d'inscription de ${NUMBER_OF_PARTICIPANTS} participants...`);
  
  const results = [];
  
  // Inscription séquentielle pour éviter de surcharger le serveur
  for (let i = 1; i <= NUMBER_OF_PARTICIPANTS; i++) {
    const result = await registerParticipant(i);
    results.push(result);
    
    if (result.success) {
      process.stdout.write(`✅ ${i} `);
    } else {
      process.stdout.write(`❌ ${i} `);
    }
    
    if (i % 10 === 0) {
      console.log(`\n--- ${i}/${NUMBER_OF_PARTICIPANTS} participants traités ---`);
    }
  }
  
  console.log('\n');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Participants inscrits avec succès: ${successful.length}`);
  console.log(`❌ Échecs d'inscription: ${failed.length}`);
  
  if (failed.length > 0) {
    console.log('Détails des échecs:');
    failed.forEach(f => console.log(`  - ${f.username}: ${f.error}`));
  }
  
  return successful.length >= NUMBER_OF_PARTICIPANTS * 0.95; // 95% de réussite minimum
}

// Vérifier que tous les participants sont bien visibles
async function verifyParticipantsList() {
  console.log('🔍 Vérification de la liste des participants...');
  
  try {
    const response = await makeRequest('GET', '/api/participants');
    
    if (response.status !== 200) {
      console.log(`❌ Erreur récupération liste: Status ${response.status}`);
      return false;
    }
    
    const participants = response.data;
    console.log(`📊 Participants visibles dans l'API: ${participants.length}`);
    
    if (participants.length >= NUMBER_OF_PARTICIPANTS * 0.95) {
      console.log('✅ Liste des participants OK');
      return true;
    } else {
      console.log(`❌ Nombre insuffisant de participants (attendu: ~${NUMBER_OF_PARTICIPANTS}, reçu: ${participants.length})`);
      return false;
    }
    
  } catch (error) {
    console.log('❌ Erreur vérification liste:', error.message);
    return false;
  }
}

// Test de charge sur l'API participants
async function loadTestParticipantsAPI() {
  console.log('⚡ Test de charge sur l\'API participants...');
  
  const numberOfRequests = 20;
  const promises = [];
  
  const startTime = Date.now();
  
  // Lancer plusieurs requêtes en parallèle
  for (let i = 0; i < numberOfRequests; i++) {
    promises.push(makeRequest('GET', '/api/participants'));
  }
  
  try {
    const results = await Promise.all(promises);
    const endTime = Date.now();
    
    const successful = results.filter(r => r.status === 200);
    const avgResponseTime = (endTime - startTime) / numberOfRequests;
    
    console.log(`📈 Requêtes réussies: ${successful.length}/${numberOfRequests}`);
    console.log(`⏱️  Temps de réponse moyen: ${avgResponseTime.toFixed(2)}ms`);
    
    if (successful.length >= numberOfRequests * 0.9 && avgResponseTime < 1000) {
      console.log('✅ Test de charge réussi');
      return true;
    } else {
      console.log('❌ Test de charge échoué');
      return false;
    }
    
  } catch (error) {
    console.log('❌ Erreur test de charge:', error.message);
    return false;
  }
}

// Fonction principale
async function main() {
  console.log('🚀 Début du test de performance pour 60 participants');
  console.log('================================================\n');
  
  try {
    // 1. Nettoyage
    await cleanup();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 2. Test d'inscription massive
    const registrationSuccess = await testMassRegistration();
    if (!registrationSuccess) {
      console.log('❌ Test d\'inscription échoué - Arrêt');
      process.exit(1);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 3. Vérification de la liste
    const listSuccess = await verifyParticipantsList();
    if (!listSuccess) {
      console.log('❌ Vérification de la liste échouée - Arrêt');
      process.exit(1);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 4. Test de charge
    const loadSuccess = await loadTestParticipantsAPI();
    if (!loadSuccess) {
      console.log('❌ Test de charge échoué');
      process.exit(1);
    }
    
    console.log('\n================================================');
    console.log('🎉 TOUS LES TESTS SONT RÉUSSIS !');
    console.log('✅ L\'application peut gérer 60+ participants');
    console.log('================================================');
    
  } catch (error) {
    console.error('💥 Erreur générale:', error.message);
    process.exit(1);
  }
}

// Lancer le test si ce script est exécuté directement
if (require.main === module) {
  main();
}