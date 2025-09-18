
import { Component, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { TimerService } from '../services/timer.service';
import { CommonModule } from '@angular/common';
import { QuizService, QuizStep } from '../services/quiz-secure.service';
import { Question } from '../models/question.model';
import { User } from '../models/user.model';
import { Observable, timer, Subscription } from 'rxjs';
import { LeaderboardEntry } from '../models/leaderboard-entry.model';
import { trigger, state, style, transition, animate, query, stagger } from '@angular/animations';
import html2canvas from 'html2canvas';
import { QRCodeComponent } from 'angularx-qrcode';

@Component({
  selector: 'app-presentation',
  standalone: true,
  imports: [CommonModule, QRCodeComponent],
  templateUrl: './presentation.component.html',
  styleUrls: ['./presentation.component.css'],
  animations: [
    // Animation pour les transitions d'étapes
    trigger('stepTransition', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(30px)' }),
        animate('500ms cubic-bezier(0.4, 0, 0.2, 1)', 
          style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    
    // Animation pour les éléments de liste
    trigger('listAnimation', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(20px)' }),
          stagger(100, [
            animate('400ms cubic-bezier(0.4, 0, 0.2, 1)', 
              style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ]),
    
    // Animation pour les images
    trigger('imageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.9)' }),
        animate('400ms cubic-bezier(0.4, 0, 0.2, 1)', 
          style({ opacity: 1, transform: 'scale(1)' }))
      ])
    ])
  ]
})
export class PresentationComponent implements OnInit, OnDestroy {
  step: any = 'lobby'; // Typage élargi pour compatibilité template Angular

  ngOnInit() {
    // Appel unique dans le contexte Angular pour éviter les warnings
    this.quizService.initQuestions();
    // Forcer l'étape lobby au démarrage
    this.step = 'lobby';
    this.quizService.setStep('lobby');
    // Diagnostic : log ultra-visible
    console.log('[DEBUG][ngOnInit] step initialisé à', this.step);
    // Vérification périodique de la synchro step - DÉSACTIVÉ pour réduire les logs
    // this.diagnosticInterval = setInterval(() => {
    //   if (!this.step || (this.step !== 'lobby' && this.step !== 'waiting' && this.step !== 'question' && this.step !== 'result' && this.step !== 'end')) {
    //     console.warn('[DIAGNOSTIC][step] Valeur non reconnue :', this.step);
    //   }
    // }, 2000);
  }

  ngOnDestroy() {
    // Nettoyage des souscriptions pour éviter les fuites mémoire
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    
    // Nettoyage des autres souscriptions
    if (this.answersCountSub) {
      this.answersCountSub.unsubscribe();
    }
    if (this.timerSub) {
      this.timerSub.unsubscribe();
    }
    
    // Nettoyage de l'intervalle de diagnostic
    if (this.diagnosticInterval) {
      clearInterval(this.diagnosticInterval);
    }
  }
  participants: User[] = [];
  currentIndex: number = 0;
  currentQuestion: Question | null = null;
  answersCount: number[] = [];
  answersCountSub?: Subscription;
  leaderboard: LeaderboardEntry[] = [];
  // Pour le départage par vitesse de réponse
  questionStartTimes: { [key: string]: number } = {};
  // Stocke le temps de chaque bonne réponse par participant (clé: userId, valeur: tableau des temps)
  goodAnswersTimesByUser: { [userId: string]: number[] } = {};
  
  // Gestion des souscriptions pour éviter les fuites mémoire
  private subscriptions: Subscription[] = [];
  
  // Flag pour éviter les logs excessifs
  private debugMode = false;
  
  // Référence pour l'intervalle de diagnostic
  private diagnosticInterval?: any;

  // Gestion des images pour éviter le flash
  imageLoaded: boolean = false;
  resultImageLoaded: boolean = false;
  // Flag pour forcer la disparition immédiate des images
  hideImages: boolean = false;
  
  // Retourne le temps total des bonnes réponses pour un user
  // (méthode unique, suppression du doublon)
  windowLocation = window.location.origin;
  timerValue: number = 15;
  timerMax: number = 15; // Durée du timer en secondes, synchronisée avec timerValue

  // Propriétés pour la photo de groupe
  cameraStream: MediaStream | null = null;
  cameraActive: boolean = false;
  showCameraModal: boolean = false;
  photoTaken: boolean = false;
  timerSub?: Subscription;
  totalAnswers: number = 0;
  totalGood: number = 0;
  totalBad: number = 0;
  voters: string[] = [];

  // Affichage temps formaté (mm:ss si > 60s, sinon ss.s)
  public formatTime(ms: number): string {
    if (!ms || ms < 0) return '';
    const totalSeconds = Math.floor(ms / 1000);
    if (totalSeconds < 60) {
      return (ms / 1000).toFixed(2) + ' s';
    } else {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      // Affichage sans centièmes pour plus de lisibilité
      return `${minutes} min ${seconds.toString().padStart(2, '0')} s`;
    }
  }

  canShowEndButton(): boolean {
    return this.currentIndex === (this.quizService.getQuestions().length - 1) && this.step !== 'end';
  }

  constructor(public quizService: QuizService, private timerService: TimerService, private cdr: ChangeDetectorRef) {
    // Synchro temps réel de l'étape du quiz - optimisé pour éviter les logs répétitifs
    let lastStep: string | null = null;
    const stepSub = this.quizService.getStep().subscribe(step => {
      if (!step) return;
      
      // Log uniquement si l'étape a vraiment changé
      if (step !== lastStep) {
        console.log('[DEBUG][SYNC][getStep] Changement d\'étape :', lastStep, '->', step);
        lastStep = step;
        
        // Correction typage : accepte tous les états possibles
        this.step = step as QuizStep;
        this.refresh();
        this.cdr.detectChanges(); // Forcer la synchro immédiate
        
        if (step === 'question') this.startTimer();
        else this.stopTimer();
        
        // Réinitialisation des réponses lors du retour à l'étape lobby
        if (step === 'lobby') {
          this.quizService.resetAllAnswers();
        }
        // NE PAS appeler showResult ici pour éviter la boucle infinie
      }
    });
    this.subscriptions.push(stepSub);

    // Synchro temps réel de l'index de la question
    const indexSub = this.quizService.getCurrentIndex().subscribe(async idx => {
      const previousIndex = this.currentIndex;
      this.currentIndex = idx;
      
      // Reset image states immediately when index changes to prevent flash
      if (previousIndex !== idx) {
        this.imageLoaded = false;
        this.resultImageLoaded = false;
        this.hideImages = false; // Allow images to show again for new question
        // Force immediate UI update to hide images instantly
        this.cdr.detectChanges();
        console.log('[DEBUG][INDEX] Image states reset for index change:', previousIndex, '->', idx);
      }
      
      await this.fetchQuestionStartTimes(); // Rafraîchit les timestamps à chaque question
      this.refresh();
      // Synchro temps réel des votants pour la question courante
      const votersSub = this.quizService.getVoters$(idx).subscribe(voters => {
        this.voters = voters;
      });
      this.subscriptions.push(votersSub);
      
      // Synchro temps réel du nombre de réponses par option
      if (this.answersCountSub) this.answersCountSub.unsubscribe();
      console.log('[DEBUG][SUBSCRIPTION] Starting getAnswersCount$ subscription for question:', idx);
      this.answersCountSub = this.quizService.getAnswersCount$(idx).subscribe(counts => {
        console.log('[DEBUG][SUBSCRIPTION] getAnswersCount$ returned:', counts);
        this.answersCount = counts;
        this.refresh();
      });
      // Optimisé : calcul du leaderboard sans logs excessifs
      this.updateLeaderboard();
    });
    this.subscriptions.push(indexSub);
    
    // Synchro temps réel des inscrits - optimisé sans logs excessifs
    const participantsSub = this.quizService.getParticipants$().subscribe(participants => {
      this.participants = participants;
      this.updateLeaderboard();
    });
    this.subscriptions.push(participantsSub);
  }

  // Retourne le temps total des bonnes réponses pour un user
  public getTotalGoodAnswersTime(userId: string): number {
    const arr = this.goodAnswersTimesByUser[userId] || [];
    return arr.reduce((sum, t) => sum + (t || 0), 0);
  }

  // Méthode optimisée pour mettre à jour le leaderboard sans logs excessifs
  private updateLeaderboard(): void {
    this.fetchQuestionStartTimes().then(() => {
      const subscription = this.quizService.getAllAnswers$().subscribe((allAnswersDocs: any[]) => {
        const nbQuestions = this.quizService.getQuestions().length;
        
        console.log('[LEADERBOARD] Mise à jour du classement:', {
          participants: this.participants.length,
          nbQuestions,
          allAnswersDocs: allAnswersDocs.length
        });
        
        // Vérifie qu'au moins une réponse valide (≠ -1) existe pour chaque participant
        const hasValidAnswer = this.participants.some(user => {
          for (let i = 0; i < nbQuestions; i++) {
            const docAns = allAnswersDocs.find((d: any) => String(d.id) === String(i));
            if (docAns && docAns.answers) {
              const answers = docAns.answers.filter((a: any) => String(a.userId) === String(user.id));
              if (answers.length > 0) {
                const answer = answers[answers.length - 1];
                if (typeof answer.answerIndex !== 'undefined' && Number(answer.answerIndex) !== -1) {
                  return true;
                }
              }
            }
          }
          return false;
        });

        if (!hasValidAnswer) {
          this.leaderboard = [];
          console.log('[LEADERBOARD] Pas de réponse valide, leaderboard masqué.');
          return;
        }

        const leaderboard: LeaderboardEntry[] = this.participants.map(user => {
          let score = 0;
          let totalTime = 0;
          let goodTimes: number[] = [];
          
          console.log('[LEADERBOARD] Calcul score pour:', user.name);
          
          for (let i = 0; i < nbQuestions; i++) {
            const docAns = allAnswersDocs.find((d: any) => String(d.id) === String(i));
            if (docAns && docAns.answers) {
              const answers = docAns.answers.filter((a: any) => String(a.userId) === String(user.id));
              if (answers.length > 0) {
                const answer = answers[answers.length - 1];
                const question = this.quizService.getCurrentQuestion(i);
                
                console.log(`[LEADERBOARD] Question ${i}:`, {
                  user: user.name,
                  answerIndex: answer.answerIndex,
                  correctIndex: question?.correctIndex,
                  isCorrect: Number(answer.answerIndex) === Number(question?.correctIndex)
                });
                
                if (question && typeof answer.answerIndex !== 'undefined') {
                  if (Number(answer.answerIndex) === Number(question.correctIndex)) {
                    score++;
                    const qStart = this.questionStartTimes[i] ?? this.questionStartTimes[String(i)];
                    if (answer.timestamp && qStart && answer.timestamp >= qStart) {
                      const timeTaken = Math.min(answer.timestamp - qStart, 15000);
                      goodTimes[i] = timeTaken;
                      totalTime += timeTaken;
                    }
                  } else {
                    goodTimes[i] = undefined as any;
                  }
                }
              } else {
                goodTimes[i] = undefined as any;
              }
            } else {
              goodTimes[i] = undefined as any;
            }
          }
          
          console.log('[LEADERBOARD] Score final pour', user.name, ':', score, '/', nbQuestions);
          
          this.goodAnswersTimesByUser[user.id] = goodTimes;
          return { id: user.id, name: user.name, avatarUrl: user.avatarUrl, score, totalTime };
        });

        this.leaderboard = leaderboard.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.totalTime - b.totalTime;
        });

        // Log uniquement en mode debug et de façon limitée
        if (this.debugMode && this.leaderboard.length > 0) {
          console.log('[DEBUG][LEADERBOARD] Updated:', this.leaderboard.length, 'entries');
        }
      });
      
      this.subscriptions.push(subscription);
    });
  }

  // Récupère les questionStartTimes via l'API HTTP
  public async fetchQuestionStartTimes(): Promise<void> {
    try {
      // TODO: Implémenter une méthode API pour récupérer les timestamps
      // console.log('[INFO] fetchQuestionStartTimes temporarily disabled - needs API implementation');
      this.questionStartTimes = {};
    } catch (e) {
      console.warn('Erreur récupération questionStartTimes', e);
    }
  }

  forceEndTimer() {
    this.timerValue = 0;
    this.stopTimer();
    this.showResult();
  }

  // ngOnInit fusionné ci-dessus

  refresh() {
    // this.participants = ... supprimé, car synchro via Firestore
    const previousQuestion = this.currentQuestion;
    this.currentQuestion = this.quizService.getCurrentQuestion(this.currentIndex);
    
    // Reset image loaded state IMMEDIATELY when question changes to prevent flash
    if (previousQuestion?.id !== this.currentQuestion?.id) {
      this.imageLoaded = false;
      this.resultImageLoaded = false;
      this.hideImages = false; // Allow images to show for new question
      console.log('[DEBUG][REFRESH] Image states reset due to question change');
    }
    
    // Ne pas écraser le leaderboard dynamique ici !
    
    console.log('[DEBUG][REFRESH] currentQuestion:', this.currentQuestion);
    console.log('[DEBUG][REFRESH] answersCount:', this.answersCount);
    console.log('[DEBUG][REFRESH] currentIndex:', this.currentIndex);
    
    if (this.currentQuestion && this.answersCount) {
      console.log('[DEBUG][REFRESH] correctIndex:', this.currentQuestion.correctIndex);
      this.totalGood = this.answersCount[this.currentQuestion.correctIndex] || 0;
      this.totalAnswers = this.answersCount.reduce((a, b) => a + b, 0);
      this.totalBad = this.totalAnswers - this.totalGood;
      
      console.log('[DEBUG][REFRESH] Calculated values:', {
        totalGood: this.totalGood,
        totalBad: this.totalBad,
        totalAnswers: this.totalAnswers
      });
    } else {
      this.totalGood = 0;
      this.totalAnswers = 0;
      this.totalBad = 0;
      console.log('[DEBUG][REFRESH] Reset to 0 - missing currentQuestion or answersCount');
    }
  }

  launchGame() {
    // Passe à l'étape "waiting" avant de lancer la première question
    this.quizService.setStep('waiting');
  }

  // Méthode à appeler pour vraiment démarrer la première question après l'attente
  async startFirstQuestion() {
    // Démarre la première question via l'API HTTP
    try {
      await this.quizService.setStep('question');
      // TODO: Implémenter la gestion des timestamps via l'API
      console.log('[INFO] First question started via HTTP API');
    } catch (error) {
      console.error('Erreur lors du démarrage de la première question:', error);
    }
  }

  startTimer() {
    // ...
  this.timerValue = 15;
  this.timerMax = 15;
    this.stopTimer();
    if (this.timerSub) {
      // ...
      this.timerSub.unsubscribe();
    }
    this.timerSub = timer(0, 1000).subscribe(val => {
      this.timerValue = 15 - val;
      this.timerMax = 15;
      if (this.timerValue <= 0) {
        this.showResult();
      }
    });
  }

  stopTimer() {
    if (this.timerSub) this.timerSub.unsubscribe();
  }

  showResult() {
    // DEBUG : log état avant passage à l'étape résultat
    // Reset image states IMMEDIATELY to prevent any flash
    this.imageLoaded = false;
    this.resultImageLoaded = false;
    // Force immediate UI update to hide images instantly
    this.cdr.detectChanges();
    
    // On force la mise à jour des données avant d'afficher le résultat
    const previousQuestion = this.currentQuestion;
    this.currentQuestion = this.quizService.getCurrentQuestion(this.currentIndex);
    
    // answersCount est toujours à jour via l'abonnement (voir ngOnInit)
    if (this.currentQuestion && this.answersCount && Array.isArray(this.answersCount)) {
      this.totalGood = this.answersCount[this.currentQuestion.correctIndex] || 0;
      this.totalAnswers = this.answersCount.reduce((a, b) => a + b, 0);
      this.totalBad = this.totalAnswers - this.totalGood;
    } else {
      this.totalGood = 0;
      this.totalAnswers = 0;
      this.totalBad = 0;
    }
    // Passage à l'étape résultat avec délai pour laisser le flux RxJS se mettre à jour
    setTimeout(() => {
      this.quizService.setStep('result');
      this.step = 'result'; // Synchronisation immédiate pour le template
      this.refresh(); // Correction : forcer la mise à jour des données juste après le changement d'étape
      this.cdr.markForCheck();
      // Log après le changement d'étape
      console.log('[DEBUG][RESULT] step:', this.step, 'currentQuestion:', this.currentQuestion, 'answersCount:', this.answersCount);
    }, 120);
  }

  async nextQuestion() {
    // Incrémente l'index et passe à la question suivante via l'API
    try {
      console.log('[PRESENTATION] Next question via HTTP API, current index:', this.currentIndex);
      
      // Hide images immediately - most aggressive approach
      this.hideImages = true;
      this.imageLoaded = false;
      this.resultImageLoaded = false;
      
      // Reset timer immediately to sync with image change
      this.timerValue = 0;
      this.stopTimer();
      
      // Force immediate UI update to hide images instantly and show empty timer
      this.cdr.detectChanges();
      
      // Petit délai pour laisser l'interface se mettre à jour
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Reset timer to full immediately for visual sync
      this.timerValue = 15;
      this.timerMax = 15;
      this.cdr.detectChanges();
      
      // Incrémenter l'index de la question
      await this.quizService.nextQuestion(this.currentIndex);
      // Puis passer à l'étape question (this will eventually call startTimer and reset hideImages)
      await this.quizService.setStep('question');
      console.log('[PRESENTATION] Question suivante appelée, nouvel index:', this.currentIndex + 1);
    } catch (error) {
      console.error('[PRESENTATION] Erreur lors du passage à la question suivante:', error);
    }
  }

  endGame() {
    this.quizService.setStep('end');
  }

  public async resetParticipants() {
    await this.quizService.resetParticipants();
  }

  // Réinitialisation complète du quiz (étape, participants, index, réponses)
  async restartGame() {
    if (!confirm('Êtes-vous sûr de vouloir réinitialiser complètement le quiz ? Cette action supprimera tous les participants et toutes les réponses.')) {
      return;
    }
    
    try {
      // Utilise les méthodes du service HTTP
      await this.quizService.setStep('lobby');
      await this.quizService.resetParticipants();
      console.log('[INFO] Quiz reset via HTTP API');
      alert('Quiz réinitialisé. Tous les participants et réponses ont été supprimés.');
      
      // Réinitialisation locale de l'état du composant
      this.step = 'lobby';
      this.currentIndex = 0;
      this.currentQuestion = null;
      this.answersCount = [];
      this.leaderboard = [];
      this.imageLoaded = false; // Reset image state
      this.resultImageLoaded = false; // Reset result image state
    } catch (error) {
      console.error('Erreur lors de la réinitialisation:', error);
      alert('Erreur lors de la réinitialisation du quiz.');
    }
    this.timerValue = 15;
    this.voters = [];
    this.refresh();
    // Rafraîchit explicitement le leaderboard après reset
    setTimeout(() => {
      this.quizService.getAllAnswers$().subscribe((allAnswersDocs: any[]) => {
        console.log('[DEBUG][RESET][LEADERBOARD] Réponses Firestore après reset:', allAnswersDocs);
        this.leaderboard = [];
      });
    }, 500);
  }

  // Méthodes de gestion des images pour éviter le flash
  onImageLoaded() {
    this.imageLoaded = true;
  }

  onImageError() {
    this.imageLoaded = false;
    console.warn('Erreur de chargement de l\'image:', this.currentQuestion?.imageUrl);
  }

  onResultImageLoaded() {
    this.resultImageLoaded = true;
  }

  onResultImageError() {
    this.resultImageLoaded = false;
    console.warn('Erreur de chargement de l\'image résultat:', this.currentQuestion?.imageUrlResult);
  }

  // TrackBy function pour forcer la recréation des éléments d'image
  trackByQuestionId(index: number, question: any): any {
    return question?.id || index;
  }

  // ===== MÉTHODES POUR LA PHOTO DE GROUPE =====
  
  async startCamera(): Promise<void> {
    try {
      // Demander l'accès à la caméra
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: 'user' // Caméra frontale par défaut
        },
        audio: false
      });

      this.cameraActive = true;
      this.showCameraModal = true;
      
      // Attendre que le DOM soit mis à jour
      setTimeout(() => {
        const videoElement = document.getElementById('cameraVideo') as HTMLVideoElement;
        if (videoElement && this.cameraStream) {
          videoElement.srcObject = this.cameraStream;
          videoElement.play();
        }
      }, 100);

      console.log('✅ Caméra démarrée avec succès');
    } catch (error) {
      console.error('❌ Erreur d\'accès à la caméra:', error);
      alert('Impossible d\'accéder à la caméra. Vérifiez les permissions du navigateur.');
    }
  }

  async takeGroupPhoto(): Promise<void> {
    try {
      const videoElement = document.getElementById('cameraVideo') as HTMLVideoElement;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!videoElement || !ctx || !this.cameraStream) {
        console.error('Éléments caméra introuvables');
        return;
      }

      // Dimensions du canvas
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;

      // Capturer l'image de la vidéo
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

      // Ajouter l'overlay "Promotion 2025"
      this.addPromotionOverlay(ctx, canvas.width, canvas.height);

      // Télécharger l'image
      const link = document.createElement('a');
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T')[0];
      link.download = `quiz-promotion-2025-${timestamp}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      link.click();

      this.photoTaken = true;
      console.log('✅ Photo de groupe prise avec succès !');
      
      // Fermer la caméra après 2 secondes
      setTimeout(() => {
        this.stopCamera();
      }, 2000);

    } catch (error) {
      console.error('❌ Erreur lors de la prise de photo:', error);
    }
  }

  private addPromotionOverlay(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Fond semi-transparent pour le texte
    ctx.fillStyle = 'rgba(35, 37, 38, 0.8)';
    ctx.fillRect(0, height - 100, width, 100);

    // Texte principal "Quiz Promotion 2025"
    ctx.fillStyle = '#f6d365';
    ctx.font = 'bold 32px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏆 Quiz Promotion 2025', width / 2, height - 60);

    // Date
    const now = new Date();
    ctx.font = '18px Arial, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(now.toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }), width / 2, height - 25);

    // Décoration coins
    ctx.fillStyle = '#DAE72A';
    ctx.font = '24px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🌟', 20, height - 40);
    ctx.textAlign = 'right';
    ctx.fillText('🌟', width - 20, height - 40);
  }

  stopCamera(): void {
    if (this.cameraStream) {
      // Arrêter tous les tracks de la caméra
      this.cameraStream.getTracks().forEach(track => {
        track.stop();
      });
      this.cameraStream = null;
    }
    
    this.cameraActive = false;
    this.showCameraModal = false;
    this.photoTaken = false;
    console.log('✅ Caméra fermée');
  }

  getCurrentDate(): string {
    return new Date().toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  // ===== FIN MÉTHODES PHOTO DE GROUPE =====

  // Méthode de capture graphique du leaderboard final
  async captureLeaderboard(): Promise<void> {
    try {
      // Sélectionner un élément plus large incluant le titre
      const element = document.querySelector('.container-question');
      if (!element) {
        console.error('Élément container-question introuvable pour la capture');
        return;
      }

      // Configuration html2canvas pour un rendu optimal
      const canvas = await html2canvas(element as HTMLElement, {
        backgroundColor: '#F1F1F1',
        scale: 2, // Haute résolution
        useCORS: true,
        allowTaint: false,
        width: (element as HTMLElement).offsetWidth,
        height: (element as HTMLElement).offsetHeight,
        scrollX: 0,
        scrollY: 0,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        ignoreElements: (element) => {
          // Ignorer les boutons dans la capture
          return element.classList?.contains('step-final-buttons') || false;
        }
      });

      // Créer un contexte pour ajouter des informations supplémentaires
      const finalCanvas = document.createElement('canvas');
      const ctx = finalCanvas.getContext('2d');
      
      if (!ctx) return;

      // Dimensions du canvas final avec espace pour les métadonnées
      const padding = 40;
      const headerHeight = 60;
      const footerHeight = 40;
      finalCanvas.width = canvas.width + (padding * 2);
      finalCanvas.height = canvas.height + headerHeight + footerHeight + (padding * 2);

      // Fond du canvas final
      ctx.fillStyle = '#F1F1F1';
      ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

      // Header avec titre
      ctx.fillStyle = '#232526';
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🏆 Quiz Application - Final Results', finalCanvas.width / 2, 35);

      // Ligne de séparation
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padding, headerHeight - 10);
      ctx.lineTo(finalCanvas.width - padding, headerHeight - 10);
      ctx.stroke();

      // Dessiner le leaderboard capturé
      ctx.drawImage(canvas, padding, headerHeight + padding);

      // Footer avec date et heure
      const now = new Date();
      ctx.font = '14px Arial, sans-serif';
      ctx.fillStyle = '#666';
      ctx.textAlign = 'center';
      ctx.fillText(`Generated on ${now.toLocaleString('fr-FR')}`, finalCanvas.width / 2, finalCanvas.height - 15);

      // Télécharger l'image
      const link = document.createElement('a');
      const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T')[0];
      link.download = `quiz-final-results-${timestamp}.png`;
      link.href = finalCanvas.toDataURL('image/png', 0.95);
      link.click();

      console.log('✅ Capture du leaderboard réussie !');
    } catch (error) {
      console.error('❌ Erreur lors de la capture:', error);
    }
  }
}
