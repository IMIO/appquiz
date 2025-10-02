/**
 * Ce script corrige la méthode resetQuiz() incomplète dans le fichier PresentationComponent
 * en la remplaçant par une version correcte.
 */

const fs = require('fs');
const path = require('path');

// Chemin du fichier à modifier
const filePath = path.join(__dirname, 'src', 'app', 'presentation', 'presentation.component.ts');

try {
  // Lire le contenu du fichier
  console.log('Lecture du fichier...');
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Trouver et corriger la méthode resetQuiz() incorrecte
  const resetQuizRegex = /\/\/ Réinitialisation complète du quiz \(étape, participants, index, réponses\) catch \(error\) \{[\s\S]*?this\.refresh\(\);[\s\S]*?\}/g;
  
  const correctResetQuiz = `// Réinitialisation complète du quiz (étape, participants, index, réponses)
  async resetQuiz() {
    try {
      await this.quizService.resetParticipants();
      await this.quizService.resetAllAnswers();
      await this.quizService.setStep('lobby');
    } catch (error) {
      console.error('[RESET] ❌ Erreur lors de la réinitialisation:', error);
      const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
      alert(\`Erreur lors de la réinitialisation du quiz: \${errorMsg}\`);
    }
    this.timerValue = 20;
    this.voters = [];

    // Arrêter les subscriptions existantes pour éviter les logs répétés
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];

    this.refresh();
  }`;
  
  // Appliquer la correction
  content = content.replace(resetQuizRegex, correctResetQuiz);
  
  // Supprimer la duplication de getParticipantNames() et checkParticipantsDirectly()
  // On trouve la fin du fichier après le dernier checkParticipantsDirectly() et on assure une fermeture propre
  const endOfFileRegex = /(\s*\/\/ Méthode pour afficher le nom des participants pour le débogage[\s\S]*?return Promise.resolve\(\);[\s\S]*?)(\s*\}\s*$)/;
  if (endOfFileRegex.test(content)) {
    content = content.replace(endOfFileRegex, (match, duplicated, closing) => {
      return closing; // Garder uniquement la fermeture de classe
    });
  }
  
  // Écrire le fichier corrigé
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Correction de la méthode resetQuiz() réussie !');
  
} catch (error) {
  console.error('❌ Erreur lors de la correction du fichier:', error);
}