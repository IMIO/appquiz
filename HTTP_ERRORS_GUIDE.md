# 🚨 Guide de résolution - Erreurs HTTP

## 🔍 Symptômes observés

```
quiz-secure.service.ts:142 Erreur setStep: HttpErrorResponse
quiz-secure.service.ts:50 Erreur chargement questions: HttpErrorResponse
quiz-secure.service.ts:65 Erreur reset answers: HttpErrorResponse
```

## 🎯 Cause principale

**Le serveur SQLite n'est pas démarré** → L'application Angular ne peut pas communiquer avec l'API backend.

## ✅ Solution rapide

### 1. Vérifier les services
```bash
./check-services.sh
```

### 2. Si le serveur SQLite est inactif
```bash
cd /Users/broemman/quiz-app
node server.js
```
*Ou en arrière-plan :*
```bash
nohup node server.js > server.log 2>&1 &
```

### 3. Si le serveur Angular est inactif
```bash
npm start
```

## 🔧 Diagnostic détaillé

### Vérifier la connexion SQLite
```bash
curl http://localhost:3000/health
# Attendu: {"status":"OK",...}
```

### Vérifier les questions
```bash
curl http://localhost:3000/api/questions | jq length
# Attendu: 10
```

### Vérifier l'état du quiz
```bash
./debug.sh state
```

## 🚀 Procédure de démarrage complète

1. **Démarrer le serveur SQLite** (Terminal 1)
   ```bash
   cd /Users/broemman/quiz-app
   node server.js
   ```

2. **Démarrer Angular** (Terminal 2)
   ```bash
   cd /Users/broemman/quiz-app
   npm start
   ```

3. **Vérifier que tout fonctionne**
   ```bash
   ./check-services.sh
   ```

4. **Rafraîchir la page Angular** (F5)

## 🔄 Si les erreurs persistent

### Reset complet
```bash
# Arrêter tous les processus
pkill -f "node server.js"
pkill -f "ng serve"

# Redémarrer proprement
./check-services.sh  # Vérifier l'état
node server.js &     # Démarrer SQLite
npm start           # Démarrer Angular
```

### Vérifier les logs
```bash
# Logs du serveur SQLite
tail -f server.log

# Logs Angular dans la console du navigateur
# F12 → Console
```

## 📱 URLs de test

- **API Health Check:** http://localhost:3000/health
- **Interface Joueur:** http://localhost:4200
- **Interface Maître:** http://localhost:4200/presentation

## 🎯 Prévention

Pour éviter ces erreurs à l'avenir :
1. **Toujours démarrer SQLite AVANT Angular**
2. **Utiliser `./check-services.sh` avant de commencer**
3. **Garder les deux terminaux ouverts pendant le développement**

**Une fois les services démarrés, toutes les erreurs HTTP disparaîtront !** 🎊