/**
 * Script pour améliorer le reset des participants dans l'application Quiz
 * Ce script résout deux problèmes :
 * 1. Supprime les méthodes dupliquées restartGame() et resetParticipants()
 * 2. Améliore la méthode restartGame() pour garantir que tous les participants sont bien supprimés
 */

const fs = require('fs');
const path = require('path');

// Chemin du fichier à modifier
const componentFilePath = path.join(__dirname, 'src', 'app', 'presentation', 'presentation.component.ts');

try {
  console.log('Lecture du fichier du composant de présentation...');
  const content = fs.readFileSync(componentFilePath, 'utf8');

  // Regex pour trouver toutes les instances de resetParticipants()
  const resetParticipantsRegex = /\s*public async resetParticipants\(\) \{\s*await this\.quizService\.resetParticipants\(\);\s*\}/g;
  
  // Regex pour trouver les méthodes restartGame() dans le fichier
  const restartGameRegex = /\s*async restartGame\(\) \{[\s\S]*?console\.log\('\[RESET\] 5\. ✅ État local réinitialisé'\);[\s\S]*?\}/g;

  // Version améliorée de la méthode resetParticipants
  const newResetParticipants = `
  /**
   * Réinitialise uniquement les participants via l'API
   * Cette méthode est utilisée par restartGame() et d'autres fonctions
   */
  public async resetParticipants() {
    console.log('[RESET] Suppression des participants via API...');
    await this.quizService.resetParticipants();
    
    // Vider la liste locale immédiatement
    this.participants = [];
    this.cdr.detectChanges(); // Force l'UI à mettre à jour
    
    console.log('[RESET] Participants supprimés et interface mise à jour');
  }`;

  // Version améliorée de la méthode restartGame
  const newRestartGame = `
  /**
   * Réinitialisation complète du quiz (étape, participants, index, réponses)
   * Cette méthode garantit que tous les joueurs sont bien supprimés partout
   */
  async restartGame() {
    if (!confirm('Êtes-vous sûr de vouloir réinitialiser complètement le quiz ? Cette action supprimera tous les participants et toutes les réponses.')) {
      return;
    }

    console.log('[RESET] Début de la réinitialisation du quiz');

    try {
      // Étape 1: Supprimer tous les participants
      console.log('[RESET] 1. Suppression des participants...');
      await this.quizService.resetParticipants();
      
      // Vider la liste locale immédiatement pour l'UI
      this.participants = [];
      this.leaderboard = [];
      this.cdr.detectChanges(); // Force l'UI à mettre à jour immédiatement
      
      console.log('[RESET] 1. ✅ Participants supprimés');

      // Étape 2: Réinitialiser toutes les réponses
      console.log('[RESET] 2. Reset des réponses...');
      await this.quizService.resetAllAnswers();
      console.log('[RESET] 2. ✅ Réponses supprimées');

      // Étape 3: Forcer le passage à l'étape "lobby"
      console.log('[RESET] 3. Passage forcé à l\\'étape lobby...');
      // Double appel pour s'assurer de la propagation WebSocket
      await this.quizService.setStep('lobby');
      // Petit délai pour laisser le temps au WebSocket de traiter
      await new Promise(resolve => setTimeout(resolve, 500));
      await this.quizService.setStep('lobby'); // Second appel pour forcer
      console.log('[RESET] 3. ✅ Étape lobby définie et rediffusée');
      
      // Étape 4: Vérification de la suppression complète des participants
      console.log('[RESET] 4. Vérification des participants sur le serveur...');
      const participants = await this.quizService.fetchParticipantsFromServer();
      
      // Double vérification que la liste est bien vide
      if (participants && participants.length > 0) {
        console.error('[RESET] ⚠️ ATTENTION: Le serveur a retourné des participants après reset:', participants);
        // Forcer la liste vide localement pour être sûr
        this.participants = [];
        // Nouvelle tentative de reset côté serveur
        await this.quizService.resetParticipants();
      } else {
        console.log('[RESET] 4. ✅ Confirmation de liste vide:', participants?.length || 0);
        this.participants = [];
      }
      
      this.cdr.detectChanges();

      console.log('[INFO] Quiz reset via HTTP API');
      alert('Quiz réinitialisé. Tous les participants et réponses ont été supprimés.');

      // Étape 5: Réinitialisation de l'état local du composant
      console.log('[RESET] 5. Réinitialisation locale de l\\'état...');
      this.step = 'lobby';
      this.currentIndex = 0;
      this.currentQuestion = null;
      this.answersCount = [];
      this.leaderboard = [];
      this.imageLoaded = false; // Reset image state
      this.resultImageLoaded = false; // Reset result image state
      
      // Vérification finale après un délai pour s'assurer que tout est vide
      setTimeout(async () => {
        const checkParticipants = await this.quizService.fetchParticipantsFromServer();
        console.log('[RESET] Vérification finale participants:', checkParticipants?.length || 0);
        if (checkParticipants && checkParticipants.length > 0) {
          console.warn('[RESET] ⚠️ Des participants existent encore après reset! Nouvelle tentative...');
          await this.quizService.resetParticipants();
          this.participants = [];
          this.cdr.detectChanges();
        }
      }, 2000);
      
      console.log('[RESET] 5. ✅ État local réinitialisé');
    } catch (error) {
      console.error('[RESET] ❌ Erreur lors de la réinitialisation:', error);
      alert('Une erreur est survenue lors de la réinitialisation. Veuillez réessayer.');
    }
  }`;

  // Supprime toutes les instances de resetParticipants() dupliquées
  let updatedContent = content.replace(resetParticipantsRegex, '');
  
  // Supprime toutes les instances de restartGame() dupliquées
  updatedContent = updatedContent.replace(restartGameRegex, '');
  
  // Ajoute les nouvelles versions des méthodes à la fin du composant (avant la dernière accolade)
  updatedContent = updatedContent.replace(/}(\s*)$/s, 
    `${newResetParticipants}\n\n${newRestartGame}\n}$1`);

  // Écrire le fichier mis à jour
  fs.writeFileSync(componentFilePath, updatedContent, 'utf8');
  console.log('Méthodes resetParticipants() et restartGame() mises à jour avec succès!');
  
  console.log('\nAméliorations appliquées :');
  console.log('1. Suppression des méthodes dupliquées');
  console.log('2. Vérification plus stricte que la liste des participants est bien vidée');
  console.log('3. Multiples vérifications de la réinitialisation côté serveur');
  console.log('4. Mise à jour immédiate de l\'interface utilisateur');
  console.log('5. Vérification finale après un délai pour garantir la suppression complète');
  
} catch (error) {
  console.error('Erreur lors de la mise à jour du fichier:', error);
}