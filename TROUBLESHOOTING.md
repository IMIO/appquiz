# 🔧 Guide de résolution - Cases grisées non cliquables

## 🔍 Diagnostic du problème

Quand les cases de réponses côté joueur sont grisées et non cliquables, voici les causes possibles :

### 1. **État du quiz incorrect** ⭐ (Cause principale)
- **Problème** : Le quiz doit être en état `"question"` pour permettre les réponses
- **Solution** : Démarrer une question depuis l'interface Maître du jeu

### 2. **Participant pas inscrit**
- **Problème** : Le joueur n'a pas rejoint le quiz
- **Solution** : S'inscrire via l'interface joueur

### 3. **Réponse déjà donnée**
- **Problème** : `hasAnswered = true` empêche de changer de réponse
- **Solution** : Normal, une seule réponse par question

## 🚀 Solutions rapides

### Via l'interface Maître du jeu
1. Ouvrir http://localhost:4200/presentation
2. Cliquer "Lancer le jeu" 
3. Puis "Démarrer première question"

### Via les commandes debug
```bash
# Démarrer une question
./debug.sh start-question

# Vérifier l'état
./debug.sh state

# Ajouter un participant test
./debug.sh add-participant "MonNom"
```

### Via API directe
```bash
# Forcer l'état question
curl -X PUT http://localhost:3000/api/quiz-state \
  -H "Content-Type: application/json" \
  -d '{"step": "question"}'
```

## 🎯 Workflow normal

1. **Lobby** → Inscription des joueurs
2. **Waiting** → Validation par l'animateur  
3. **Question** → Réponses possibles ✅
4. **Result** → Affichage des résultats
5. **Question suivante** → Répétition 3-4

## 🔧 Debug en temps réel

```bash
# États possibles
./debug.sh state    # Voir l'état actuel

# Si état = "lobby" ou "waiting" 
./debug.sh start-question  # Force question

# Si problème persiste
./debug.sh reset    # Reset complet
```

## 📱 Interface utilisateur

### Côté Joueur (http://localhost:4200)
- ✅ **En mode question** : Cases cliquables, timer actif
- ❌ **En mode lobby/waiting** : "En attente du lancement..."
- ⚪ **Après réponse** : Cases grisées (normal)

### Côté Maître du jeu (http://localhost:4200/presentation)
- Contrôle total des étapes
- Boutons "Lancer", "Question suivante", etc.

## 🎨 CSS et styles

Les styles CSS appliqués automatiquement :
```css
.option-item          /* Case normale - cliquable */
.option-item:hover    /* Survol - feedback visuel */
.option-item.answered /* Après réponse - grisée */
.option-item.selected /* Bonne réponse - verte */
.option-item.bad      /* Mauvaise réponse - rouge */
```

## ✅ Vérification rapide

1. **Serveur SQLite** : http://localhost:3000/health
2. **Application Angular** : http://localhost:4200
3. **État du quiz** : `./debug.sh state`
4. **Questions disponibles** : `./debug.sh questions`

Si tout fonctionne mais les cases restent grisées :
- ✅ Vérifier que `step = "question"`
- ✅ Vérifier que `hasAnswered = false`
- ✅ Forcer rafraîchissement page (F5)

**Le problème est résolu quand les cases deviennent cliquables en mode question !** 🎊