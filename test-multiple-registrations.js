#!/usr/bin/env node

/**
 * Test pour vérifier qu'aucun reset ne se lance avec plusieurs inscriptions rapides
 */

const http = require('http');

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

async function testMultipleRegistrations() {
  console.log('🧪 Test: Inscriptions multiples rapides');
  console.log('=====================================\n');

  // État initial
  const initialState = await makeRequest('GET', '/api/quiz-state');
  const initialParticipants = await makeRequest('GET', '/api/participants');
  
  console.log(`📊 État initial: ${initialParticipants.data.length} participants, étape: ${initialState.data.step}`);

  // Inscrire 5 joueurs rapidement
  console.log('\n🚀 Inscription de 5 joueurs en parallèle...');
  
  const registrationPromises = [];
  for (let i = 1; i <= 5; i++) {
    const player = {
      id: `rapid-player-${Date.now()}-${i}`,
      name: `RapidJoueur${i}`
    };
    registrationPromises.push(makeRequest('POST', '/api/participants', player));
  }

  const results = await Promise.all(registrationPromises);
  
  const successful = results.filter(r => r.status === 200).length;
  console.log(`✅ Inscriptions réussies: ${successful}/5`);

  // Vérifier après un délai
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const finalState = await makeRequest('GET', '/api/quiz-state');
  const finalParticipants = await makeRequest('GET', '/api/participants');
  
  console.log(`📊 État final: ${finalParticipants.data.length} participants, étape: ${finalState.data.step}`);

  // Analyse
  const expectedParticipants = initialParticipants.data.length + successful;
  const participantsMatch = finalParticipants.data.length === expectedParticipants;
  const stateUnchanged = finalState.data.step === initialState.data.step;

  console.log('\n📋 RÉSULTATS:');
  console.log(`   ${participantsMatch ? '✅' : '❌'} Participants attendus: ${expectedParticipants}, obtenus: ${finalParticipants.data.length}`);
  console.log(`   ${stateUnchanged ? '✅' : '❌'} État quiz inchangé: ${stateUnchanged}`);

  if (participantsMatch && stateUnchanged) {
    console.log('\n✅ SUCCÈS: Inscriptions multiples sans reset automatique');
    return true;
  } else {
    console.log('\n❌ PROBLÈME: Reset ou anomalie détectée');
    return false;
  }
}

async function main() {
  try {
    const success = await testMultipleRegistrations();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('💥 Erreur:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}