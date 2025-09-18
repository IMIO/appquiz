# 🔧 API Examples - Quiz App

## Base URL
```
http://localhost:3000
```

## 🏥 Health Check
```bash
curl -X GET http://localhost:3000/health
```
**Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-09-17T13:08:20.425Z",
  "message": "Serveur quiz SQLite opérationnel",
  "database": "SQLite"
}
```

## 📚 Questions

### Récupérer toutes les questions
```bash
curl -X GET http://localhost:3000/api/questions
```
**Response:**
```json
[
  {
    "id": 1,
    "text": "Quelle est la capitale de la France ?",
    "options": ["Lyon", "Paris", "Marseille", "Bordeaux"],
    "correctIndex": 1
  }
]
```

### Ajouter une question
```bash
curl -X POST http://localhost:3000/api/questions \
  -H "Content-Type: application/json" \
  -d '{
    "id": 4,
    "text": "Combien font 5 + 3 ?",
    "options": ["6", "7", "8", "9"],
    "correctIndex": 2
  }'
```

## 👥 Participants

### Récupérer tous les participants
```bash
curl -X GET http://localhost:3000/api/participants
```

### Ajouter un participant
```bash
curl -X POST http://localhost:3000/api/participants \
  -H "Content-Type: application/json" \
  -d '{
    "id": "player-123",
    "name": "Alice",
    "avatarUrl": "https://api.dicebear.com/7.x/identicon/svg?seed=Alice"
  }'
```
**Response:**
```json
{
  "success": true,
  "participant": {
    "id": "player-123",
    "name": "Alice",
    "score": 0,
    "answers": "[]",
    "avatarUrl": "https://api.dicebear.com/7.x/identicon/svg?seed=Alice",
    "createdAt": "2025-09-17T13:05:21.372Z"
  }
}
```

## 🎮 État du Quiz

### Récupérer l'état actuel
```bash
curl -X GET http://localhost:3000/api/quiz-state
```
**Response:**
```json
{
  "step": "lobby",
  "currentQuestionIndex": 0,
  "questionStartTime": 1758114336353,
  "questionStartTimes": {}
}
```

### Changer l'état du quiz
```bash
# Passer en mode attente
curl -X PUT http://localhost:3000/api/quiz-state \
  -H "Content-Type: application/json" \
  -d '{"step": "waiting"}'

# Démarrer la première question
curl -X PUT http://localhost:3000/api/quiz-state \
  -H "Content-Type: application/json" \
  -d '{
    "step": "question",
    "currentQuestionIndex": 0,
    "questionStartTime": 1758114400000
  }'

# Passer à la question suivante
curl -X PUT http://localhost:3000/api/quiz-state \
  -H "Content-Type: application/json" \
  -d '{
    "currentQuestionIndex": 1,
    "questionStartTime": 1758114460000
  }'
```

## 💬 Réponses

### Récupérer les réponses d'une question
```bash
curl -X GET http://localhost:3000/api/answers/0
```
**Response:**
```json
{
  "answers": [
    {
      "userId": "player-123",
      "userName": "Alice",
      "answerIndex": 1,
      "timestamp": 1758114425000
    }
  ]
}
```

### Soumettre une réponse
```bash
curl -X POST http://localhost:3000/api/answers \
  -H "Content-Type: application/json" \
  -d '{
    "questionIndex": 0,
    "userId": "player-123",
    "userName": "Alice",
    "answerIndex": 1
  }'
```

## 🏆 Classement

### Récupérer le leaderboard
```bash
curl -X GET http://localhost:3000/api/leaderboard
```
**Response:**
```json
[
  {
    "id": "player-123",
    "name": "Alice",
    "score": 100,
    "avatarUrl": "https://api.dicebear.com/7.x/identicon/svg?seed=Alice"
  }
]
```

## 🔄 Gestion

### Reset complet du quiz
```bash
curl -X POST http://localhost:3000/api/quiz/reset
```
**Response:**
```json
{
  "success": true,
  "message": "Quiz reset avec succès",
  "database": "SQLite"
}
```

## 📊 États du quiz possibles

- `lobby` : Salle d'attente, inscription des joueurs
- `waiting` : Attente avant le démarrage du quiz
- `question` : Question en cours
- `result` : Affichage des résultats d'une question
- `end` : Fin du quiz, classement final

## 🎯 Workflow typique via API

```bash
# 1. Reset initial
curl -X POST http://localhost:3000/api/quiz/reset

# 2. Ajouter des participants
curl -X POST http://localhost:3000/api/participants \
  -H "Content-Type: application/json" \
  -d '{"id": "alice", "name": "Alice"}'

# 3. Passer en mode attente
curl -X PUT http://localhost:3000/api/quiz-state \
  -H "Content-Type: application/json" \
  -d '{"step": "waiting"}'

# 4. Démarrer la première question
curl -X PUT http://localhost:3000/api/quiz-state \
  -H "Content-Type: application/json" \
  -d '{"step": "question", "currentQuestionIndex": 0, "questionStartTime": '$(date +%s000)'}'

# 5. Les joueurs répondent
curl -X POST http://localhost:3000/api/answers \
  -H "Content-Type: application/json" \
  -d '{"questionIndex": 0, "userId": "alice", "userName": "Alice", "answerIndex": 1}'

# 6. Voir les résultats
curl -X GET http://localhost:3000/api/answers/0

# 7. Question suivante ou fin
curl -X PUT http://localhost:3000/api/quiz-state \
  -H "Content-Type: application/json" \
  -d '{"step": "end"}'
```