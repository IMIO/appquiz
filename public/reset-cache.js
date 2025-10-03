/**
 * Script pour nettoyer le cache de l'application Quiz
 * Ce script peut être utilisé soit dans la console du navigateur, soit
 * inclus dans une page HTML pour réinitialiser tous les caches locaux.
 */

function resetQuizCache() {
  // Liste des clés de cache à nettoyer
  const keysToRemove = [
    // Cache des participants
    'presentation_participants_cache',
    'leaderboard_cache',
    'presentation_leaderboard_cache',
    
    // Cache de l'état du timer
    'quiz_timer_started',
    'quiz_timer_question_index',
    
    // État du quiz
    'quiz_state',
    'quiz_player_state',
    'quiz_current_question',
    'quiz_current_index',
    
    // Authentification
    'quiz_admin_token',
    'admin_session',
    
    // Autres caches potentiels
    'quiz_questions_cache',
    'quiz_answers_cache'
  ];

  // Parcourir et supprimer toutes les clés
  let removed = 0;
  let errors = 0;
  
  console.log('🧹 Nettoyage du cache de l\'application Quiz...');
  
  keysToRemove.forEach(key => {
    try {
      localStorage.removeItem(key);
      removed++;
      console.log(`✅ Cache supprimé: ${key}`);
    } catch (e) {
      errors++;
      console.error(`❌ Erreur lors de la suppression du cache ${key}:`, e);
    }
  });

  // Afficher le résumé
  console.log(`
  📊 Résumé du nettoyage:
  - ${removed} caches supprimés
  - ${errors} erreurs rencontrées
  `);
  
  // Vérifier s'il reste des éléments liés au quiz
  const remainingItems = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('quiz') || key.includes('presentation'))) {
      remainingItems.push(key);
    }
  }
  
  if (remainingItems.length > 0) {
    console.warn('⚠️ Il reste des éléments liés au quiz dans localStorage:');
    console.table(remainingItems);
  } else {
    console.log('✨ Tous les caches liés au quiz ont été nettoyés!');
  }
  
  return {
    success: true,
    removed,
    errors,
    remainingItems
  };
}

// Exécuter le nettoyage si ce script est chargé directement
if (typeof window !== 'undefined') {
  console.log('Script de nettoyage de cache chargé.');
  console.log('Pour nettoyer le cache, exécutez: resetQuizCache()');
}

// Pour Node.js (si utilisé côté serveur)
if (typeof module !== 'undefined') {
  module.exports = { resetQuizCache };
}