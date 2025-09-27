#!/usr/bin/env node

// Script de test pour vérifier la synchronisation des timers
console.log('🧪 Test de synchronisation des timers\n');

async function testTimerSync() {
  const baseUrl = 'http://localhost:3000/api';
  
  try {
    // Récupérer l'état du serveur
    const response = await fetch(`${baseUrl}/quiz-state`);
    const state = await response.json();
    
    if (state.step !== 'question') {
      console.log('❌ Le quiz n\'est pas à l\'étape question');
      return;
    }
    
    console.log('📊 État du serveur:');
    console.log(`   Étape: ${state.step}`);
    console.log(`   Question: ${state.currentQuestionIndex}`);
    console.log(`   Début: ${new Date(state.questionStartTime).toLocaleTimeString()}`);
    console.log(`   Timer max: ${state.timerMax}s`);
    
    // Calculer le temps restant
    const elapsed = Math.floor((Date.now() - state.questionStartTime) / 1000);
    const remaining = Math.max(0, state.timerMax - elapsed);
    
    console.log(`   Temps écoulé: ${elapsed}s`);
    console.log(`   Temps restant: ${remaining}s`);
    
    console.log('\n🎯 Tous les clients doivent afficher: ~' + remaining + 's restantes');
    console.log('\n📋 Instructions:');
    console.log('1. Ouvrir http://localhost:4200/presentation');
    console.log('2. Ouvrir http://localhost:4200/participant (x2 ou plus)');
    console.log('3. Vérifier que tous affichent le même temps (±1s)');
    console.log('4. Observer les logs de synchronisation dans les consoles des navigateurs');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testTimerSync();