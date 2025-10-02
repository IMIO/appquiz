/**
 * Script pour corriger les erreurs TypeScript dans l'application Quiz
 * Ce script résout plusieurs problèmes :
 * 1. Corrige les méthodes resetQuiz() incomplètes ou mal formées
 * 2. Supprime les méthodes dupliquées getParticipantNames() et checkParticipantsDirectly()
 * 3. S'assure que la classe est correctement fermée à la fin du fichier
 * 4. Intègre correctement les méthodes resetParticipants() et restartGame()
 */

const fs = require('fs');
const path = require('path');

// Chemin du fichier à modifier
const componentFilePath = path.join(__dirname, 'src', 'app', 'presentation', 'presentation.component.ts');

try {
  console.log('Lecture du fichier du composant de présentation...');
  const content = fs.readFileSync(componentFilePath, 'utf8');

  // Regex pour trouver les méthodes resetQuiz() incomplètes
  const resetQuizRegex = /\/\/ Réinitialisation complète du quiz \(étape, participants, index, réponses\) catch \(error\) \{[\s\S]*?this\.refresh\(\);[\s\S]*?\}/g;

  // Regex pour trouver les méthodes dupliquées à la fin
  const duplicatedMethodsRegex = /\s*\/\/ Méthode pour afficher le nom des participants pour le débogage[\s\S]*?Promise\.resolve\(\);[\s\S]*?\}[\s\S]*?$/g;

  // Regex pour la classe finale (pour assurer que la classe est bien fermée)
  const classEndRegex = /\}(\s*)$/;

  // Version correcte de la méthode resetQuiz()
  const correctResetQuiz = `
  // Réinitialisation complète du quiz (étape, participants, index, réponses)
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

  // Version correcte de la méthode resetParticipants()
  const correctResetParticipants = `
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

  // Version correcte de la méthode restartGame()
  const correctRestartGame = `
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

  // Méthode getParticipantNames correcte (garder une seule instance)
  const correctGetParticipantNames = `
  // Méthode pour afficher le nom des participants pour le débogage
  getParticipantNames(): string {
    if (!this.participants || this.participants.length === 0) return "Aucun";
    return this.participants.map(p => p.name).join(', ');
  }`;

  // Méthode checkParticipantsDirectly correcte (garder une seule instance)
  const correctCheckParticipantsDirectly = `
  // Méthode pour vérifier directement les participants auprès du serveur
  async checkParticipantsDirectly(): Promise<void> {
    console.log('[DEBUG] Vérification directe des participants auprès du serveur...');
    try {
      const response = await fetch('http://localhost:3000/api/participants');
      const data = await response.json();
      
      if (Array.isArray(data)) {
        console.log(\`[DEBUG] Participants récupérés directement: \${data.length}\`);
        
        if (data.length > 0) {
          // Afficher les informations détaillées sur chaque participant
          console.log('[DEBUG] Liste des participants:');
          data.forEach((p, idx) => {
            console.log(\`[DEBUG] \${idx+1}. \${p.name} (ID: \${p.id})\`);
          });
          
          // Vérifier si certains participants sont absents de la liste locale
          const localIds = this.participants.map(p => String(p.id));
          const serverIds = data.map(p => String(p.id));
          
          const missingLocally = data.filter(p => !localIds.includes(String(p.id)));
          if (missingLocally.length > 0) {
            console.warn(\`[DEBUG] ⚠️ \${missingLocally.length} participants sur le serveur mais absents localement:\`, 
              missingLocally.map(p => p.name).join(', '));
          }
          
          const missingOnServer = this.participants.filter(p => !serverIds.includes(String(p.id)));
          if (missingOnServer.length > 0) {
            console.warn(\`[DEBUG] ⚠️ \${missingOnServer.length} participants locaux mais absents du serveur:\`, 
              missingOnServer.map(p => p.name).join(', '));
          }
          
          // Mettre à jour la liste locale avec les données du serveur
          this.participants = data;
          console.log('[DEBUG] ✅ Participants mis à jour:', this.participants.length);
          this.cdr.detectChanges();
        } else {
          console.warn('[DEBUG] ⚠️ Aucun participant trouvé sur le serveur');
        }
      } else {
        console.error('[DEBUG] ❌ Format de réponse invalide (pas un tableau)');
      }
    } catch (error) {
      console.error('[DEBUG] ❌ Erreur lors de la vérification directe des participants:', error);
    }
  }`;

  // 1. Corriger la méthode resetQuiz() incomplète
  let updatedContent = content.replace(resetQuizRegex, correctResetQuiz);
  
  // 2. Supprimer les méthodes dupliquées à la fin
  updatedContent = updatedContent.replace(duplicatedMethodsRegex, '\n}\n');
  
  // 3. S'assurer qu'il n'y a qu'une seule instance de getParticipantNames et checkParticipantsDirectly
  updatedContent = updatedContent.replace(/getParticipantNames\(\): string[\s\S]*?join\(', '\);[\s\S]*?\}/g, '');
  updatedContent = updatedContent.replace(/async checkParticipantsDirectly\(\): Promise<void>[\s\S]*?Promise\.resolve\(\);[\s\S]*?\}/g, '');
  
  // 4. Remplacer les versions améliorées des méthodes resetParticipants et restartGame 
  updatedContent = updatedContent.replace(/public async resetParticipants\(\)[\s\S]*?\[RESET\] Participants supprimés et interface mise à jour[\s\S]*?\}/g, '');
  updatedContent = updatedContent.replace(/async restartGame\(\)[\s\S]*?\[RESET\] ❌ Erreur lors de la réinitialisation[\s\S]*?\}/g, '');
  
  // 5. Ajouter les méthodes corrigées à la fin du fichier (avant la dernière accolade)
  const methods = correctGetParticipantNames + '\n\n' + correctCheckParticipantsDirectly + '\n\n' +
                  correctResetParticipants + '\n\n' + correctRestartGame;
  
  // S'assurer que le fichier se termine par une accolade de classe fermante
  if (classEndRegex.test(updatedContent)) {
    // Remplacer la dernière accolade et ajouter nos méthodes
    updatedContent = updatedContent.replace(classEndRegex, methods + '\n}$1');
  } else {
    // Si aucune accolade fermante n'est trouvée, ajouter les méthodes et fermer la classe
    updatedContent += methods + '\n}\n';
  }
  
  // Écrire le fichier mis à jour
  fs.writeFileSync(componentFilePath, updatedContent, 'utf8');
  console.log('Correction des erreurs TypeScript terminée avec succès!');
  
  console.log('\nAméliorations appliquées :');
  console.log('1. Correction des méthodes resetQuiz() incomplètes');
  console.log('2. Suppression des méthodes dupliquées');
  console.log('3. Fermeture correcte de la classe');
  console.log('4. Intégration correcte des méthodes resetParticipants() et restartGame()');
  
} catch (error) {
  console.error('Erreur lors de la mise à jour du fichier:', error);
}