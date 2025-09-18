# 📚 Quiz App - SQLite

Une application de quiz interactif en temps réel utilisant Angular et Node.js avec SQLite.

## 🚀 Démarrage rapide

### Prérequis
- Node.js (v16+)
- npm
- Git

### Installation et lancement

```bash
# Cloner le projet
git clone <repository-url>
cd quiz-app

# Installer les dépendances
npm install

# 🎯 NOUVELLE MÉTHODE SIMPLIFIÉE (recommandée)
npm run dev
# Lance automatiquement Angular + Node.js en parallèle

# Alternative avec ouverture automatique du navigateur
npm run dev:open
```

**Scripts disponibles :**
- `npm run dev` - Lance Angular + serveur backend en parallèle
- `npm run dev:open` - Idem + ouvre automatiquement le navigateur
- `npm run server` - Lance uniquement le serveur backend
- `npm start` - Lance uniquement Angular

### Méthode manuelle (ancienne)

```bash
# Terminal 1 : Serveur backend (SQLite)
node server.js

# Terminal 2 : Serveur frontend (Angular)
npm start
```

L'application sera accessible sur :
- **Frontend** : http://localhost:4201
- **API Backend** : http://localhost:3000

## 📱 Utilisation de l'application

### 🎯 Interface Maître du Jeu

**URL** : http://localhost:4201

L'interface principale pour contrôler le quiz :

#### Actions disponibles :
- **Reset Quiz** : Remet à zéro tous les participants et l'état du quiz
- **Démarrer Quiz** : Lance le quiz en mode question
- **Question suivante** : Passe à la question suivante
- **Voir résultats** : Affiche les résultats de la question courante
- **Terminer Quiz** : Termine le quiz et affiche le classement final

#### Informations affichées :
- Liste des participants connectés en temps réel
- Question courante avec options de réponse
- Statistiques des réponses (bonnes/mauvaises/aucune)
- Classement des joueurs par score
- Timer pour chaque question

### 👥 Interface Participant/Joueur

**URL** : http://localhost:4201/login

Interface pour que les joueurs rejoignent le quiz :

#### Étapes d'inscription :
1. **Saisir un nom** : Pseudo du joueur
2. **Avatar optionnel** : 
   - Saisir un nom d'utilisateur GitHub pour récupérer l'avatar
   - Ou utiliser un avatar généré automatiquement
3. **Rejoindre** : Se connecter au quiz

#### Pendant le quiz :
- **Salle d'attente** : Attendre que le maître du jeu démarre
- **Questions** : Répondre aux questions dans le temps imparti
- **Résultats** : Voir ses performances après chaque question
- **Classement** : Position dans le leaderboard

## 🔧 Architecture technique

### Backend (Node.js + SQLite)

#### Base de données SQLite
Fichier : `quiz.db`

**Tables créées automatiquement :**

```sql
-- Questions du quiz
CREATE TABLE questions (
    id INTEGER PRIMARY KEY,
    text TEXT NOT NULL,
    options TEXT NOT NULL, -- JSON array
    correctIndex INTEGER NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Participants
CREATE TABLE participants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    answers TEXT DEFAULT '[]', -- JSON array
    avatarUrl TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- État du quiz
CREATE TABLE quiz_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    step TEXT DEFAULT 'lobby',
    currentQuestionIndex INTEGER DEFAULT 0,
    questionStartTime INTEGER,
    questionStartTimes TEXT DEFAULT '{}', -- JSON object
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Réponses des participants
CREATE TABLE answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    questionIndex INTEGER NOT NULL,
    userId TEXT NOT NULL,
    userName TEXT NOT NULL,
    answerIndex INTEGER NOT NULL,
    timestamp INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);
```

#### API Endpoints

**Questions**
- `GET /api/questions` - Récupérer toutes les questions
- `POST /api/questions` - Ajouter une question

**Participants**
- `GET /api/participants` - Liste des participants
- `POST /api/participants` - Ajouter un participant

**État du quiz**
- `GET /api/quiz-state` - État actuel du quiz
- `PUT /api/quiz-state` - Modifier l'état du quiz

**Réponses**
- `GET /api/answers/:questionIndex` - Réponses d'une question
- `POST /api/answers` - Soumettre une réponse

**Gestion**
- `POST /api/quiz/reset` - Reset complet du quiz
- `GET /api/leaderboard` - Classement des joueurs
- `GET /health` - Santé du serveur

### Frontend (Angular)

#### Services
- `QuizService` : Communication avec l'API backend
- `TimerService` : Gestion des timers de questions

#### Composants principaux
- `PresentationComponent` : Interface maître du jeu
- `ParticipantComponent` : Interface joueur
- `LoginComponent` : Inscription des joueurs

#### Synchronisation temps réel
- Polling toutes les 2 secondes pour :
  - Liste des participants
  - État du quiz
  - Réponses aux questions

## 🎮 Flux de jeu typique

### 1. Préparation
1. Démarrer les serveurs backend et frontend
2. Ouvrir l'interface maître du jeu : http://localhost:4201
3. Faire un reset si nécessaire

### 2. Inscription des joueurs
1. Les joueurs vont sur : http://localhost:4201/login
2. Chacun saisit son nom et choisit un avatar
3. Ils rejoignent la salle d'attente
4. Le maître voit les participants arriver en temps réel

### 3. Démarrage du quiz
1. Le maître clique sur "Démarrer Quiz"
2. Tous les joueurs passent en mode question
3. La première question s'affiche

### 4. Réponse aux questions
1. Les joueurs ont un temps limité pour répondre
2. Le maître voit les statistiques en temps réel
3. Passage à la question suivante
4. Répéter pour toutes les questions

### 5. Fin de partie
1. Affichage du classement final
2. Possibilité de reset pour recommencer

## 🛠 Configuration et personnalisation

### Modifier les questions par défaut

Éditer le fichier `server.js`, section `defaultQuestions` :

```javascript
const defaultQuestions = [
  {
    id: 1,
    text: "Votre question ?",
    options: ["Option A", "Option B", "Option C", "Option D"],
    correctIndex: 1 // Index de la bonne réponse (0-3)
  }
  // Ajouter d'autres questions...
];
```

### Changer les ports

**Backend** : Modifier `PORT` dans `server.js`
```javascript
const PORT = process.env.PORT || 3000;
```

**Frontend** : Lancer avec un port spécifique
```bash
ng serve --port 4201
```

### Modifier les intervalles de polling

Dans `src/app/services/quiz-secure.service.ts` :
```typescript
// Participants (défaut: 2000ms)
return interval(2000).pipe(

// État du quiz (défaut: 2000ms)  
return interval(2000).pipe(
```

## 🐛 Dépannage

### Problèmes courants

**Erreur de connexion API**
- Vérifier que le serveur backend est démarré : `curl http://localhost:3000/health`
- Vérifier les ports dans les configurations

**Base SQLite corrompue**
- Supprimer `quiz.db` et redémarrer le serveur pour recréer

**Participants non visibles**
- Vérifier la synchronisation des intervalles de polling
- Rafraîchir la page maître du jeu

**Questions non chargées**
- Vérifier les logs du serveur backend
- Tester l'API : `curl http://localhost:3000/api/questions`

### Logs et débogage

**Logs serveur** :
```bash
tail -f server.log
```

**Console navigateur** :
F12 → Console pour voir les erreurs JavaScript

## 📁 Structure des fichiers

```
quiz-app/
├── server.js                 # Serveur backend SQLite
├── quiz.db                   # Base de données SQLite
├── package.json              # Dépendances npm
├── angular.json              # Configuration Angular
├── src/
│   ├── app/
│   │   ├── services/
│   │   │   ├── quiz-secure.service.ts  # Service API
│   │   │   └── timer.service.ts        # Service timer
│   │   ├── presentation/
│   │   │   └── presentation.component.ts # Interface maître
│   │   ├── participant/
│   │   │   ├── participant.component.ts  # Interface joueur
│   │   │   └── login/
│   │   │       └── login.component.ts    # Inscription
│   │   └── models/
│   │       ├── question.model.ts
│   │       └── user.model.ts
│   └── index.html
└── backup/
    ├── server-firebase-backup.js    # Ancien serveur Firebase
    └── serviceAccountKey-backup.json # Ancienne config Firebase
```

## 🔄 Migration Firebase → SQLite

Cette version utilise SQLite au lieu de Firebase pour :
- ✅ Éliminer les problèmes de quota
- ✅ Simplifier le déploiement (pas de configuration cloud)
- ✅ Améliorer les performances (base locale)
- ✅ Faciliter le développement et debug

Les fichiers Firebase sont sauvegardés dans les fichiers `*-backup.js` pour référence.

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
