
import { Component, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { TimerService } from '../services/timer.service';
import { CommonModule } from '@angular/common';
import { QuizService, QuizStep } from '../services/quiz-secure.service';
import { Question } from '../models/question.model';
import { User } from '../models/user.model';
import { Observable, timer, Subscription, firstValueFrom } from 'rxjs';
import { LeaderboardEntry } from '../models/leaderboard-entry.model';
import { trigger, state, style, transition, animate, query, stagger } from '@angular/animations';
import html2canvas from 'html2canvas';
import { QRCodeComponent } from 'angularx-qrcode';
import { AdminAuthService } from '../services/admin-auth.service';
import { Router } from '@angular/router';

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
  showRestoreDialog: boolean = false;
  private minModalDisplayTime = 2000; // Afficher le modal au minimum 2 secondes
  private modalStartTime = 0;
  buttonsEnabled = false;

  async ngOnInit() {
    // D'abord, synchroniser avec l'état du serveur
    try {
      const serverState = await this.quizService.getGameState();
      console.log('🔄 État du serveur au démarrage:', serverState);
      
      // Si le serveur n'est pas à l'étape lobby, il faut restaurer cet état
      if (serverState && serverState.step && serverState.step !== 'lobby') {
        console.log('🔄 Partie en cours détectée sur le serveur, synchronisation automatique');
        await this.synchronizeWithServer(serverState);
        return;
      }
      
      // Vérifier s'il y a un état sauvegardé à restaurer
      if (this.quizService.canRestoreGameState()) {
        this.showRestoreDialog = true;
        this.modalStartTime = Date.now();
        this.buttonsEnabled = false;
        
        console.log('🔄 État sauvegardé détecté, affichage du modal de restauration');
        
        // Activer les boutons après le temps minimum
        setTimeout(() => {
          this.buttonsEnabled = true;
          console.log('✅ Boutons du modal activés');
        }, this.minModalDisplayTime);
        
        // NE PAS initialiser tant que l'utilisateur n'a pas choisi
        return;
      }
      
      // Initialisation pour une nouvelle partie
      this.initializeNewGame();
    } catch (error) {
      console.error('❌ Erreur lors de la synchronisation avec le serveur:', error);
      // En cas d'erreur, continuer avec l'initialisation normale
      this.initializeNewGame();
    }
  }

  private initializeNewGame() {
    // Appel unique dans le contexte Angular pour éviter les warnings
    this.quizService.initQuestions();
    // Forcer l'étape lobby au démarrage
    this.step = 'lobby';
    this.quizService.setStep('lobby');
    // Initialiser l'état du jeu si c'est une nouvelle partie
    this.quizService.initGameState();
    
    // Initialiser les souscriptions après l'initialisation
    this.initializeSubscriptions();
    
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
  cameraReady: boolean = false;
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

  constructor(
    public quizService: QuizService, 
    private timerService: TimerService, 
    private cdr: ChangeDetectorRef,
    public adminAuthService: AdminAuthService,
    private router: Router
  ) {
    // Initialiser les souscriptions immédiatement pour assurer la synchronisation
    this.initializeSubscriptions();
  }

  private initializeSubscriptions() {
    // Éviter la duplication des souscriptions
    if (this.subscriptions.length > 0) {
      console.log('⚠️  Souscriptions déjà initialisées, ignorer');
      return;
    }
    
    console.log('🔄 Initialisation des souscriptions...');
    
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
        
        if (step === 'question') {
          // Vérifier si le serveur a déjà défini un questionStartTime avant de démarrer
          this.checkAndSyncTimer();
        } else {
          this.stopTimer();
        }
        
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
      console.log('[PRESENTATION] Participants reçus:', participants.length, participants);
      const oldCount = this.participants.length;
      this.participants = participants;
      const newCount = this.participants.length;
      
      if (oldCount !== newCount) {
        console.log(`[PRESENTATION] Changement participants: ${oldCount} → ${newCount}`);
        this.cdr.detectChanges(); // Force la mise à jour de l'interface
      }
      
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
    // this.participants = ... supprimé, car synchro via API SQLite
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
      // Utilise nextQuestion(-1) pour forcer le passage à l'index 0 avec initialisation du timer
      await this.quizService.nextQuestion(-1);
      console.log('[INFO] First question started via HTTP API');
    } catch (error) {
      console.error('Erreur lors du démarrage de la première question:', error);
    }
  }

  startTimer() {
    this.stopTimer();
    this.syncTimerWithServer();
  }

  private async checkAndSyncTimer() {
    try {
      const gameState = await this.quizService.getGameState();
      
      if (gameState?.questionStartTime) {
        // Le serveur a déjà un questionStartTime, synchroniser
        console.log('🕐 Question déjà démarrée côté serveur, synchronisation...');
        this.syncTimerWithServer();
      } else {
        // Pas de questionStartTime côté serveur, ne pas démarrer le timer
        console.log('⏸️ Pas de timer côté serveur, attente...');
        this.timerValue = 15;
        this.timerMax = 15;
        // Ne pas démarrer le timer
      }
    } catch (error) {
      console.warn('Erreur vérification timer serveur:', error);
      this.timerValue = 15;
      this.timerMax = 15;
    }
  }

  private async syncTimerWithServer() {
    try {
      // Récupérer l'état du serveur pour synchroniser le timer
      const gameState = await this.quizService.getGameState();
      
      if (!gameState) {
        this.startTimerNormal(15);
        return;
      }
      
      const questionStartTime = gameState.questionStartTime;
      const timerMax = gameState.timerMax || 15;
      
      if (questionStartTime) {
        const elapsed = Math.floor((Date.now() - questionStartTime) / 1000);
        const remainingTime = Math.max(0, timerMax - elapsed);
        
        console.log(`🕐 Synchronisation timer: elapsed=${elapsed}s, remaining=${remainingTime}s`);
        
        this.timerValue = remainingTime;
        this.timerMax = timerMax;
        
        if (remainingTime <= 0) {
          this.showResult();
          return;
        }
        
        // Démarrer le timer avec le temps restant
        if (this.timerSub) this.timerSub.unsubscribe();
        this.timerSub = timer(0, 1000).subscribe(val => {
          this.timerValue = remainingTime - val;
          if (this.timerValue <= 0) {
            this.showResult();
          }
        });
      } else {
        // Fallback: démarrer normalement
        this.startTimerNormal(timerMax);
      }
    } catch (error) {
      console.warn('Erreur synchronisation timer, démarrage normal:', error);
      this.startTimerNormal(15);
    }
  }

  private startTimerNormal(duration: number = 15) {
    this.timerValue = duration;
    this.timerMax = duration;
    
    if (this.timerSub) this.timerSub.unsubscribe();
    this.timerSub = timer(0, 1000).subscribe(val => {
      this.timerValue = duration - val;
      this.timerMax = duration;
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
    
    console.log('[RESET] Début de la réinitialisation du quiz');
    
    try {
      // Utilise les méthodes du service HTTP
      console.log('[RESET] 1. Passage à l\'étape lobby...');
      await this.quizService.setStep('lobby');
      console.log('[RESET] 1. ✅ Étape lobby définie');
      
      console.log('[RESET] 2. Suppression des participants...');
      await this.quizService.resetParticipants();
      console.log('[RESET] 2. ✅ Participants supprimés');
      
      console.log('[INFO] Quiz reset via HTTP API');
      alert('Quiz réinitialisé. Tous les participants et réponses ont été supprimés.');
      
      console.log('[RESET] 3. Réinitialisation locale de l\'état...');
      // Réinitialisation locale de l'état du composant
      this.step = 'lobby';
      this.currentIndex = 0;
      this.currentQuestion = null;
      this.answersCount = [];
      this.leaderboard = [];
      this.imageLoaded = false; // Reset image state
      this.resultImageLoaded = false; // Reset result image state
      console.log('[RESET] 3. ✅ État local réinitialisé');
      
    } catch (error) {
      console.error('[RESET] ❌ Erreur lors de la réinitialisation:', error);
      const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
      alert(`Erreur lors de la réinitialisation du quiz: ${errorMsg}`);
    }
    this.timerValue = 15;
    this.voters = [];
    this.refresh();
    // Rafraîchit explicitement le leaderboard après reset
    setTimeout(() => {
      this.quizService.getAllAnswers$().subscribe((allAnswersDocs: any[]) => {
        console.log('[DEBUG][RESET][LEADERBOARD] Réponses SQLite après reset:', allAnswersDocs);
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
      // Calculer la résolution optimale basée sur l'écran
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      const aspectRatio = screenWidth / screenHeight;
      
      // Demander une résolution adaptée à l'écran
      let videoConstraints: MediaTrackConstraints = {
        facingMode: 'user' // Caméra frontale par défaut
      };

      // Adapter la résolution demandée à l'écran
      if (aspectRatio > 1.5) {
        // Écran large (16:9 ou plus)
        videoConstraints.width = { ideal: Math.min(1920, screenWidth * 0.9) };
        videoConstraints.height = { ideal: Math.min(1080, screenHeight * 0.9) };
      } else {
        // Écran plus carré
        videoConstraints.width = { ideal: Math.min(1280, screenWidth * 0.9) };
        videoConstraints.height = { ideal: Math.min(720, screenHeight * 0.9) };
      }

      console.log('📹 Demande de résolution caméra:', videoConstraints);

      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false
      });

      this.cameraActive = true;
      this.cameraReady = false;
      this.showCameraModal = true;
      
      // Attendre que le DOM soit mis à jour
      setTimeout(() => {
        const videoElement = document.getElementById('cameraVideo') as HTMLVideoElement;
        if (videoElement && this.cameraStream) {
          console.log('📹 Configuration de l\'élément vidéo...');
          console.log('VideoElement trouvé:', !!videoElement);
          console.log('CameraStream disponible:', !!this.cameraStream);
          
          // Forcer l'affichage de la vidéo
          videoElement.style.display = 'block';
          videoElement.style.opacity = '1';
          videoElement.style.visibility = 'visible';
          videoElement.style.background = 'blue'; // Pour voir si l'élément est visible
          
          videoElement.srcObject = this.cameraStream;
          
          // Attendre que les métadonnées de la vidéo soient chargées
          videoElement.onloadedmetadata = () => {
            console.log(`📹 Métadonnées chargées: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
            console.log('📹 ReadyState:', videoElement.readyState);
            console.log('📹 Style computed:', window.getComputedStyle(videoElement).display);
            
            // Ajuster le container pour maintenir le ratio
            const container = videoElement.closest('.camera-container') as HTMLElement;
            if (container) {
              const ratio = videoElement.videoHeight / videoElement.videoWidth;
              container.style.aspectRatio = `${videoElement.videoWidth} / ${videoElement.videoHeight}`;
              console.log('📹 Container aspect ratio défini:', container.style.aspectRatio);
            }
          };
          
          // S'assurer que la vidéo est bien en cours de lecture
          videoElement.oncanplay = () => {
            console.log('📹 Vidéo prête pour la capture (canplay)');
            console.log('📹 Video playing:', !videoElement.paused && !videoElement.ended && videoElement.readyState > 2);
            this.cameraReady = true;
          };
          
          videoElement.onloadeddata = () => {
            console.log('📹 Données vidéo chargées (loadeddata)');
            // Test si le stream est bien connecté
            if (videoElement.srcObject === this.cameraStream) {
              console.log('✅ Stream correctement assigné à la vidéo');
            } else {
              console.error('❌ Stream non assigné correctement');
              // Réessayer d'assigner le stream
              videoElement.srcObject = this.cameraStream;
            }
          };
          
          videoElement.onplaying = () => {
            console.log('📹 Vidéo en cours de lecture (playing)');
          };
          
          videoElement.play().then(() => {
            console.log('📹 Lecture vidéo démarrée avec succès');
            // Double vérification après 1 seconde
            setTimeout(() => {
              if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
                this.cameraReady = true;
                console.log('📹 Caméra confirmée prête');
                console.log('📹 État final - Paused:', videoElement.paused, 'Ended:', videoElement.ended, 'ReadyState:', videoElement.readyState);
              }
            }, 1000);
          }).catch(err => {
            console.error('❌ Erreur de lecture vidéo:', err);
          });
        } else {
          console.error('❌ Élément vidéo ou stream introuvable');
          console.log('VideoElement:', !!videoElement);
          console.log('CameraStream:', !!this.cameraStream);
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
      
      if (!videoElement || !this.cameraStream) {
        console.error('Éléments caméra introuvables');
        return;
      }

      // Vérifier que la vidéo est bien en cours de lecture
      if (videoElement.readyState < 2) {
        console.error('Vidéo pas encore prête, readyState:', videoElement.readyState);
        alert('La caméra n\'est pas encore prête. Veuillez attendre quelques secondes et réessayer.');
        return;
      }

      // Vérifier les dimensions de la vidéo
      const videoWidth = videoElement.videoWidth;
      const videoHeight = videoElement.videoHeight;
      
      console.log(`📹 Dimensions vidéo: ${videoWidth}x${videoHeight}`);
      
      if (videoWidth === 0 || videoHeight === 0) {
        console.error('Dimensions vidéo invalides');
        alert('Erreur: dimensions de la vidéo invalides. Veuillez relancer la caméra.');
        return;
      }

      // Créer le canvas avec les bonnes dimensions
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.error('Impossible de créer le contexte 2D');
        return;
      }

      // Définir les dimensions du canvas
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      
      console.log(`🎨 Canvas créé: ${canvas.width}x${canvas.height}`);

      // Capturer l'image de la vidéo
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      
      // Vérifier que quelque chose a été capturé (pixel test)
      const imageData = ctx.getImageData(0, 0, Math.min(10, canvas.width), Math.min(10, canvas.height));
      const hasContent = Array.from(imageData.data).some(value => value !== 0);
      
      if (!hasContent) {
        console.error('⚠️ Canvas semble vide, tentative avec délai...');
        // Attendre un peu et réessayer
        await new Promise(resolve => setTimeout(resolve, 500));
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      }

      // Ajouter l'overlay "Promotion 2025"
      this.addPromotionOverlay(ctx, canvas.width, canvas.height);

      // Télécharger l'image
      const link = document.createElement('a');
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T')[0];
      link.download = `quiz-promotion-2025-${timestamp}.jpg`;
      
      // Utiliser une qualité plus élevée pour une meilleure image
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      
      // Déboguer: afficher la taille du dataURL
      console.log(`📸 Taille de l'image générée: ${link.href.length} caractères`);
      
      link.click();

      this.photoTaken = true;
      console.log('✅ Photo de groupe prise avec succès !');
      
      // Fermer la caméra après 2 secondes
      setTimeout(() => {
        this.stopCamera();
      }, 2000);

    } catch (error) {
      console.error('❌ Erreur lors de la prise de photo:', error);
      alert('Erreur lors de la capture de la photo. Veuillez réessayer.');
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
    this.cameraReady = false;
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

  // Méthodes de gestion admin
  extendSession(): void {
    this.adminAuthService.extendSession();
  }

  logout(): void {
    if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
      this.adminAuthService.logout();
      this.router.navigate(['/admin-login']);
    }
  }

  getRemainingTime(): string {
    return this.adminAuthService.getFormattedRemainingTime();
  }

  // Méthodes de restauration
  async onRestoreGame(): Promise<void> {
    if (!this.buttonsEnabled) return;
    
    // Attendre le temps minimum d'affichage du modal
    const elapsedTime = Date.now() - this.modalStartTime;
    if (elapsedTime < this.minModalDisplayTime) {
      await new Promise(resolve => setTimeout(resolve, this.minModalDisplayTime - elapsedTime));
    }

    try {
      console.log('🔄 Tentative de restauration de la partie...');
      
      const restored = await this.quizService.restoreGameState();
      if (restored) {
        this.showRestoreDialog = false;
        
        // Synchroniser l'état local avec l'état restauré
        this.participants = this.quizService.participants;
        
        // Récupérer l'étape actuelle du serveur
        try {
          const gameState = await this.quizService.getGameState();
          this.step = gameState?.step || 'lobby';
          
          // Si on est dans une question, synchroniser le timer
          if (this.step === 'question') {
            console.log('🕐 Restauration pendant une question, synchronisation du timer');
            await this.syncTimerWithServer();
          }
          
        } catch (error) {
          console.warn('Erreur lors de la récupération de l\'étape, utilisation de lobby par défaut');
          this.step = 'lobby';
        }
        
        console.log('✅ Partie restaurée avec succès !');
        
      } else {
        console.error('❌ Impossible de restaurer la partie');
        this.onStartNewGame();
      }
    } catch (error) {
      console.error('❌ Erreur lors de la restauration:', error);
      this.onStartNewGame();
    }
  }

  onStartNewGame(): void {
    if (!this.buttonsEnabled) return;
    
    // Attendre le temps minimum d'affichage du modal
    const elapsedTime = Date.now() - this.modalStartTime;
    if (elapsedTime < this.minModalDisplayTime) {
      setTimeout(() => {
        this.actuallyStartNewGame();
      }, this.minModalDisplayTime - elapsedTime);
    } else {
      this.actuallyStartNewGame();
    }
  }

  private actuallyStartNewGame(): void {
    console.log('🆕 Démarrage d\'une nouvelle partie');
    this.showRestoreDialog = false;
    
    // Effacer la sauvegarde précédente
    this.quizService.clearSavedGameState();
    
    // Initialiser une nouvelle partie
    this.initializeNewGame();
  }

  /**
   * Synchronise l'état local avec l'état du serveur
   */
  private async synchronizeWithServer(serverState: any): Promise<void> {
    try {
      console.log('🔄 Synchronisation avec l\'état du serveur:', serverState);
      
      // Initialiser les composants de base
      this.quizService.initQuestions();
      
      // Synchroniser l'étape
      this.step = serverState.step || 'lobby';
      
      // Initialiser les souscriptions
      this.initializeSubscriptions();
      
      // Récupérer la liste des participants depuis le serveur
      try {
        const participants = await this.quizService.fetchParticipantsFromServer();
        this.participants = participants || [];
        console.log('👥 Participants synchronisés:', this.participants.length);
      } catch (error) {
        console.warn('⚠️ Impossible de récupérer les participants:', error);
        this.participants = [];
      }
      
      // Si on est dans une question, synchroniser l'index et le timer
      if (serverState.step === 'question') {
        this.currentIndex = serverState.currentQuestionIndex || 0;
        this.currentQuestion = this.quizService.getCurrentQuestion(this.currentIndex);
        
        // Synchroniser le timer si nécessaire
        if (serverState.questionStartTime) {
          this.checkAndSyncTimer();
        }
      }
      
      // Si on est dans les résultats, synchroniser l'index de la question
      if (serverState.step === 'result') {
        this.currentIndex = serverState.currentQuestionIndex || 0;
        this.currentQuestion = this.quizService.getCurrentQuestion(this.currentIndex);
      }
      
      // Forcer la détection des changements
      this.cdr.detectChanges();
      
      console.log('✅ Synchronisation terminée:', {
        step: this.step,
        currentIndex: this.currentIndex,
        participants: this.participants.length
      });
      
    } catch (error) {
      console.error('❌ Erreur lors de la synchronisation:', error);
      throw error;
    }
  }
}
