# Comment résoudre le problème de référence utilisateur persistante

Ce guide explique comment résoudre le problème où des références à un utilisateur précédent ("broemman") persistent dans le classement (leaderboard) même après réinitialisation du quiz.

## Solution 1: Utiliser la fonction de réinitialisation intégrée

La fonction de réinitialisation de l'application a été améliorée pour effacer tous les caches. Pour l'utiliser:

1. Accédez à la route `/reset` dans l'application
2. Attendez que la réinitialisation soit terminée
3. Vérifiez que le classement est maintenant vide

## Solution 2: Nettoyer manuellement le cache du navigateur

Si le problème persiste, vous pouvez nettoyer manuellement les caches:

1. Ouvrez les outils de développement du navigateur (F12 ou Ctrl+Shift+I)
2. Allez dans l'onglet "Console"
3. Copiez et collez le code suivant:

```javascript
// Nettoyer le cache du leaderboard
localStorage.removeItem("leaderboard_cache");
localStorage.removeItem("presentation_participants_cache");
localStorage.removeItem("presentation_leaderboard_cache");
localStorage.removeItem("game_state");
console.log("✅ Cache nettoyé, rechargez la page");
```

4. Appuyez sur Entrée pour exécuter le code
5. Rechargez complètement la page (Ctrl+F5)

## Solution 3: Utiliser le script de nettoyage complet

Pour un nettoyage encore plus complet:

1. Ouvrez les outils de développement du navigateur (F12 ou Ctrl+Shift+I)
2. Allez dans l'onglet "Console"
3. Chargez le fichier `full-reset.js` disponible dans le projet:
   - Vous pouvez soit ouvrir ce fichier et copier tout son contenu dans la console
   - Soit l'exécuter directement avec la commande suivante dans la console:
     ```javascript
     fetch("full-reset.js")
       .then((r) => r.text())
       .then((code) => eval(code));
     ```
4. Suivez les instructions qui apparaissent dans la console
5. Rechargez complètement la page (Ctrl+F5)

## Solution 4: Réinitialisation complète du navigateur

En dernier recours, vous pouvez:

1. Effacer complètement l'historique et le cache du navigateur
2. Aller dans Paramètres -> Confidentialité et sécurité -> Effacer les données de navigation
3. Sélectionner "Cookies et données de site" et "Images et fichiers en cache"
4. Cliquer sur "Effacer les données"
5. Redémarrer le navigateur et accéder à nouveau à l'application

## Prévention des problèmes futurs

Les modifications apportées au code garantissent maintenant que:

1. Tous les caches sont correctement effacés lors d'une réinitialisation
2. Le leaderboard est complètement vidé quand l'application est réinitialisée
3. Aucune référence utilisateur ne devrait persister après un reset

Si le problème persiste après toutes ces étapes, il pourrait s'agir d'un problème côté serveur. Dans ce cas, vérifiez la base de données SQLite et assurez-vous qu'elle est correctement réinitialisée.
