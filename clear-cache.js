// Script pour nettoyer complètement les caches du quiz
console.log('🧹 Début du nettoyage des caches...');

// Supprimer tous les caches liés au leaderboard et aux participants
localStorage.removeItem('leaderboard_cache');
localStorage.removeItem('presentation_participants_cache');
localStorage.removeItem('presentation_leaderboard_cache');
localStorage.removeItem('game_state');

// Vérifier si d'autres éléments de localStorage pourraient contenir des références
const keysToCheck = [];
for (let i = 0; i < localStorage.length; i++) {
  keysToCheck.push(localStorage.key(i));
}

// Afficher tous les éléments restants pour information
console.log('📋 Éléments restants dans localStorage :', keysToCheck);

console.log('✅ Nettoyage des caches terminé !');
console.log('➡️ Rechargez la page pour que les changements prennent effet.');