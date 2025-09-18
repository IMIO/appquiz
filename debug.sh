#!/bin/bash

# Script de debug pour l'application quiz

API_URL="http://localhost:3000/api"

echo "🎯 Quiz Debug Helper"
echo "==================="

case "$1" in
  "state")
    echo "📊 État actuel du quiz:"
    curl -s "$API_URL/quiz-state" | jq
    ;;
  "participants")
    echo "👥 Participants:"
    curl -s "$API_URL/participants" | jq
    ;;
  "questions")
    echo "📚 Questions:"
    curl -s "$API_URL/questions" | jq length
    echo "questions disponibles"
    ;;
  "start-question")
    echo "🚀 Démarrage de la première question..."
    curl -s -X PUT "$API_URL/quiz-state" \
      -H "Content-Type: application/json" \
      -d "{
        \"step\": \"question\",
        \"currentQuestionIndex\": 0,
        \"questionStartTime\": $(date +%s000)
      }" | jq
    ;;
  "lobby")
    echo "🏠 Retour au lobby..."
    curl -s -X PUT "$API_URL/quiz-state" \
      -H "Content-Type: application/json" \
      -d '{"step": "lobby"}' | jq
    ;;
  "reset")
    echo "🔄 Reset complet..."
    curl -s -X POST "$API_URL/quiz/reset" | jq
    ;;
  "add-participant")
    if [ -z "$2" ]; then
      echo "Usage: $0 add-participant <nom>"
      exit 1
    fi
    echo "👤 Ajout du participant: $2"
    user_id="player-$(date +%s)"
    curl -s -X POST "$API_URL/participants" \
      -H "Content-Type: application/json" \
      -d "{
        \"id\": \"$user_id\",
        \"name\": \"$2\"
      }" | jq
    ;;
  "health")
    echo "🏥 Vérification de l'état du serveur:"
    curl -s "$API_URL/../health" | jq
    ;;
  *)
    echo "Commands disponibles:"
    echo "  state           - Affiche l'état du quiz"
    echo "  participants    - Liste des participants"
    echo "  questions       - Nombre de questions"
    echo "  start-question  - Démarre la première question"
    echo "  lobby          - Retour au lobby"
    echo "  reset          - Reset complet"
    echo "  add-participant <nom> - Ajoute un participant"
    echo "  health         - Vérifie le serveur"
    echo ""
    echo "Exemple: $0 start-question"
    ;;
esac