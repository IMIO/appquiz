# Instructions de test pour les mises à jour de score

Ces instructions vous permettront de vérifier que les scores se mettent bien à jour en temps réel dans l'application.

## Prérequis

- Node.js installé sur votre machine
- L'application Quiz App démarrée avec le script de développement

## Étapes de test

### 1. Démarrer l'application complète

```bash
cd /Users/broemman/quiz-app
npm run dev
```

Cela va lancer à la fois :

- Le serveur backend sur le port 3000 (avec WebSocket)
- L'application frontend Angular sur le port 4200

### 2. Connectez-vous à l'interface administrateur

Ouvrez votre navigateur et accédez à `http://localhost:4200/admin`

- Utilisez les identifiants par défaut (admin/admin123)

### 3. Préparez une session de quiz avec au moins un participant

- Créez un participant en vous connectant avec un autre appareil ou navigateur à `http://localhost:4200`
- Entrez un nom d'utilisateur pour ce participant

### 4. Exécutez le script de test interactif

Dans un nouveau terminal, exécutez :

```bash
cd /Users/broemman/quiz-app
node test-score-interactive.js
```

### 5. Tester différents scénarios

Une fois que le script est en cours d'exécution, vous pouvez :

#### A. Envoyer une mise à jour de score simple

1. Choisissez l'option `1` dans le menu
2. Entrez l'ID du participant que vous avez créé
3. Entrez un nom (peut être le même que celui du participant)
4. Entrez un score (par exemple 10)
5. Observez l'interface administrateur - le score devrait se mettre à jour avec une animation

#### B. Simuler plusieurs mises à jour de score

1. Choisissez l'option `2` dans le menu
2. Entrez le nombre de mises à jour à simuler (par exemple 5)
3. Entrez l'intervalle en millisecondes entre chaque mise à jour (par exemple 2000 pour 2 secondes)
4. Observez les scores se mettre à jour dans l'interface administrateur

#### C. Mettre à jour un participant existant

1. Choisissez l'option `3` dans le menu
2. Entrez l'ID exact d'un participant existant
3. Entrez le score à lui attribuer
4. Observez la mise à jour dans l'interface

## Points de vérification

Pendant les tests, vérifiez les éléments suivants :

1. **Les scores se mettent à jour correctement** : Le nombre affiché doit correspondre au score envoyé
2. **Animation visuelle** : Une animation doit mettre en évidence le changement de score
3. **Classement** : Le classement des participants doit se réorganiser en fonction des scores
4. **Persistance** : Si vous rechargez la page admin, les scores doivent être conservés

## Dépannage

Si les scores ne se mettent pas à jour :

1. **Vérifiez les logs** : Consultez la console du navigateur et du serveur
2. **Vérifiez les IDs** : Assurez-vous d'utiliser l'ID exact du participant
3. **Connection WebSocket** : Vérifiez que la connexion WebSocket est bien établie
4. **Format de données** : Vérifiez le format des données envoyées

## Notes

- Les scores envoyés via WebSocket sont temporaires et ne sont pas sauvegardés dans la base de données
- Pour une persistance complète, utilisez l'API REST avec une authentification appropriée
