# Configuration flexible de l'API URL

Ce document explique comment configurer l'URL de l'API pour l'application Quiz de manière flexible.

## Méthodes disponibles

### 1. Via le script start-app.sh

Le script `start-app.sh` permet de démarrer l'application avec une URL d'API personnalisée via la variable d'environnement `API_URL` :

```bash
# Utiliser une URL personnalisée
API_URL=http://mon-serveur.example.com ./start-app.sh

# Changer aussi le port d'écoute
API_URL=http://mon-serveur.example.com PORT=8080 ./start-app.sh
```

### 2. Via les scripts npm

Plusieurs scripts sont disponibles dans package.json :

- `npm run start` - Démarre l'application avec la configuration standard
- `npm run start:flex` - Démarre l'application avec la configuration flexible (via start-app.sh)
- `npm run dev` - Démarre le frontend et le backend en parallèle
- `npm run dev:flex` - Démarre le frontend (avec configuration flexible) et le backend en parallèle

Exemple avec une URL personnalisée :

```bash
API_URL=http://mon-api.example.com npm run start:flex
```

### 3. En production

En production, la configuration d'URL est simplifiée :

1. L'application utilise une URL relative `/api` qui est proxifiée vers le backend
2. Le serveur Nginx s'occupe de rediriger les requêtes vers le backend approprié
3. Pas besoin de spécifier d'URL complète

## Comprendre le fonctionnement

1. Le script `start-app.sh` génère dynamiquement un fichier `proxy.conf.json` basé sur la variable d'environnement `API_URL`
2. Angular utilise ce fichier proxy pour rediriger les requêtes `/api/*` vers l'URL de l'API configurée
3. Le code de l'application utilise toujours des chemins relatifs (`/api/start-timer`, etc.)
4. La redirection est gérée de manière transparente par le proxy ou par Nginx en production

Cette approche permet de garder le code de l'application propre et de changer l'URL de l'API sans modifier le code source.
