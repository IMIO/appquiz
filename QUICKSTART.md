# 🚀 Guide de Démarrage Rapide - Quiz App

## Installation et lancement en 3 étapes

### 1. Préparer l'environnement
```bash
cd quiz-app
npm install
```

### 2. Démarrer le backend
```bash
node server.js &
```
✅ Serveur SQLite sur http://localhost:3000

### 3. Démarrer le frontend
```bash
ng serve --port 4201
```
✅ Application sur http://localhost:4201

## 🎯 Utilisation immédiate

### Maître du jeu
1. Ouvrir : http://localhost:4201
2. Cliquer "Reset Quiz" pour nettoyer
3. Attendre les participants

### Joueurs
1. Ouvrir : http://localhost:4201/login
2. Saisir un nom
3. Cliquer "Rejoindre"

### Démarrer le quiz
1. Maître : Cliquer "Démarrer Quiz"
2. Joueurs : Répondre aux questions
3. Maître : Gérer les transitions

## 🔧 Commandes utiles

```bash
# Vérifier l'API
curl http://localhost:3000/health

# Voir les participants
curl http://localhost:3000/api/participants

# Reset manuel
curl -X POST http://localhost:3000/api/quiz/reset

# Logs serveur
tail -f server.log
```

## 📱 URLs essentielles

- **Maître du jeu** : http://localhost:4201
- **Inscription joueurs** : http://localhost:4201/login
- **API Health** : http://localhost:3000/health
- **Documentation complète** : Voir README.md