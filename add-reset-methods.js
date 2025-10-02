/**
 * Ce script ajoute les méthodes resetParticipants() et restartGame() au composant de présentation.
 */

const fs = require('fs');
const path = require('path');

// Chemin du fichier à modifier
const filePath = path.join(__dirname, 'src', 'app', 'presentation', 'presentation.component.ts');

try {
  // Lire le contenu du fichier
  console.log('Lecture du fichier...');
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Méthodes à ajouter
  const methodsToAdd = `
  /**
   * Réinitialise uniquement les participants via l'API
   * Cette méthode est utilisée par restartGame() et d'autres fonctions
   */
  public async resetParticipants(): Promise<void> {
    console.log('[RESET] Suppression des participants via API...');
    await this.quizService.resetParticipants();
    
    // Vider la liste locale immédiatement
    this.participants = [];
    this.cdr.detectChanges(); // Force l'UI à mettre à jour
    
    console.log('[RESET] Participants supprimés et interface mise à jour');
  }

  /**
   * Réinitialisation complète du quiz (étape, participants, index, réponses)
   * Cette méthode garantit que tous les joueurs sont bien supprimés partout
   */
  async restartGame(): Promise<void> {
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
  
  // Supprimer les versions existantes de ces méthodes
  content = content.replace(/public async resetParticipants\(\)[\s\S]*?\}[\s\S]*?\}/g, '');
  content = content.replace(/async restartGame\(\)[\s\S]*?\}[\s\S]*?\}/g, '');
  
  // Ajouter les nouvelles méthodes avant la dernière accolade
  content = content.replace(/}(\s*)$/, `${methodsToAdd}\n}$1`);
  
  // Écrire le fichier mis à jour
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Ajout des méthodes resetParticipants() et restartGame() réussi !');
  
} catch (error) {
  console.error('❌ Erreur lors de la mise à jour du fichier:', error);
}