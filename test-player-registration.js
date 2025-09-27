#!/usr/bin/env node

/**
 * Test pour vérifier qu'aucun reset automatique ne se lance lors de l'inscription côté joueur
 */

const http = require('http');

const API_BASE = 'http://localhost:3000';

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

async function testPlayerRegistration() {
  console.log('🧪 Test: Inscription joueur sans reset automatique');
  console.log('===================================================\n');

  // 1. Vérifier l'état initial
  console.log('1️⃣ Vérification état initial...');
  
  const initialParticipants = await makeRequest('GET', '/api/participants');
  const initialQuizState = await makeRequest('GET', '/api/quiz-state');
  
  console.log(`   📊 Participants initiaux: ${initialParticipants.data.length}`);
  console.log(`   🎯 État quiz initial: ${initialQuizState.data.step}`);
  console.log(`   📝 Index question: ${initialQuizState.data.currentQuestionIndex}\n`);

  // 2. Inscrire un nouveau joueur
  console.log('2️⃣ Inscription du nouveau joueur...');
  
  const newPlayer = {
    id: `test-player-${Date.now()}`,
    name: `Joueur${Math.floor(Math.random() * 1000)}`
  };
  
  const registrationResult = await makeRequest('POST', '/api/participants', newPlayer);
  
  if (registrationResult.status === 200) {
    console.log(`   ✅ Joueur inscrit: ${newPlayer.name} (${newPlayer.id})`);
  } else {
    console.log(`   ❌ Échec inscription: Status ${registrationResult.status}`);
    return false;
  }

  // 3. Attendre un peu et vérifier si il y a eu un reset
  console.log('\n3️⃣ Vérification absence de reset (attente 3s)...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const finalParticipants = await makeRequest('GET', '/api/participants');
  const finalQuizState = await makeRequest('GET', '/api/quiz-state');
  
  console.log(`   📊 Participants après inscription: ${finalParticipants.data.length}`);
  console.log(`   🎯 État quiz après inscription: ${finalQuizState.data.step}`);
  console.log(`   📝 Index question après inscription: ${finalQuizState.data.currentQuestionIndex}`);

  // 4. Analyser les résultats
  console.log('\n4️⃣ Analyse des résultats...');
  
  const participantsIncreased = finalParticipants.data.length > initialParticipants.data.length;
  const quizStateUnchanged = finalQuizState.data.step === initialQuizState.data.step;
  const questionIndexUnchanged = finalQuizState.data.currentQuestionIndex === initialQuizState.data.currentQuestionIndex;
  const playerFound = finalParticipants.data.find(p => p.id === newPlayer.id);
  
  console.log(`   ${participantsIncreased ? '✅' : '❌'} Nombre participants augmenté: ${initialParticipants.data.length} → ${finalParticipants.data.length}`);
  console.log(`   ${quizStateUnchanged ? '✅' : '❌'} État quiz inchangé: ${initialQuizState.data.step} → ${finalQuizState.data.step}`);
  console.log(`   ${questionIndexUnchanged ? '✅' : '❌'} Index question inchangé: ${initialQuizState.data.currentQuestionIndex} → ${finalQuizState.data.currentQuestionIndex}`);
  console.log(`   ${playerFound ? '✅' : '❌'} Joueur présent dans la liste: ${playerFound ? 'OUI' : 'NON'}`);

  // 5. Conclusion
  console.log('\n📋 CONCLUSION:');
  if (participantsIncreased && quizStateUnchanged && questionIndexUnchanged && playerFound) {
    console.log('✅ SUCCÈS: Aucun reset automatique détecté lors de l\'inscription');
    console.log('✅ Le joueur s\'inscrit normalement sans perturber le quiz');
    return true;
  } else {
    console.log('❌ PROBLÈME DÉTECTÉ: Un reset ou une anomalie s\'est produite');
    if (!participantsIncreased) console.log('   - Le nombre de participants n\'a pas augmenté');
    if (!quizStateUnchanged) console.log('   - L\'état du quiz a changé de façon inattendue');
    if (!questionIndexUnchanged) console.log('   - L\'index des questions a changé');
    if (!playerFound) console.log('   - Le joueur inscrit n\'est plus dans la liste');
    return false;
  }
}

async function main() {
  try {
    const success = await testPlayerRegistration();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('💥 Erreur:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}