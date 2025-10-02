/**
 * CORRECTIF POUR LE TIMER
 * 
 * Ce fichier est une DOCUMENTATION contenant des extraits de code à utiliser pour corriger le timer.
 * ⚠️ ATTENTION: Ce fichier n'est PAS destiné à être exécuté directement comme un script JavaScript.
 * 
 * Instructions:
 * 1. Assurez-vous que le serveur est en cours d'exécution (node server.js)
 * 2. Modifiez le fichier src/app/presentation/presentation.component.ts comme décrit ci-dessous
 * 3. Copiez-collez le code approprié dans le composant Angular
 */

/**
 * SOLUTION 1: TIMER LOCAL UNIQUEMENT (PLUS SIMPLE)
 * 
 * Remplacez la méthode startTimerManually par celle-ci:
 */

// CODE TYPESCRIPT A COPIER DANS presentation.component.ts :
// 
// startTimerManually(seconds: number) {
  console.log('Démarrage manuel du timer pour', seconds, 'secondes');
  
  // Afficher un indicateur visuel
  this.loadingMessage = 'Démarrage du timer...';
  this.isLoading = true;
  this.cdRef.detectChanges();
  
  // Initialiser l'état du timer
  this.timerMax = seconds;
  this.timerValue = seconds;
  this.timerActive = true;
  this.timerStartedManually = true;
  
  // Nettoyage de l'ancien intervalle si existant
  if (this.timerInterval) {
    clearInterval(this.timerInterval);
  }
  
  // Démarrer un intervalle local
  this.timerInterval = setInterval(() => {
    if (this.timerValue > 0 && this.timerActive) {
      this.timerValue -= 0.1; // Décrémenter de 0.1 seconde pour une mise à jour plus fluide
      if (this.timerValue <= 0) {
        this.timerValue = 0;
        this.timerActive = false;
        clearInterval(this.timerInterval);
        // Passer automatiquement à l'étape suivante si nous sommes en phase de question
        if (this.step === 'question') {
          setTimeout(() => this.quizService.setStep('result'), 500);
        }
      }
      this.cdRef.detectChanges();
    }
  }, 200);
  
  // Terminer l'indicateur visuel après un court délai
  setTimeout(() => {
    this.isLoading = false;
    this.cdRef.detectChanges();
  }, 500);
}

/**
 * SOLUTION 2: AVEC APPEL API (PLUS COMPLÈTE)
 * 
 * Si vous voulez conserver la synchronisation entre les clients,
 * ajoutez ces imports en haut du fichier:
 * 
 * import { firstValueFrom } from 'rxjs';
 * import { HttpClient } from '@angular/common/http';
 * 
 * Puis ajoutez HttpClient dans le constructeur:
 * 
 * constructor(
 *   ...
 *   private http: HttpClient
 * ) {
 *
 * Et utilisez cette version de la méthode:
 */

// CODE TYPESCRIPT A COPIER DANS presentation.component.ts :
// 
// async startTimerManually(seconds: number) {
  console.log('Démarrage manuel du timer pour', seconds, 'secondes');
  
  // Afficher un indicateur visuel
  this.loadingMessage = 'Démarrage du timer...';
  this.isLoading = true;
  this.cdRef.detectChanges();
  
  // Initialiser l'état du timer immédiatement pour une meilleure réactivité
  this.timerMax = seconds;
  this.timerValue = seconds;
  this.timerActive = true;
  this.timerStartedManually = true;
  
  // Nettoyage de l'ancien intervalle si existant
  if (this.timerInterval) {
    clearInterval(this.timerInterval);
  }
  
  // Démarrer un intervalle local immédiatement
  this.timerInterval = setInterval(() => {
    if (this.timerValue > 0 && this.timerActive) {
      this.timerValue -= 0.1;
      if (this.timerValue <= 0) {
        this.timerValue = 0;
        this.timerActive = false;
        clearInterval(this.timerInterval);
        // Passer automatiquement à l'étape suivante si nous sommes en phase de question
        if (this.step === 'question') {
          setTimeout(() => this.quizService.setStep('result'), 500);
        }
      }
      this.cdRef.detectChanges();
    }
  }, 200);
  
  try {
    // Tentative d'appel API pour la synchronisation
    const response = await firstValueFrom(
      this.http.post('/api/start-timer', {
        duration: seconds,
        currentQuestionIndex: this.currentIndex || 0
      })
    );
    console.log('Timer synchronisé avec le serveur:', response);
  } catch (error) {
    console.error('Erreur API timer (continue en mode local):', error);
  }
  
  // Terminer l'indicateur visuel
  this.isLoading = false;
  this.cdRef.detectChanges();
}

/**
 * SOLUTION 3: CORRECTIF RAPIDE POUR CONTOURNER LE PROBLÈME WEBSOCKET
 * 
 * Si aucune des solutions ci-dessus ne fonctionne, vous pouvez simplement
 * désactiver temporairement les WebSockets en modifiant ce fichier:
 * src/app/services/websocket-timer.service.ts
 * 
 * Ajoutez cette ligne au début de la méthode connect():
 * 
 * private connect() {
 *   console.log('[WS] WebSockets temporairement désactivés - utilisation du mode local');
 *   return; // Cette ligne désactive les WebSockets
 *   
 *   try {
 *     // Le reste du code...
 * }
 */

/**
 * REMARQUE IMPORTANTE : Ce fichier est un document de référence uniquement
 * ========================================================================
 * 
 * Ce fichier n'est pas destiné à être exécuté en tant que script JavaScript.
 * Il contient du code TypeScript destiné à être copié-collé dans les fichiers Angular appropriés.
 * 
 * Les erreurs de syntaxe que vous pouvez voir sont normales car ce fichier mélange
 * du JavaScript (pour les commentaires) et du TypeScript (pour les solutions).
 * 
 * UTILISATION :
 * 1. Ouvrez les fichiers sources concernés dans votre éditeur
 * 2. Copiez le code de la solution choisie (sans les commentaires de début/fin)
 * 3. Collez-le dans le fichier approprié
 * 4. Testez l'application
 */