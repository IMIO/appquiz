# 🚀 Guide d'installation - Quiz App

Guide complet pour installer et lancer l'application Quiz App depuis GitHub.

## 📋 Prérequis

Avant de commencer, assurez-vous d'avoir installé sur votre machine :

- **Node.js** (version 18 ou supérieure) - [Télécharger](https://nodejs.org/)
- **npm** (inclus avec Node.js)
- **Git** - [Télécharger](https://git-scm.com/)
- **VS Code** (recommandé) - [Télécharger](https://code.visualstudio.com/)

### ✅ Vérification des prérequis

```bash
# Vérifier Node.js
node --version
# Doit afficher v18.0.0 ou supérieur

# Vérifier npm
npm --version
# Doit afficher 8.0.0 ou supérieur

# Vérifier Git
git --version
# Doit afficher git version 2.x.x
```

## 🔽 Étape 1 : Cloner le projet

```bash
# Cloner le repository
git clone https://github.com/IMIO/appquiz.git

# Aller dans le dossier du projet
cd appquiz
```

## 📦 Étape 2 : Installation des dépendances

```bash
# Installer toutes les dépendances
npm install

# Si vous rencontrez des erreurs de compatibilité, utilisez :
npm install --legacy-peer-deps
```

## 🗄️ Étape 3 : Configuration de la base de données

La base de données SQLite sera créée automatiquement au premier lancement du serveur.

**Aucune configuration manuelle requise !** ✨

## 🚀 Étape 4 : Premier lancement

### Option A : Lancement automatique (recommandé)

```bash
# Lance le serveur Angular + API simultanément
npm run dev
```

### Option B : Lancement manuel (deux terminaux)

**Terminal 1 - Serveur API :**
```bash
npm run server
```

**Terminal 2 - Application Angular :**
```bash
npm run start
```

## 🌐 Étape 5 : Accéder à l'application

Une fois les serveurs démarrés, l'application sera accessible via :

- **🎯 Interface principale (maître)** : http://localhost:4200/presentation
- **📱 Interface joueurs** : http://localhost:4200/login
- **⚙️ Interface admin** : http://localhost:4200/admin
- **🔧 API Backend** : http://localhost:3000

## 📱 Étape 6 : Test de l'application

### Test rapide de fonctionnement :

1. **Ouvrir l'interface maître** : http://localhost:4200/presentation
2. **Scanner le QR code** avec votre téléphone ou ouvrir http://localhost:4200/login
3. **S'inscrire** comme joueur
4. **Démarrer le quiz** depuis l'interface maître

## 🛠️ Scripts disponibles

```bash
# Développement
npm run dev          # Lance Angular + API ensemble
npm run dev:open     # Lance et ouvre automatiquement le navigateur

# Serveurs séparés
npm run start        # Lance seulement Angular (port 4200)
npm run server       # Lance seulement l'API (port 3000)

# Build et tests
npm run build        # Compile l'application pour la production
npm run test         # Lance les tests unitaires
npm run watch        # Build en mode watch
```

## 🔧 Résolution des problèmes courants

### ❌ Problème : Port déjà utilisé

```bash
# Si le port 4200 est occupé
ng serve --port 4201

# Si le port 3000 est occupé
# Modifier le port dans server.js (ligne ~10)
```

### ❌ Problème : Erreurs de dépendances

```bash
# Nettoyer et réinstaller
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### ❌ Problème : Base de données

```bash
# Supprimer et recréer la base de données
rm quiz.db
npm run server
```

### ❌ Problème : Permissions Node.js

```bash
# Sur macOS/Linux, si problèmes de permissions
sudo chown -R $(whoami) ~/.npm
```

## 📁 Structure du projet

```
quiz-app/
├── src/                    # Code source Angular
│   ├── app/
│   │   ├── admin/         # Interface administrateur
│   │   ├── participant/   # Interface joueurs
│   │   ├── presentation/  # Interface maître
│   │   └── services/      # Services partagés
├── public/                # Assets statiques
├── server.js              # Serveur API Node.js
├── quiz.db               # Base de données SQLite (auto-créée)
└── package.json          # Configuration npm
```

## 🎯 Fonctionnalités principales

- ✅ **Quiz en temps réel** avec timer synchronisé
- ✅ **Interface maître** pour contrôler le quiz
- ✅ **QR Code** pour connexion rapide des joueurs
- ✅ **Classement en direct** avec scores et temps
- ✅ **Capture d'écran** des résultats
- ✅ **Photo de groupe** avec overlay "Promotion 2025"
- ✅ **Design responsive** et accessible (WCAG AA)

## 🔄 Mise à jour du projet

```bash
# Récupérer les dernières modifications
git pull origin main

# Mettre à jour les dépendances
npm install

# Relancer l'application
npm run dev
```

## 📞 Support

En cas de problème :

1. **Vérifiez les logs** dans le terminal
2. **Consultez la console** du navigateur (F12)
3. **Vérifiez les prérequis** (versions Node.js, npm)
4. **Essayez** `npm install --legacy-peer-deps`

## 🎉 C'est parti !

Votre application Quiz App est maintenant prête à être utilisée ! 

**Bon quiz ! 🚀**

---

*Dernière mise à jour : 18 septembre 2025*