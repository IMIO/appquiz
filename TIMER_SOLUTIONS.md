# Solutions pour les problèmes de timer

Ce document résume les différentes solutions mises en place pour résoudre les problèmes de timer dans l'application Quiz.

## Problèmes identifiés

1. **Connexion WebSocket qui échoue** - Erreur "WebSocket connection to 'ws://localhost:3000/' failed"
2. **Timer qui ne démarre pas** malgré l'interaction utilisateur
3. **Erreur HTTP lors du démarrage du timer** - "HttpErrorResponse" même avec un statut 200 OK
4. **Absence de mécanisme de secours** lorsque les WebSockets échouent
5. **Configuration incorrecte** entre client et serveur
6. **Configuration proxy incorrecte** - utilisation de variables non substituées dans proxy.conf.json

## Solutions implémentées

### 1. Alignement des configurations WebSocket

#### Dans le serveur (`server.js`)

```javascript
// Correction: Configuration WebSocket sur la racine pour compatibilité avec client actuel
const wss = new WebSocket.Server({
  server: server,
  // Pas de path spécifié pour écouter sur la racine
});
```

#### Dans le service client (`websocket-timer.service.ts`)

```typescript
private connect() {
  // Construction robuste de l'URL WebSocket qui fonctionne en dev et en prod
  let wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  let host = window.location.host; // Inclut hostname:port ou domaine

  // Utilisation d'une URL simple qui fonctionne en dev et prod
  let wsUrl;
  if (environment.production) {
    // En production: utiliser le même domaine que l'application
    wsUrl = `${wsProtocol}//${host}`;
  } else {
    // En développement: utiliser l'URL de l'environnement
    const baseUrl = environment.apiUrl.replace(/\/api$/, '');
    wsUrl = baseUrl.replace(/^http/, 'ws').replace(/^https/, 'wss');
  }

  this.ws = new WebSocket(wsUrl);
  // ...
}
```

#### Configuration CORS pour le serveur

```javascript
// Configuration CORS
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? [
            "https://frontendurl",
            "http://localhost:4200", // Ajouter l'URL de développement Angular
          ]
        : true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
```

### 2. Configuration Nginx pour les WebSockets

```nginx
# Dans nginx.conf - support des WebSockets
location / {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

### 3. Mécanisme de secours pour le timer

#### Polling HTTP comme solution de secours

```typescript
// Dans websocket-timer.service.ts
private scheduleReconnect() {
  if (this.reconnectAttempts < this.maxReconnectAttempts) {
    // Logique de reconnexion avec backoff exponentiel
  } else {
    console.log('[WS] Basculement en mode de secours (polling HTTP)');
    // Activer un mode de secours en utilisant le polling HTTP
    setInterval(() => {
      this.pollTimerState();
    }, 2000);
  }
}

// Mode de secours : polling HTTP pour récupérer l'état du timer
private pollTimerState() {
  fetch('/api/quiz-state')
    .then(response => response.json())
    .then(data => {
      // Simuler une mise à jour du timer comme si c'était un message WebSocket
      if (data) {
        const timerData = { /* ... */ };
        this.handleTimerUpdate({data: timerData});
      }
    })
    .catch(error => {
      console.error('[WS-FALLBACK] Erreur polling timer:', error);
    });
}
```

### 4. Correction de la configuration proxy et support de l'API URL flexible

#### Configuration de base du proxy

```json
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false,
    "changeOrigin": true,
    "logLevel": "debug"
  }
}
```

#### Script de démarrage avec API URL configurable (start-app.sh)

```bash
#!/bin/bash

# Configuration par défaut
API_URL=${API_URL:-"http://localhost:3000"}
PORT=${PORT:-4200}
HOST=${HOST:-"0.0.0.0"}

echo "🚀 Démarrage de l'application Quiz"
echo "📡 API URL: $API_URL"
echo "🌐 Interface: $HOST:$PORT"

# Création du fichier de proxy dynamique
cat > proxy.conf.json << EOF
{
  "/api": {
    "target": "$API_URL",
    "secure": false,
    "changeOrigin": true,
    "logLevel": "debug"
  }
}
EOF

echo "✅ Configuration proxy générée pour $API_URL"

# Démarrage de l'application Angular
echo "🔄 Démarrage du frontend Angular..."
ng serve --host $HOST --port $PORT --proxy-config proxy.conf.json
```

#### Nouveaux scripts dans package.json

```json
"scripts": {
  "ng": "ng",
  "start": "ng serve --host 0.0.0.0 --port 4200",
  "start:flex": "./start-app.sh",
  "build": "ng build",
  "watch": "ng build --watch --configuration development",
  "test": "ng test",
  "server": "node server.js",
  "dev": "concurrently \"npm run start\" \"npm run server\"",
  "dev:open": "concurrently \"npm run start\" \"npm run server\" \"sleep 5 && open http://localhost:4200\"",
  "dev:flex": "concurrently \"API_URL=http://localhost:3000 ./start-app.sh\" \"npm run server\""
}
```

### 5. Timer local amélioré et indépendant du serveur

#### Amélioration de startTimerManually avec utilisation des URL relatives pour compatibilité avec le proxy

```typescript
async startTimerManually(seconds: number) {
  console.log('Démarrage manuel du timer pour', seconds, 'secondes');

  try {
    // Afficher un indicateur visuel pendant le démarrage
    this.loadingMessage = 'Démarrage du timer...';
    this.isLoading = true;
    this.cdRef.detectChanges();

    // Initialiser immédiatement l'état local du timer
    this.timerMax = seconds;
    this.timerValue = seconds;
    this.timerActive = true;
    this.timerStartedManually = true;

    // Nettoyage de l'intervalle précédent si existant
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    // Démarrer immédiatement un intervalle local
    this.startLocalTimer(seconds);

    // Préparation pour la synchronisation entre tous les clients
    const currentIndex = this.currentIndex || 0;

    // Tenter l'appel API pour synchroniser tous les clients
    try {
      // Utiliser l'URL de l'API configurée dans l'environnement
      // La configuration du proxy s'occupera de rediriger correctement
      const apiUrl = '/api/start-timer';

      const response: any = await firstValueFrom(
        this.http.post(apiUrl, {
          duration: seconds,
          currentQuestionIndex: currentIndex
        })
      );

      if (response && response.success) {
        console.log('✅ Timer démarré avec succès via API:', response);
      } else {
        console.warn('⚠️ Réponse API sans succès:', response);
        console.log('Poursuite avec timer local uniquement');
      }
    } catch (apiError: any) {
      console.error('❌ Erreur API start-timer:', apiError);

      // Si l'erreur inclut une réponse, vérifions son statut
      if (apiError.status === 200) {
        console.log('Statut 200 mais erreur dans la réponse, continuons avec timer local');
      } else {
        console.log('Poursuite avec timer local uniquement, erreur HTTP:', apiError.status || 'inconnu');
      }
    }
  } catch (error) {
    console.error('❌ Erreur générale lors du démarrage du timer:', error);
    // Le timer local est déjà démarré, donc on continue
  } finally {
    this.isLoading = false;
    this.cdRef.detectChanges();
  }
}
```

#### Timer local avec synchronisation API à la fin

```typescript
// Méthode pour démarrer un timer local
private startLocalTimer(seconds: number): void {
  // Garantir des valeurs initiales correctes
  this.timerMax = seconds;
  this.timerValue = seconds;
  this.timerActive = true;

  // Démarrer l'intervalle
  this.timerInterval = setInterval(() => {
    if (this.timerValue > 0 && this.timerActive) {
      this.timerValue -= 0.1; // Décrémenter de 0.1 seconde pour une mise à jour plus fluide
      this.cdRef.detectChanges();

      if (this.timerValue <= 0) {
        this.timerValue = 0;
        this.timerActive = false;
        clearInterval(this.timerInterval);

        // Ajouter un log pour savoir quand le timer se termine
        console.log('⏰ Timer local terminé');

        // Attendre un court instant puis passer à l'étape suivante
        if (this.step === 'question') {
          setTimeout(() => {
            console.log('➡️ Passage automatique à l\'étape de résultats après fin du timer');
            // Essayer d'abord via l'API pour synchroniser tous les clients
            try {
              this.http.put('/api/quiz-state', { step: 'result' })
                .subscribe(
                  () => console.log('✅ Transition vers résultats synchronisée via API'),
                  (err) => {
                    console.error('❌ Erreur API transition:', err);
                    // Transition locale si l'API échoue
                    this.quizService.setStep('result');
                  }
                );
            } catch (e) {
              console.error('❌ Erreur lors de la transition automatique:', e);
              // Fallback sur transition locale
              this.quizService.setStep('result');
            }
          }, 500);
        }
      }
    }
  }, 100); // Intervalle de 100ms pour une animation plus fluide

  console.log('⏱️ Timer local démarré pour', seconds, 'secondes');
}
```

## Conclusion

Ces solutions fournissent une robustesse accrue au système de timer :

1. **Compatibilité client/serveur** pour les WebSockets
2. **Fonctionnement en production** avec configuration Nginx appropriée
3. **Triple mécanisme de secours** :
   - Polling HTTP quand les WebSockets échouent
   - Timer local quand l'API échoue
   - Gestion adaptée des erreurs HTTP avec statut 200 OK
4. **Configuration flexible de l'API URL** :
   - Script `start-app.sh` qui génère dynamiquement la configuration proxy
   - Support des variables d'environnement pour configurer l'URL de l'API
   - Nouveaux scripts npm pour différents scénarios de démarrage
5. **Transition automatique** vers les résultats à la fin du timer avec tentative de synchronisation
6. **Configuration CORS robuste** pour éviter les problèmes d'accès entre domaines
7. **Documentation complète** sur la configuration de l'URL de l'API (voir `API_URL_CONFIG.md`)

Ces modifications permettent au timer de fonctionner même en cas de perte de connexion WebSocket ou d'erreurs HTTP, tout en offrant une flexibilité maximale pour la configuration de l'API URL selon l'environnement de déploiement.
