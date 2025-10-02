# Sécurisation des scores dans l'application Quiz

## Améliorations implémentées

### 1. Validation des utilisateurs pour les messages WebSocket

Le serveur WebSocket vérifie désormais que l'utilisateur envoyant un score est bien un participant légitime enregistré dans la base de données. Cette vérification est effectuée à chaque réception d'un message de type `user-score`.

```javascript
// Vérifier si l'utilisateur est enregistré comme participant légitime
db.get("SELECT id, score as currentScore FROM participants WHERE id = ?", [userId], (err, participant) => {
  if (err) {
    console.error("❌ Erreur vérification participant pour score:", err);
    return;
  }

  // Si le participant n'existe pas, rejeter le score
  if (!participant) {
    console.log(`🚫 Score rejeté: utilisateur non autorisé ${userName} (${userId})`);
    return;
  }

  // Suite du traitement pour les participants autorisés...
});
```

### 2. Limitation des scores excessifs

Une protection contre les scores excessifs a été ajoutée pour empêcher la triche. Les scores sont plafonnés à une valeur maximale raisonnable.

```javascript
// Vérifier que le score n'est pas excessif (protection anti-triche)
const SCORE_MAX_PAR_QUESTION = 1000; // Valeur maximale théorique pour une question
if (scoreValue > SCORE_MAX_PAR_QUESTION) {
  console.log(`⚠️ Score suspect détecté: ${userName} (${userId}) → ${scoreValue} points. Score limité à ${SCORE_MAX_PAR_QUESTION}`);
  scoreValue = SCORE_MAX_PAR_QUESTION;
}
```

### 3. Persistance des scores en base de données

Les scores reçus via WebSocket sont maintenant enregistrés dans la base de données, assurant ainsi la persistance des données même en cas de déconnexion/reconnexion.

```javascript
// Mettre à jour le score dans la base de données pour persistance
db.run("UPDATE participants SET score = ? WHERE id = ?", [scoreValue, userId], function (err) {
  if (err) {
    console.error(`❌ Erreur mise à jour score dans la base de données pour ${userName} (${userId}):`, err);
    return;
  }

  console.log(`💾 Score enregistré dans la base de données: ${userName} (${userId}) → ${scoreValue}`);

  // Suite du traitement...
});
```

### 4. Logs détaillés pour une meilleure traçabilité

Des logs détaillés ont été ajoutés pour faciliter le débogage et la surveillance de l'activité :

- Réception des scores : `📊 Score reçu pour l'utilisateur ${userName} (${userId}): ${scoreValue}`
- Scores suspects : `⚠️ Score suspect détecté: ${userName} (${userId}) → ${scoreValue} points.`
- Utilisateurs non autorisés : `🚫 Score rejeté: utilisateur non autorisé ${userName} (${userId})`
- Enregistrement en base : `💾 Score enregistré dans la base de données: ${userName} (${userId}) → ${scoreValue}`
- Diffusion : `📡 Score validé et broadcast vers ${clients.size} clients`

## Avantages de ces améliorations

1. **Sécurité** : Seuls les utilisateurs légitimes peuvent soumettre des scores
2. **Intégrité des données** : Protection contre les scores aberrants ou frauduleux
3. **Persistance** : Les scores sont toujours sauvegardés en base de données
4. **Traçabilité** : Les logs permettent de suivre précisément l'activité et d'identifier les problèmes
5. **Cohérence** : Le système de validation côté serveur complète les vérifications déjà présentes côté client

Ces modifications permettent de s'assurer que seuls les participants légitimes peuvent contribuer au leaderboard et que leurs scores sont correctement enregistrés.
