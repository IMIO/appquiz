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