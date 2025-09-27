#!/bin/bash

# Script de test pour vérifier la synchronisation du timer

echo "🧪 Test de synchronisation du timer"
echo "====================================="

echo ""
echo "📋 Instructions de test :"
echo "1. Ouvrir http://localhost:4200/presentation (onglet maître du jeu)"
echo "2. Ouvrir http://localhost:4200/login (onglet joueur)"
echo "3. S'inscrire comme joueur → il ira sur /waiting"
echo "4. Dans l'onglet présentation, cliquer sur 'Commencer le Quiz' → 'Démarrer la première question'"
echo "5. Vérifier que le joueur a bien le timer complet (20 secondes) quand il arrive sur /quiz"

echo ""
echo "🔍 Points à vérifier :"
echo "- Le joueur doit avoir ~20 secondes de timer (pas 15 ou moins)"
echo "- Le timer doit décompter correctement seconde par seconde"
echo "- Les logs dans la console doivent montrer 'Question vient de commencer, temps plein accordé'"

echo ""
echo "🚀 Pour démarrer les serveurs si ils ne tournent pas déjà :"
echo "npm run dev"

echo ""
echo "📊 Surveillez les logs dans la console du navigateur pour voir la synchronisation"
echo "Recherchez les messages commençant par '🕐 Timer sync:'"