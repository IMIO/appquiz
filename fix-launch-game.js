/**
 * Script pour corriger le problème de duplication de la méthode launchGame
 * et ajouter une meilleure gestion des erreurs et logs
 */
const fs = require('fs');
const path = require('path');

const componentFilePath = path.join(__dirname, 'src', 'app', 'presentation', 'presentation.component.ts');

try {
    console.log('Lecture du fichier component...');
    let content = fs.readFileSync(componentFilePath, 'utf8');

    // 1. Supprimer la méthode launchGame dupliquée
    // Méthode unique améliorée à insérer
    const newLaunchGameMethod = `
  async launchGame() {
    // Passe à l'étape "waiting" avant de lancer la première question
    console.log('[DEBUG] launchGame() appelé - Passage à l\'étape "waiting"');
    try {
      const success = await this.quizService.setStep('waiting');
      console.log('[DEBUG] Étape "waiting" définie avec succès =', success);
      
      // Force la vérification de l'état après un court délai pour s'assurer que la transition a eu lieu
      setTimeout(async () => {
        const currentStep = await this.quizService.forceCheckState();
        console.log('[DEBUG] Vérification d\'état après transition: step =', currentStep);
        
        if (currentStep !== 'waiting') {
          console.error('[DEBUG] ERREUR: L\'état n\'est pas passé à "waiting" comme prévu');
          // Nouvelle tentative
          console.log('[DEBUG] Nouvelle tentative de passage à l\'étape "waiting"');
          await this.quizService.setStep('waiting');
        }
      }, 1000);
    } catch (error) {
      console.error('[ERROR] Erreur lors du passage à l\'étape "waiting":', error);
    }
  }`;

    // Identifie et remplace toutes les instances de la méthode launchGame
    const launchGameRegex = /\s*launchGame\(\) \{\s*\/\/ Passe à l'étape "waiting" avant de lancer la première question\s*this\.quizService\.setStep\('waiting'\);\s*\}/g;
    
    // Remplace toutes les occurrences par la nouvelle implémentation
    content = content.replace(launchGameRegex, newLaunchGameMethod);

    // Compte le nombre de remplacements
    const matchCount = (content.match(/async launchGame\(\)/g) || []).length;
    
    console.log(`Nombre d'occurrences de la nouvelle méthode async launchGame() trouvées: ${matchCount}`);

    // Écrit le fichier mis à jour
    fs.writeFileSync(componentFilePath, content, 'utf8');
    console.log('Fichier sauvegardé avec succès!');
    
    console.log('\nCorrections appliquées:');
    console.log('1. Méthode launchGame() améliorée pour inclure:');
    console.log('   - Gestion des erreurs');
    console.log('   - Logs de débogage');
    console.log('   - Vérification de la transition d\'état');
    console.log('   - Nouvelle tentative en cas d\'échec');

} catch (error) {
    console.error('Erreur lors de la mise à jour du fichier:', error);
}