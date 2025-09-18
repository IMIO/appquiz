#!/usr/bin/env node

/**
 * Script pour ajouter des questions personnalisées à la base SQLite
 * Usage: node add-questions.js
 */

const axios = require('axios');
const readline = require('readline');

const API_URL = 'http://localhost:3000/api';

// Interface pour saisie utilisateur
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

// Vos questions originales d'accessibilité web
const questionsFirebase = [
  {
    id: 1,
    text: "Quelle est une bonne pratique pour rendre un filtre ou un menu accessible au clavier ?",
    options: [
      "Utiliser des raccourcis clavier spécifiques uniquement pour les utilisateurs avancés",
      "S'assurer que l'utilisateur peut naviguer avec la touche Tab et activer avec Entrée/Espace",
      "Rendre le menu invisible pour les lecteurs d'écran",
      "Ajouter un script qui simule les clics de souris automatiquement"
    ],
    correctIndex: 1
  },
  {
    id: 2,
    text: "Pourquoi faut-il utiliser un bouton plutôt qu'un lien dans certains cas ?",
    options: [
      "Parce qu'un bouton permet de déclencher une action comme soumettre un formulaire",
      "Parce qu'un bouton améliore la vitesse de chargement de la page",
      "Parce qu'un bouton est plus simple à traduire que les liens",
      "Parce qu'un bouton est toujours mieux référencé par Google"
    ],
    correctIndex: 0
  },
  {
    id: 3,
    text: "Pourquoi ajoute-t-on des aria-label aux éléments comme un logo ou un bouton ?",
    options: [
      "Pour donner une description claire aux technologies d'assistance (lecteurs d'écran)",
      "Pour éviter que les éléments soient indexés par les moteurs de recherche",
      "Pour permettre au CSS d'ajouter automatiquement des styles dynamiques",
      "Pour remplacer l'attribut alt des images décoratives"
    ],
    correctIndex: 0
  },
  {
    id: 4,
    text: "Quelle est la bonne pratique lorsqu'un lien ouvre une nouvelle fenêtre ou un nouvel onglet (target=\"_blank\") ?",
    options: [
      "Prévenir l'utilisateur via un attribut title ou un indicateur visuel",
      "Masquer le lien aux utilisateurs de lecteurs d'écran",
      "Forcer tous les liens à s'ouvrir en mode impression",
      "Ajouter un mot-clé SEO spécial dans l'URL"
    ],
    correctIndex: 0
  },
  {
    id: 5,
    text: "Quelle est la bonne pratique concernant l'attribut alt des images ?",
    options: [
      "Décrire brièvement l'image si elle apporte une information, sinon laisser vide si elle est purement décorative",
      "Ajouter un alt identique pour toutes les images d'un site",
      "Indiquer le nom du photographe systématiquement",
      "Mettre des hashtags ou mots-clés SEO dans le champ alt"
    ],
    correctIndex: 0
  },
  {
    id: 6,
    text: "Comment améliorer l'accessibilité d'une vidéo intégrée via une iframe ?",
    options: [
      "Ajouter un attribut title indiquant la source ou le contenu",
      "Forcer l'autoplay avec le son activé",
      "Supprimer les contrôles pour simplifier l'expérience",
      "Ajouter un lien caché vers un site externe non lié"
    ],
    correctIndex: 0
  },
  {
    id: 7,
    text: "Pourquoi est-il important que les mentions légales, infos accessibilité et copyright soient présentes dans le colophon (footer) ?",
    options: [
      "Pour respecter les obligations légales et garantir l'accès rapide à ces informations essentielles",
      "Pour éviter que le site soit bloqué par les bloqueurs de pub",
      "Pour que les utilisateurs puissent naviguer sans utiliser la barre de recherche",
      "Pour réduire le nombre de pages vues et simplifier les statistiques"
    ],
    correctIndex: 0
  },
  {
    id: 8,
    text: "Quelle est la bonne pratique pour rendre des boutons de consentement accessibles ?",
    options: [
      "Leur donner un aria-label clair décrivant l'action",
      "Masquer les boutons de refus pour éviter les confusions",
      "Ajouter uniquement une couleur contrastée sans texte",
      "Supprimer les boutons après un délai court"
    ],
    correctIndex: 0
  },
  {
    id: 9,
    text: "Pourquoi traduire les aria-labels en plusieurs langues (FR/DE/NL) ?",
    options: [
      "Parce que les lecteurs d'écran doivent restituer l'information dans la langue de l'utilisateur",
      "Parce que Chrome bloque l'affichage des labels non traduits",
      "Parce que cela permet d'activer automatiquement le mode \"voix off\"",
      "Parce que sans traduction, les labels ne s'affichent pas sur mobile"
    ],
    correctIndex: 0
  },
  {
    id: 10,
    text: "Pourquoi est-il important d'utiliser correctement les attributs de navigation (<nav>, role=\"navigation\", etc.) ?",
    options: [
      "Pour permettre aux technologies d'assistance de comprendre et d'annoncer la structure de la page",
      "Pour empêcher les moteurs de recherche d'indexer la navigation",
      "Pour réduire le temps de chargement de la page",
      "Pour forcer l'utilisation du clavier uniquement"
    ],
    correctIndex: 0
  }
];

async function addQuestionToServer(question) {
  try {
    const response = await axios.post(`${API_URL}/questions`, question, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`✅ Question ajoutée: "${question.text}"`);
    return response.data;
  } catch (error) {
    console.error(`❌ Erreur ajout question: ${error.message}`);
    return null;
  }
}

async function getCurrentQuestions() {
  try {
    const response = await axios.get(`${API_URL}/questions`);
    return response.data;
  } catch (error) {
    console.error('❌ Erreur récupération questions:', error.message);
    return [];
  }
}

async function resetQuestions() {
  try {
    // Reset complet
    await axios.post(`${API_URL}/quiz/reset`);
    console.log('✅ Questions et quiz reset');
  } catch (error) {
    console.error('❌ Erreur reset:', error.message);
  }
}

async function main() {
  console.log('🎯 Script d\'ajout de questions personnalisées\n');
  
  // Vérifier la connexion au serveur
  try {
    await axios.get(`${API_URL}/questions`);
    console.log('✅ Connexion au serveur OK\n');
  } catch (error) {
    console.error('❌ Serveur non accessible. Assurez-vous que le serveur SQLite est démarré.');
    console.error('   Commande: node server.js');
    process.exit(1);
  }

  const currentQuestions = await getCurrentQuestions();
  console.log(`📚 Questions actuelles: ${currentQuestions.length}`);
  currentQuestions.forEach((q, i) => {
    console.log(`   ${i+1}. ${q.text}`);
  });

  console.log('\n🔄 Options:');
  console.log('1. Remplacer par les questions Firebase de base');
  console.log('2. Ajouter une nouvelle question manuellement');
  console.log('3. Reset complet et ajouter questions Firebase');
  console.log('4. Quitter');

  const choice = await question('\nVotre choix (1-4): ');

  switch (choice) {
    case '1':
      console.log('\n📝 Ajout des questions Firebase...');
      for (const q of questionsFirebase) {
        await addQuestionToServer(q);
      }
      break;

    case '2':
      console.log('\n📝 Ajout d\'une nouvelle question:');
      const id = parseInt(await question('ID de la question: ')) || (currentQuestions.length + 1);
      const text = await question('Texte de la question: ');
      
      console.log('Options (séparez par des virgules):');
      const optionsStr = await question('Entrez les options: ');
      const options = optionsStr.split(',').map(opt => opt.trim());
      
      const correctIndex = parseInt(await question('Index de la bonne réponse (0-based): ')) || 0;
      
      const newQuestion = { id, text, options, correctIndex };
      await addQuestionToServer(newQuestion);
      break;

    case '3':
      console.log('\n🔄 Reset complet et ajout questions Firebase...');
      await resetQuestions();
      
      // Attendre un peu pour que le reset soit effectif
      setTimeout(async () => {
        for (const q of questionsFirebase) {
          await addQuestionToServer(q);
        }
      }, 1000);
      break;

    case '4':
      console.log('👋 Au revoir!');
      break;

    default:
      console.log('❌ Choix invalide');
  }

  rl.close();
}

// Gestion des erreurs
process.on('unhandledRejection', (error) => {
  console.error('❌ Erreur:', error.message);
  process.exit(1);
});

if (require.main === module) {
  main();
}

module.exports = { addQuestionToServer, questionsFirebase };