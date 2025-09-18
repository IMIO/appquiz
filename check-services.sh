#!/bin/bash

# Script de vérification des services quiz

echo "🔍 Vérification des services Quiz"
echo "=================================="

# Vérification du serveur SQLite
echo -n "🗄️  Serveur SQLite (port 3000): "
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ ACTIF"
    # Vérifier les questions
    QUESTIONS_COUNT=$(curl -s http://localhost:3000/api/questions | jq length 2>/dev/null)
    if [ "$QUESTIONS_COUNT" = "10" ]; then
        echo "   📚 Questions: ✅ $QUESTIONS_COUNT questions chargées"
    else
        echo "   📚 Questions: ⚠️  $QUESTIONS_COUNT questions (attendu: 10)"
    fi
else
    echo "❌ INACTIF"
    echo "   💡 Pour démarrer: cd /Users/broemman/quiz-app && node server.js"
fi

# Vérification du serveur Angular
echo -n "🅰️  Serveur Angular (port 4200): "
if curl -s http://localhost:4200 > /dev/null 2>&1; then
    echo "✅ ACTIF"
else
    echo "❌ INACTIF"
    echo "   💡 Pour démarrer: npm start"
fi

echo ""
echo "🌐 URLs de l'application:"
echo "   👥 Interface Joueur:    http://localhost:4200"
echo "   🎯 Interface Maître:    http://localhost:4200/presentation"
echo "   🔗 API Backend:         http://localhost:3000/api"

# Vérification des processus Node.js
echo ""
echo "🔧 Processus en cours:"
ps aux | grep -E "(node server.js|ng serve)" | grep -v grep | while read line; do
    echo "   🟢 $line"
done

echo ""
echo "💡 Commandes utiles:"
echo "   ./debug.sh state        - État du quiz"
echo "   ./debug.sh start-question - Démarrer une question"
echo "   ./debug.sh reset        - Reset complet"