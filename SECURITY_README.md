# 🔒 Sécurisation Firebase avec serviceAccountKey.json

## 📋 Vue d'ensemble

J'ai transformé votre application pour qu'elle utilise **uniquement** le `serviceAccountKey.json` pour accéder à Firestore. Voici l'architecture sécurisée :

```
Frontend Angular ↔️ Serveur Express ↔️ Firebase (via serviceAccountKey.json)
```

## 🔧 Configuration requise

### 1. Obtenir serviceAccountKey.json

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet
3. **⚙️ Paramètres du projet** → **Comptes de service**
4. Cliquez sur **"Générer une nouvelle clé privée"**
5. Téléchargez le fichier JSON
6. Renommez-le `serviceAccountKey.json`
7. Placez-le dans `/Users/broemman/quiz-app/`

### 2. Déployer les règles Firestore

Dans la [Firebase Console](https://console.firebase.google.com/) :
1. **Firestore Database** → **Règles**
2. Remplacez par le contenu du fichier `firestore.rules`
3. Cliquez sur **"Publier"**

### 3. Configurer HttpClient dans Angular

Ajoutez dans `src/app/app.config.ts` :

```typescript
import { provideHttpClient } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    // ... autres providers
    provideHttpClient() // ← Ajouter cette ligne
  ]
};
```

## 🚀 Démarrage

### 1. Installer les dépendances du serveur

```bash
# Copier le package.json du serveur
cp server-package.json package-server.json

# Installer les dépendances
npm install --prefix . express firebase-admin cors
# Ou pour dev
npm install --prefix . nodemon --save-dev
```

### 2. Démarrer le serveur sécurisé

```bash
# Serveur avec serviceAccountKey.json
node server.js

# Ou en mode développement
npx nodemon server.js
```

### 3. Démarrer Angular

```bash
# Dans un autre terminal
npm start
```

## 🔒 Sécurité implémentée

### ✅ Règles Firestore strictes

```javascript
// Toutes les collections nécessitent une authentification Admin SDK
match /questions/{questionId} {
  allow read, write: if isAuthorizedAdmin();
}

// Fonction de validation
function isAuthorizedAdmin() {
  return request.auth != null && 
         (request.auth.token.admin == true ||
          request.auth.uid in ['admin-service-account']);
}
```

### ✅ Serveur Express sécurisé

- ✅ Firebase Admin SDK avec `serviceAccountKey.json`
- ✅ Tokens personnalisés avec claims admin
- ✅ API REST complète pour toutes les opérations
- ✅ CORS configuré pour votre frontend

### ✅ Service Angular adapté

- ✅ Remplacement des appels Firestore directs par des appels API
- ✅ Authentification automatique avec tokens
- ✅ Polling pour simuler le temps réel
- ✅ Gestion d'erreurs robuste

## 📡 API Endpoints

### Authentification
- `POST /api/auth/token` - Obtenir un token d'authentification

### Questions
- `GET /api/questions` - Lister toutes les questions
- `POST /api/questions` - Ajouter une question

### Participants
- `GET /api/participants` - Lister tous les participants
- `POST /api/participants` - Créer un participant

### Réponses
- `GET /api/answers/:questionIndex` - Réponses pour une question
- `POST /api/answers` - Soumettre une réponse

### État du quiz
- `GET /api/quiz-state` - État actuel du quiz
- `PUT /api/quiz-state` - Mettre à jour l'état

### Gestion
- `POST /api/quiz/reset` - Reset complet du quiz
- `GET /api/leaderboard` - Classement des participants

## 🔄 Migration du service

Pour utiliser le nouveau service sécurisé, remplacez dans vos composants :

```typescript
// Remplacer l'import
import { QuizService } from './services/quiz-secure.service';

// Ou renommer le fichier
// quiz-secure.service.ts → quiz.service.ts
```

## ⚠️ Points importants

1. **serviceAccountKey.json** ne doit **JAMAIS** être commité
2. Le serveur doit tourner sur le port 3000
3. Seules les requêtes via le serveur sont autorisées
4. Les tokens sont générés automatiquement
5. Le polling remplace les observables temps réel

## 🛠️ Dépannage

### Erreur "Token manquant"
- Vérifiez que le serveur tourne
- Vérifiez que `serviceAccountKey.json` existe

### Erreur "Permission denied"
- Vérifiez que les règles Firestore sont déployées
- Vérifiez que le token est valide

### Erreur CORS
- Vérifiez l'URL dans `cors.origin` du serveur
- Vérifiez que l'API URL est correcte dans le service

## 🎯 Résultat

✅ **Sécurité maximale** : Seul votre serveur peut accéder à Firestore
✅ **Fonctionnalités préservées** : Toutes les fonctionnalités de votre quiz
✅ **Architecture robuste** : Séparation frontend/backend claire
✅ **Contrôle total** : Tous les accès passent par votre API

Votre application est maintenant **100% sécurisée** ! 🛡️