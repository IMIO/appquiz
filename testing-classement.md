# Instructions pour tester les corrections du classement

Pour vérifier que les modifications pour résoudre les problèmes d'affichage du classement fonctionnent correctement, suivez ces étapes:

1. **Lancer l'application**

   - Démarrez le serveur backend avec `npm run server` ou `node server.js`
   - Démarrez l'application frontend avec `npm start`

2. **Accéder à l'interface de présentation**

   - Ouvrez l'URL principale de l'application (ex: http://localhost:4200)
   - Connectez-vous en tant qu'administrateur si nécessaire

3. **Utiliser le panneau de diagnostic**

   - Le panneau de débogage est visible en bas à droite de l'écran
   - Cliquez sur les boutons du panneau pour tester la récupération des participants et l'état du quiz
   - Le bouton "ADD test participant" permet d'ajouter un participant de test

4. **Tester la mise à jour du classement**

   - Cliquez sur le bouton "[DEBUG] Rafraîchir scores" en haut à droite de l'écran
   - Observez la console du navigateur (F12) pour voir les diagnostics détaillés
   - Les diagnostics vous indiqueront si des participants sont manquants dans le classement
   - Vous verrez également la correspondance entre les IDs des questions et les réponses

5. **Observer la synchronisation**

   - Le système effectue maintenant une vérification directe des participants toutes les 5 secondes
   - Les logs montreront si des participants sont présents dans la base de données mais absents du classement

6. **Corriger les problèmes identifiés**
   - Si le diagnostic identifie des problèmes de synchronisation entre les IDs et les index, assurez-vous que les questions et leurs index sont correctement alignés
   - Vérifiez que les réponses sont correctement associées aux questions

Ces diagnostics avancés devraient vous aider à identifier et résoudre les problèmes d'affichage du classement.
