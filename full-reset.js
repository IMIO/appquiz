// Script pour effectuer une réinitialisation complète de l'application
// À exécuter dans la console du navigateur si le problème persiste

(function() {
  console.log('🧹 Début de la réinitialisation complète...');
  
  // 1. Supprimer tous les caches du localStorage
  const keysToRemove = [
    'leaderboard_cache',
    'presentation_participants_cache', 
    'presentation_leaderboard_cache',
    'game_state',
    'quiz_state',
    'admin_session',
    'quiz_persistent_state'
  ];
  
  keysToRemove.forEach(key => {
    try {
      localStorage.removeItem(key);
      console.log(`✅ Cache supprimé: ${key}`);
    } catch (e) {
      console.error(`❌ Erreur lors de la suppression du cache ${key}:`, e);
    }
  });
  
  // 2. Chercher et supprimer tout ce qui pourrait contenir des références à "broemman"
  let allKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    allKeys.push(localStorage.key(i));
  }
  
  console.log(`🔍 Recherche de références à "broemman" dans ${allKeys.length} clés du localStorage...`);
  
  // Parcourir toutes les clés et chercher des références à "broemman"
  let referenceFound = false;
  allKeys.forEach(key => {
    if (key) {
      try {
        const value = localStorage.getItem(key);
        if (value && value.toLowerCase().includes('broemman')) {
          console.log(`⚠️ Référence trouvée dans la clé: ${key}`);
          localStorage.removeItem(key);
          console.log(`✅ Clé supprimée: ${key}`);
          referenceFound = true;
        }
      } catch (e) {
        console.error(`❌ Erreur lors de l'analyse de la clé ${key}:`, e);
      }
    }
  });
  
  if (!referenceFound) {
    console.log('✅ Aucune référence trouvée à "broemman" dans localStorage');
  }
  
  // 3. Vérification des cookies (au cas où)
  console.log('🔍 Recherche de références dans les cookies...');
  if (document.cookie.toLowerCase().includes('broemman')) {
    console.log('⚠️ Référence trouvée dans les cookies - Nettoyage...');
    
    // Supprimer tous les cookies (méthode simple)
    document.cookie.split(";").forEach(function(c) {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    
    console.log('✅ Cookies nettoyés');
  } else {
    console.log('✅ Aucune référence trouvée dans les cookies');
  }
  
  // 4. Rapport final
  console.log('');
  console.log('✅ NETTOYAGE TERMINÉ');
  console.log('➡️ Veuillez recharger complètement la page (Ctrl+F5) pour appliquer les changements');
  console.log('➡️ Si le problème persiste, essayez de vider complètement le cache du navigateur');
})();