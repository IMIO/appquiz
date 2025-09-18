# 🎯 Quiz App - Guide de Démarrage Rapide

## ⚡ Installation Express (1 minute)

```bash
# 1. Cloner le projet
git clone https://github.com/IMIO/appquiz.git
cd appquiz

# 2. Installer les dépendances
npm install

# 3. Lancer l'application (MÉTHODE SIMPLIFIÉE)
npm run dev
```

## 🌐 Accès aux interfaces

Une fois l'application démarrée :

- **🎯 Interface Maître** : http://localhost:4200/presentation
- **📱 Interface Joueurs** : http://localhost:4200/login  
- **⚙️ Interface Admin** : http://localhost:4200/admin
- **🔧 API Backend** : http://localhost:3000

## 🎮 Test rapide

1. **Ouvrir l'interface maître** en grand écran
2. **Scanner le QR Code** avec votre téléphone
3. **S'inscrire** comme joueur
4. **Démarrer le quiz** depuis l'interface maître

## 🔧 Commandes utiles

```bash
# Lancement simplifié (recommandé)
npm run dev              # Lance Angular + Backend ensemble
npm run dev:open         # + ouvre automatiquement le navigateur

# Lancement séparé (si nécessaire)
npm run server           # Backend seul
npm start               # Frontend seul

# Vérifications
curl http://localhost:3000/health        # Santé API
curl http://localhost:3000/api/participants  # Liste joueurs
```

## 🐛 En cas de problème

```bash
# Nettoyer et réinstaller
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# Changer de port si occupé
ng serve --port 4201

# Reset base de données
rm quiz.db
npm run server
```

## 📚 Documentation complète

➡️ **[Guide d'installation détaillé](INSTALLATION.md)**  
➡️ **[README complet](README.md)**

---

*C'est parti pour le quiz ! 🚀*