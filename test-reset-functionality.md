# Test de la fonctionnalité Reset Global

## 🎯 Objectif

Vérifier que depuis `/presentation`, le maître du jeu peut faire un reset complet à n'importe quelle étape du jeu, et que tous les participants sont redirigés vers `/login`.

## 🧪 Scénarios de test

### Scénario 1: Reset depuis étape lobby

1. Aller sur `http://localhost:4200/presentation`
2. Vérifier qu'on est à l'étape "lobby"
3. Cliquer sur le bouton "Reset"
4. ✅ Vérifier: Confirmation affichée, état remis à lobby

### Scénario 2: Reset avec joueurs en attente

1. Ouvrir 2 onglets:
   - Onglet 1: `http://localhost:4200/presentation`
   - Onglet 2: `http://localhost:4200/login`
2. Dans l'onglet 2: S'inscrire comme joueur (nom + avatar)
3. Le joueur devrait être redirigé vers `/waiting`
4. Dans l'onglet 1: Cliquer sur "Reset"
5. ✅ Vérifier: Le joueur sur `/waiting` est redirigé vers `/login` automatiquement (max 3 secondes)

### Scénario 3: Reset avec joueurs en jeu

1. Répéter étapes 1-2 du scénario 2
2. Dans l'onglet 1 (présentation): Passer à l'étape "waiting" puis "question"
3. L'onglet 2 (joueur) devrait maintenant être sur `/quiz`
4. Dans l'onglet 1: Cliquer sur "Reset"
5. ✅ Vérifier: Le joueur sur `/quiz` est redirigé vers `/login` automatiquement (max 3 secondes)

### Scénario 4: Reset avec joueurs sur résultats

1. Répéter les étapes pour amener un joueur à `/result`
2. Faire le reset depuis `/presentation`
3. ✅ Vérifier: Le joueur sur `/result` est redirigé vers `/login`

## 🔍 Points de vérification

### Composants concernés:

- ✅ `waiting.component.ts` - Logique déjà présente et améliorée
- ✅ `participant.component.ts` - Logique ajoutée et corrigée
- ✅ `result.component.ts` - Logique ajoutée et améliorée

### Nettoyage localStorage:

Tous les composants doivent supprimer:

- `userId`
- `userName`
- `avatarUrl`
- `quiz-user`

### Délai de redirection:

- Maximum 3 secondes (intervalle de polling `getStep()`)
- Redirection immédiate via `window.location.href = '/login'` ou `router.navigate(['/login'])`

## 🚀 Lancer les tests

1. S'assurer que les serveurs tournent:

   ```bash
   # Frontend (port 4200)
   npm run start

   # Backend (port 3000)
   node server.js
   ```

2. Ouvrir les URLs dans différents onglets et tester les scénarios

## ✅ Résultats attendus

Après un reset depuis la présentation:

- Tous les participants sont déconnectés
- Toutes les données localStorage sont effacées
- Tous les joueurs retournent sur `/login`
- L'état du jeu est remis à "lobby"
- Les données serveur (participants, réponses) sont supprimées
