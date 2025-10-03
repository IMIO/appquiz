#!/bin/bash

# Script de déploiement pour Quiz App
# Usage: ./deploy.sh [destination]

echo "🚀 Préparation du déploiement de Quiz App..."

# Définir le dossier de destination
DEST=${1:-"./deploy"}
echo "📁 Destination: $DEST"

# Vérifier si le dossier existe déjà et le supprimer s'il existe
if [ -d "$DEST" ]; then
  echo "🗑️ Suppression de l'ancien dossier de déploiement..."
  rm -rf "$DEST"
fi

# Créer le build de production
echo "🔨 Création du build de production..."
npm run build -- --configuration production

# Créer le dossier de destination si besoin
mkdir -p "$DEST"

# Copier les fichiers de build
echo "📋 Copie des fichiers vers $DEST..."
cp -R ./dist/quiz-app/* "$DEST/"

# Copier le serveur backend nécessaire
echo "🖥️ Copie des fichiers serveur..."
cp ./server.js "$DEST/"
cp ./package.json "$DEST/"
cp ./package-lock.json "$DEST/"

# Copier la base de données si nécessaire
if [ -f "./quiz.db" ]; then
  echo "🗃️ Copie de la base de données..."
  cp ./quiz.db "$DEST/"
fi

# Copier les fichiers de configuration nécessaires
echo "⚙️ Copie des fichiers de configuration..."
if [ -f "./nginx.conf" ]; then
  cp ./nginx.conf "$DEST/"
fi

echo "✅ Déploiement préparé avec succès!"
echo "📦 Pour installer les dépendances du serveur: cd $DEST && npm install --production"
echo "▶️ Pour démarrer le serveur: cd $DEST && node server.js"

# Si vous avez Docker, suggérer la commande Docker
if command -v docker &> /dev/null; then
  echo "🐳 Ou avec Docker: docker-compose up -d (après avoir copié docker-compose.yml)"
fi