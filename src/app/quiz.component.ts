import { User } from './models/user.model';
import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Subscription, interval, take } from 'rxjs';
import { Question } from './models/question.model';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { QuizService, QuizStep } from './services/quiz-secure.service';
import { WebSocketTimerService } from './services/websocket-timer.service';
import { environment } from '../environments/environment';
import { UserStateService } from './services/user-state.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quiz.component.html',
  styleUrls: ['./quiz.component.css']
})
export class QuizComponent implements OnInit, OnDestroy {
  
  // Propriétés d'état du quiz
  public answerSubmitted: boolean = false;
  private justSubmitted: boolean = false;
  leaderboard: User[] = [];
  avatarUrl: string | null = null;
  goodAnswersTimes: number[] = [];
  currentIndex: number = 0;
  currentQuestion: Question | null = null;
  selectedAnswerIndex: number | null = null;
  isAnswerCorrect: boolean | null = null;
  quizFinished = false;
  
  // Système de loading pour les transitions synchronisées
  isLoading: boolean = false;
  loadingMessage: string = '';
  loadingType: string = '';
  
  // Timer properties
  timerValue: number = 15;
  timerMax: number = 15;
  timerPercent: number = 100;
  timerActive: boolean = false;
  waitingForStart: boolean = false;
  private timerQuestionIndex: number = -1;
  public questionStartTime: number = 0; // Public pour le template
  private timerCountdownSub?: Subscription;
  
  // Souscriptions WebSocket
  private websocketTimerSub?: Subscription;
  private stepTransitionSub?: Subscription;
  private stepActivationSub?: Subscription;
  private questionsSyncSub?: Subscription;
  private quizStateUnsub?: () => void;
  private lastQuestionIndex: number = -1;
  private lastStep: QuizStep | null = null;
  private subscriptions: Subscription[] = []; // CORRECTION: Collection de toutes les souscriptions
  
  // Données utilisateur
  userId: string = '';
  userName: string = '';
  step: QuizStep = 'lobby';
  webSocketStep: string | null = null;  // ✅ AJOUT: Étape reçue via WebSocket
  answers: any[] = [];
  personalScore: { good: number, bad: number, none: number } = { good: 0, bad: 0, none: 0 };
  totalScore: number = 0;
  questionResults: { good: number, bad: number, none: number }[] = [];
  private scoredQuestions: Set<number> = new Set(); // Pour éviter la double incrémentation
  answersSub?: Subscription;

  // ✅ PROTECTION VOTE: Tracker les questions déjà répondues
  public answeredQuestions: Set<number> = new Set();

  // Clé de stockage pour l'état du joueur
  private readonly PLAYER_STATE_KEY = 'quiz_player_state';

  constructor(
    private quizService: QuizService, 
    private router: Router, 
    private cdr: ChangeDetectorRef,
    private websocketTimerService: WebSocketTimerService,
    private userStateService: UserStateService,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    // Utiliser notre service pour récupérer les informations utilisateur
    const userData = this.userStateService.getUserInfo();
    if (userData) {
      this.userId = userData.id || '';
      this.userName = userData.name || '';
      this.avatarUrl = userData.avatarUrl || null;
    } else {
      // Fallback vers le localStorage pour la compatibilité
      this.avatarUrl = localStorage.getItem('avatarUrl');
    }
    
    this.quizService.initQuestions();
    
    // S'abonner aux changements de questions
    this.subscribeToQuestionsChanges();
    
    // Restaurer l'état du joueur s'il existe
    const stateRestored = this.restorePlayerState();
    if (stateRestored) {
      console.log('[PLAYER-STATE] État restauré avec succès au démarrage');
    }
    
    this.subscribeAnswers();

    // ✅ S'abonner aux mises à jour WebSocket du timer
    this.websocketTimerSub = this.websocketTimerService.getCountdown().subscribe(timerState => {
      console.log('[PLAYER-TIMER-WS] Timer state reçu:', {
        questionStartTime: timerState.questionStartTime,
        timeRemaining: timerState.timeRemaining,
        isActive: timerState.isActive,
        step: timerState.step,  // ✅ NOUVEAU: Étape reçue via WebSocket
        localStep: this.step
      });

      // ✅ CORRECTION: Sauvegarder et utiliser l'étape reçue du serveur via WebSocket
      if (timerState.step) {
        this.webSocketStep = timerState.step;
      }
      const currentStep = this.webSocketStep || this.step;

      // 🚨 Correction critique : forcer l'arrêt du timer si l'étape n'est plus 'question'
      if (currentStep !== 'question') {
        if (this.timerActive) {
          console.log('[PLAYER-TIMER-WS][FORCE-STOP] Étape != question, arrêt forcé du timer. Étape courante :', currentStep);
        }
        this.timerActive = false;
        this.stopTimer();
        // On peut garder la valeur du timer pour affichage, mais il ne doit plus tourner ni permettre de jouer
        this.cdr.detectChanges();
        return;
      }

      // ✅ CORRECTION: Permettre aux joueurs en retard de savoir qu'une question était/est active
      // Même si on arrive pendant 'result', on doit pouvoir identifier qu'une question était en cours
      if (timerState.questionStartTime && timerState.questionStartTime > 0) {
        this.questionStartTime = timerState.questionStartTime;
        const oldTimerValue = this.timerValue;
        this.timerValue = timerState.timeRemaining;
        this.timerPercent = (timerState.timeRemaining / (timerState.timerMax || 20)) * 100;
        
        // ✅ FIX MOBILE: Toujours activer le timer si questionStartTime > 0, même si isActive est faux
        // Certains appareils mobiles peuvent avoir des problèmes à recevoir correctement isActive
        this.timerActive = true; // Activer systématiquement si questionStartTime > 0
        this.timerMax = timerState.timerMax;

        console.log('[PLAYER-TIMER-WS] ✅ Timer activé, questionStartTime mis à jour:', {
          questionStartTime: this.questionStartTime,
          canPlay: this.canPlay,
          timeRemaining: this.timerValue,
          currentStep: currentStep,
          stepFromWS: timerState.step,
          webSocketStep: this.webSocketStep,
          localStep: this.step,
          deviceType: this.getMobileDeviceInfo() // Nouveau: info sur l'appareil
        });

        // Forcer la détection de changements pour réactiver les boutons
        this.cdr.detectChanges();

        // Gestion de l'expiration automatique
        if (this.timerValue <= 0) { // Retiré la dépendance sur timerActive
          this.handleTimerExpired();
        }

        console.log('🔄 WebSocket Timer Update (manuel démarré):', {
          serverStartTime: timerState.questionStartTime,
          timeRemaining: timerState.timeRemaining,
          isActive: timerState.isActive,
          oldValue: oldTimerValue,
          newValue: this.timerValue,
          forcedActive: true // Toujours actif si questionStartTime > 0
        });
      } else {
        // Timer pas encore démarré manuellement OU questionStartTime invalide, rester en attente
        this.timerActive = false;
        this.timerValue = timerState.timerMax || 20;
        this.timerPercent = 100;
        this.questionStartTime = 0; // Force à 0 peu importe la valeur reçue
        console.log('⏸️ Timer en attente - questionStartTime reçu:', timerState.questionStartTime, 'forcé à 0, canPlay =', this.canPlay);
      }
    });

    // ✅ S'abonner aux transitions d'étapes synchronisées via WebSocket
    this.stepTransitionSub = this.websocketTimerService.getStepTransitions().subscribe(transitionData => {
      console.log('[STEP-WS] Transition reçue:', transitionData);
      this.showLoadingForTransition(transitionData.fromStep as QuizStep, transitionData.toStep as QuizStep);
    });

    this.stepActivationSub = this.websocketTimerService.getStepActivations().subscribe(activationData => {
      console.log('[STEP-WS] Activation reçue:', activationData);
      this.step = activationData.step as QuizStep;
      this.isLoading = false;
      
      // Actions spécifiques aux étapes après activation synchronisée
      this.handleStepActivation(activationData.step as QuizStep);
      
      this.cdr.detectChanges();
    });

    // CORRECTION: S'abonner aux messages de reset du quiz
    const quizResetSub = this.websocketTimerService.getQuizResets().subscribe(resetData => {
      console.log('[QUIZ] Message de reset du quiz reçu via WebSocket:', resetData);
      
      if (resetData.action === 'reset-all') {
        // Nettoyer l'état local et les réponses
        this.selectedAnswerIndex = null;
        this.totalScore = 0;
        this.scoredQuestions.clear();
        this.answeredQuestions.clear();
        
        // Nettoyer les caches locaux
        try {
          localStorage.removeItem(this.PLAYER_STATE_KEY);
          localStorage.removeItem('quiz-user');
          localStorage.removeItem('quiz_answers');
        } catch (e) {
          console.warn('[QUIZ] Erreur lors du nettoyage des caches:', e);
        }
        
        // Forcer une redirection vers la page de login pour un reset complet
        this.router.navigate(['/login']);
        
        console.log('[QUIZ] Nettoyage complet et redirection suite au message de reset');
      }
    });
    this.subscriptions.push(quizResetSub);
    
    // ✅ S'abonner aux notifications de synchronisation des questions
    this.questionsSyncSub = this.websocketTimerService.getQuestionsSync().subscribe(async syncData => {
      console.log('[QUESTIONS-WS] Synchronisation reçue:', syncData);
      // Gestion structure imbriquée (comme côté présentation)
      let actionValue = syncData.action;
      const rawData = syncData as any;
      if (!actionValue && rawData.data && rawData.data.action) {
        actionValue = rawData.data.action;
        console.log('[QUESTIONS-WS] Action extraite de structure imbriquée:', actionValue);
      }
      console.log('[QUESTIONS-WS] Action finale:', actionValue);
      if (actionValue === 'reload') {
        try {
          console.log('[QUESTIONS-WS] Rechargement des questions demandé...');
          // Forcer le rechargement des questions
          await this.quizService.reloadQuestions();
          // Mettre à jour la question courante
          const newCurrentQuestion = this.quizService.getCurrentQuestion(this.currentIndex);
          if (newCurrentQuestion) {
            this.currentQuestion = newCurrentQuestion;
            console.log('[QUESTIONS-WS] Question courante mise à jour:', {
              index: this.currentIndex,
              text: newCurrentQuestion.text?.substring(0, 50) + '...'
            });
          }
          this.cdr.detectChanges();
        } catch (error) {
          console.error('[QUESTIONS-WS] Erreur lors du rechargement des questions:', error);
        }
      }
    });

    // AJOUT: Vérification périodique des questions (solution de contournement)
    this.startPeriodicQuestionsCheck();

    // Fallback pour les changements d'étapes sans WebSocket
    this.quizService.getStep().subscribe((step: QuizStep) => {
      if (this.step === step) {
        return;
      }
      console.log('[STEP-FALLBACK] Changement d\'étape direct:', this.step, '->', step);
      this.step = step;
      this.handleStepActivation(step);
    });
    
    // Check forcé périodique pour détecter les resets (toutes les 5 secondes)
    setInterval(async () => {
      try {
        const currentStep = await this.quizService.forceCheckState();
        if (currentStep === 'lobby' && this.step !== 'lobby') {
          console.log('[FORCE-CHECK] Reset détecté via check périodique, redirection vers lobby');
          this.step = 'lobby';
          this.handleStepActivation('lobby');
        }
      } catch (error) {
        // Ignorer les erreurs de check périodique
      }
    }, 5000);
    
    // Gestion des changements d'index de question
    // Note: On a déjà récupéré les données utilisateur dans ngOnInit
    this.quizService.getCurrentIndex().subscribe(idx => {
      if (this.currentIndex === idx) {
        return;
      }
      console.log('[INDEX] Changement vers nouvelle question:', this.currentIndex, '->', idx);
      this.currentIndex = idx;
      this.currentQuestion = this.quizService.getCurrentQuestion(idx);
      
      // Reset states pour nouvelle question
      this.answerSubmitted = false;
      this.justSubmitted = false;
      this.selectedAnswerIndex = null;
      this.isAnswerCorrect = null;
      this.questionStartTime = 0; // IMPORTANT: Réinitialiser le timer pour nouvelle question
      this.timerActive = false;
      
      console.log('[INDEX] États réinitialisés pour nouvelle question:', {
        currentIndex: this.currentIndex,
        selectedAnswerIndex: this.selectedAnswerIndex,
        answerSubmitted: this.answerSubmitted,
        questionStartTime: this.questionStartTime
      });
      
      // ✅ NOUVEAU: Forcer la détection de changements après reset
      this.cdr.detectChanges();
      
      this.savePlayerState();
    });
  }

  // S'abonner aux changements de questions
  private subscribeToQuestionsChanges() {
    const questionsSub = this.quizService.questions$.subscribe(questions => {
      if (questions.length > 0) {
        console.log(`[PLAYER-QUESTIONS] Nouvelle liste de questions reçue: ${questions.length} questions`);
        
        // Mettre à jour la question courante si elle a changé
        const newCurrentQuestion = this.quizService.getCurrentQuestion(this.currentIndex);
        if (newCurrentQuestion && 
            (!this.currentQuestion || this.currentQuestion.id !== newCurrentQuestion.id)) {
          
          console.log(`[PLAYER-QUESTIONS] Question ${this.currentIndex} mise à jour:`, {
            ancien: this.currentQuestion?.text?.substring(0, 50) + '...',
            nouveau: newCurrentQuestion.text?.substring(0, 50) + '...'
          });
          
          this.currentQuestion = newCurrentQuestion;
          
          // Reset l'état de la question si on était en cours de réponse
          if (this.step === 'question' && !this.answerSubmitted) {
            this.selectedAnswerIndex = null;
            this.isAnswerCorrect = null;
          }
        }
      }
    });
    
    // Pas besoin de gérer la souscription car elle sera automatiquement nettoyée à la destruction du composant
  }

  private subscribeAnswers() {
    if (this.answersSub) this.answersSub.unsubscribe();
    this.answersSub = this.quizService.getAnswers$(this.currentIndex).subscribe(answers => {
      this.answers = answers;
    });
  }

  startTimer() {
    this.stopTimer();
    this.timerActive = true;
    this.timerValue = this.timerMax;
    this.timerPercent = 100;
    this.timerQuestionIndex = this.currentIndex;
    this.questionStartTime = Date.now();
    
    console.log('[TIMER] Timer démarré pour question', this.currentIndex);
  }

  stopTimer() {
    if (this.timerCountdownSub) {
      this.timerCountdownSub.unsubscribe();
    }
    this.timerActive = false;
    console.log('[TIMER] Timer arrêté');
  }

  private handleTimerExpired(): void {
    console.log('[TIMER] Timer expiré !');
    if (this.answerSubmitted || !this.timerActive) {
      return;
    }

    this.timerActive = false;
    this.stopTimer();
    
    // Auto-submit sans réponse si pas encore soumis
    if (!this.answerSubmitted) {
      this.selectAnswer(-1); // -1 = pas de réponse
    }
    
    // ✅ NOUVEAU: Forcer l'affichage des résultats côté joueur
    console.log('[TIMER-EXPIRED] Forcer affichage résultats côté joueur');
    this.forceShowResults();
  }

  selectAnswer(index: number) {
    // ✅ PROTECTION VOTE: Vérifier si déjà répondu à cette question
    if (this.answeredQuestions.has(this.currentIndex)) {
      console.log('[VOTE-PROTECTION] ❌ Question déjà répondue, vote bloqué côté frontend');
      return;
    }
    
    // Logs de débogage pour comprendre pourquoi les boutons ne fonctionnent pas
    console.log('[SELECT] Tentative sélection:', {
      index: index,
      answerSubmitted: this.answerSubmitted,
      questionStartTime: this.questionStartTime,
      step: this.step,
      canPlay: this.canPlay,
      currentIndex: this.currentIndex,
      alreadyAnswered: this.answeredQuestions.has(this.currentIndex)
    });
    
    if (this.answerSubmitted) {
      console.log('[SELECT] Bloqué - réponse déjà soumise');
      return;
    }

    console.log('[SELECT] Réponse sélectionnée:', index);
    this.selectedAnswerIndex = index;
    
    // ✅ DEBUG: Forcer la détection de changements pour s'assurer que les classes CSS sont appliquées
    this.cdr.detectChanges();
    
    console.log('[SELECT] État après sélection:', {
      selectedAnswerIndex: this.selectedAnswerIndex,
      step: this.step,
      webSocketStep: this.webSocketStep,
      currentIndex: this.currentIndex,
      answerSubmitted: this.answerSubmitted
    });
    
    if (this.currentQuestion) {
      this.isAnswerCorrect = index === this.currentQuestion.correctIndex;
      console.log('[SELECT] Réponse correcte?', this.isAnswerCorrect);
    }

    this.submitAnswer(index);
  }

  async submitAnswer(answerIndex: number) {
    if (this.answerSubmitted) {
      console.log('[VOTE-PROTECTION] ❌ Tentative de vote multiple bloquée côté frontend');
      return;
    }

    this.answerSubmitted = true;
    this.justSubmitted = true;

    console.log('[SUBMIT] ✅ AVANT soumission - selectedAnswerIndex:', this.selectedAnswerIndex, 'answerIndex:', answerIndex);

    try {
      await this.quizService.submitAnswer(this.userId, answerIndex, this.userName, this.currentIndex);
      console.log('[SUBMIT] ✅ Réponse soumise avec succès');
      
      // ✅ PROTECTION VOTE: Marquer cette question comme répondue
      this.answeredQuestions.add(this.currentIndex);
      console.log('[VOTE-PROTECTION] Question', this.currentIndex, 'marquée comme répondue');
      
      // ✅ DEBUG CRITIQUE: Vérifier que selectedAnswerIndex est toujours correct
      console.log('[SUBMIT] ✅ APRÈS soumission - selectedAnswerIndex:', this.selectedAnswerIndex, 'devrait être:', answerIndex);
      
    } catch (error: any) {
      console.error('[SUBMIT] Erreur lors de la soumission:', error);
      
      // ✅ PROTECTION: Gérer spécifiquement le cas du vote déjà effectué
      if (error.message === 'ALREADY_VOTED') {
        console.log('[VOTE-PROTECTION] ⚠️ Vote déjà effectué pour cette question - maintenir answerSubmitted = true');
        // Ne PAS remettre answerSubmitted à false car l'utilisateur a effectivement déjà voté
        alert('Vous avez déjà voté pour cette question !');
        return;
      }
      
      // Pour toute autre erreur, permettre une nouvelle tentative
      this.answerSubmitted = false;
      return;
    }

    // Ne PAS calculer le score immédiatement - attendre l'étape 'result'
    console.log('[SUBMIT] Réponse soumise, score sera calculé lors de la révélation des résultats');

    this.savePlayerState();
  }

  // Calculer le score pour la question courante (appelé lors de la révélation des résultats)
  private calculateScoreForCurrentQuestion() {
    // Vérifier si le score a déjà été calculé pour cette question
    if (this.scoredQuestions.has(this.currentIndex)) {
      console.log('[SCORE] Score déjà calculé pour la question', this.currentIndex, ', ignorer');
      return;
    }

    if (this.currentQuestion && this.selectedAnswerIndex !== null && this.selectedAnswerIndex >= 0) {
      const isCorrect = this.selectedAnswerIndex === this.currentQuestion.correctIndex;
      
      if (isCorrect) {
        this.totalScore++;
        console.log('[SCORE] Point ajouté lors de la révélation des résultats:', this.totalScore);
        
        // CORRECTION: Envoyer le score mis à jour au serveur pour la synchronisation
        this.sendScoreToServer(this.totalScore, this.currentIndex);
      } else {
        console.log('[SCORE] Réponse incorrecte, pas de point ajouté');
      }

      // Marquer que le score a été calculé pour cette question
      this.scoredQuestions.add(this.currentIndex);
    } else {
      console.log('[SCORE] Aucune réponse ou réponse invalide, pas de point ajouté');
      // Même si pas de réponse, marquer comme calculé pour éviter les re-calculs
      this.scoredQuestions.add(this.currentIndex);
    }
  }

  // Méthode pour recalculer le score lors de la restauration (autorise le recalcul)
  private recalculateScoreForQuestion(questionIndex: number, userAnswerIndex: number): boolean {
    const question = this.quizService.getCurrentQuestion(questionIndex);
    
    if (question && userAnswerIndex === question.correctIndex) {
      console.log(`[RESTORE-CALC] Question ${questionIndex} correcte`);
      return true;
    } else {
      console.log(`[RESTORE-CALC] Question ${questionIndex} incorrecte ou invalide`);
      return false;
    }
  }

  // Système de loading pour les transitions synchronisées
  private showLoadingForTransition(fromStep: QuizStep, toStep: QuizStep) {
    // Affichage loading seulement pour les transitions importantes
    if (this.shouldShowLoadingForTransition(fromStep, toStep)) {
      this.isLoading = true;
      this.loadingType = this.getTransitionType(fromStep, toStep);
      this.loadingMessage = this.getLoadingMessage(this.loadingType);
      console.log('[LOADING] Transition:', fromStep, '->', toStep, 'Type:', this.loadingType);
    }
  }

  private shouldShowLoadingForTransition(fromStep: QuizStep, toStep: QuizStep): boolean {
    // Loading seulement pour les transitions majeures
    const majorTransitions = [
      'lobby->waiting',
      'waiting->question', 
      'question->result',
      'result->question',
      'result->end'
    ];
    
    const transitionKey = `${fromStep}->${toStep}`;
    return majorTransitions.includes(transitionKey);
  }

  private getTransitionType(fromStep: QuizStep, toStep: QuizStep): string {
    if (toStep === 'question') return 'question-start';
    if (toStep === 'result') return 'question-result';
    if (toStep === 'waiting') return 'next-question';
    if (toStep === 'end') return 'quiz-end';
    return 'transition';
  }

  private getLoadingMessage(type: string): string {
    switch (type) {
      case 'question-start': return 'Question suivante...';
      case 'question-result': return 'Résultats...';
      case 'next-question': return 'Préparation...';
      case 'quiz-end': return 'Terminé !';
      default: return 'Synchronisation...';
    }
  }

  // Gestion des actions spécifiques lors de l'activation synchronisée des étapes
  private handleStepActivation(step: QuizStep) {
    console.log('[STEP-ACTIVATION] Traitement de l\'étape:', step);
    
    if (step === 'lobby') {
      console.log('[QUIZ] Reset détecté, nettoyage et redirection vers login');
      this.userStateService.clearUserInfo();
      localStorage.removeItem(this.PLAYER_STATE_KEY);
      
      this.router.navigate(['/login']);
      this.totalScore = 0;
      this.questionResults = [];
      this.scoredQuestions.clear(); // Nettoyer le suivi des scores
      this.answeredQuestions.clear(); // ✅ PROTECTION VOTE: Nettoyer les questions répondues
      this.personalScore = { good: 0, bad: 0, none: 0 };
      this.goodAnswersTimes = [];
      this.selectedAnswerIndex = null;
      this.answerSubmitted = false;
      this.quizFinished = false;
    } else if (step === 'end') {
      this.quizFinished = true;
      this.stopTimer();
    } else if (step === 'result') {
      this.timerActive = false;
      this.stopTimer();
      
      // Calculer le score maintenant que les résultats sont révélés
      this.calculateScoreForCurrentQuestion();
    } else if (step === 'question') {
      this.currentQuestion = this.quizService.getCurrentQuestion(this.currentIndex);
      // IMPORTANT: Réinitialiser le timer pour chaque nouvelle question
      this.questionStartTime = 0;
      this.timerActive = false;
      console.log('[STEP-ACTIVATION] Question activée, timer réinitialisé, questionStartTime = 0');
    }
    
    this.savePlayerState();
  }

  // Sauvegarde et restauration de l'état du joueur
  private savePlayerState() {
    const playerState = {
      userId: this.userId,
      userName: this.userName,
      currentIndex: this.currentIndex,
      step: this.step,
      selectedAnswerIndex: this.selectedAnswerIndex,
      answerSubmitted: this.answerSubmitted,
      isAnswerCorrect: this.isAnswerCorrect,
      totalScore: this.totalScore,
      personalScore: this.personalScore,
      scoredQuestions: Array.from(this.scoredQuestions),
      answeredQuestions: Array.from(this.answeredQuestions), // ✅ PROTECTION VOTE: Sauvegarder questions répondues
      timestamp: Date.now()
    };

    try {
      localStorage.setItem(this.PLAYER_STATE_KEY, JSON.stringify(playerState));
      console.log('[SAVE-STATE] État sauvegardé:', {
        currentIndex: playerState.currentIndex,
        selectedAnswerIndex: playerState.selectedAnswerIndex,
        answerSubmitted: playerState.answerSubmitted,
        answeredQuestions: this.answeredQuestions.size
      });
    } catch (error) {
      console.error('[SAVE-STATE] Erreur sauvegarde état:', error);
    }
  }

  private restorePlayerState(): boolean {
    try {
      const savedData = localStorage.getItem(this.PLAYER_STATE_KEY);
      if (!savedData) return false;

      const playerState = JSON.parse(savedData);
      
      // Vérifier la validité de l'état (pas trop ancien)
      const maxAge = 30 * 60 * 1000; // 30 minutes
      if (Date.now() - playerState.timestamp > maxAge) {
        localStorage.removeItem(this.PLAYER_STATE_KEY);
        return false;
      }

      // Restaurer l'état de base
      this.userId = playerState.userId || '';
      this.userName = playerState.userName || '';
      const savedQuestionIndex = playerState.currentIndex || 0;
      this.currentIndex = savedQuestionIndex;
      
      // ✅ CORRECTION: Ne restaurer selectedAnswerIndex que si on est sur la même question
      if (savedQuestionIndex === this.currentIndex) {
        // ✅ CORRECTION TYPE: S'assurer que selectedAnswerIndex est un nombre valide ou null
        const savedAnswerIndex = playerState.selectedAnswerIndex;
        if (typeof savedAnswerIndex === 'number' && savedAnswerIndex >= 0) {
          this.selectedAnswerIndex = savedAnswerIndex;
        } else {
          this.selectedAnswerIndex = null;
        }
        
        this.answerSubmitted = playerState.answerSubmitted || false;
        this.isAnswerCorrect = playerState.isAnswerCorrect || null;
      } else {
        // Question différente - remettre à zéro
        this.selectedAnswerIndex = null;
        this.answerSubmitted = false;
        this.isAnswerCorrect = null;
      }
      
      this.personalScore = playerState.personalScore || { good: 0, bad: 0, none: 0 };
      this.scoredQuestions = new Set(playerState.scoredQuestions || []);
      this.answeredQuestions = new Set(playerState.answeredQuestions || []); // ✅ PROTECTION VOTE: Restaurer questions répondues

      console.log('[RESTORE-STATE] État de base restauré:', {
        currentIndex: this.currentIndex,
        answerSubmitted: this.answerSubmitted,
        userId: this.userId,
        answeredQuestions: this.answeredQuestions.size
      });

      // Récupérer les réponses du serveur pour recalculer le score correct
      if (this.userId) {
        this.restoreScoreFromServer();
      } else {
        this.totalScore = playerState.totalScore || 0;
      }

      return true;
    } catch (error) {
      console.error('[RESTORE-STATE] Erreur restauration état:', error);
      localStorage.removeItem(this.PLAYER_STATE_KEY);
      return false;
    }
  }

  private async restoreScoreFromServer() {
    try {
      console.log('[RESTORE-SCORE] Récupération des réponses du serveur pour recalculer le score...');
      
      // Attendre que les questions soient chargées
      await this.waitForQuestionsToLoad();
      
      const userAnswers = await this.quizService.getUserAnswers(this.userId);
      console.log('[RESTORE-SCORE] Réponses brutes récupérées:', userAnswers);
      
      let calculatedScore = 0;
      const newScoredQuestions = new Set<number>();

      for (const answer of userAnswers) {
        const question = this.quizService.getCurrentQuestion(answer.questionIndex);
        console.log(`[RESTORE-SCORE] Question ${answer.questionIndex}:`, {
          question: question?.text?.substring(0, 50) + '...',
          userAnswerIndex: answer.answerIndex,
          correctIndex: question?.correctIndex,
          isCorrect: answer.answerIndex === question?.correctIndex,
          currentQuestionIndex: this.currentIndex
        });
        
        // ✅ CORRECTION: Ne compter les points que pour les questions déjà terminées (result révélés)
        // Si c'est la question courante et qu'on n'est pas encore à l'étape 'result', ne pas compter le point
        if (answer.questionIndex === this.currentIndex && this.step !== 'result' && this.step !== 'end') {
          console.log(`[RESTORE-SCORE] Question ${answer.questionIndex} est la question courante et pas encore à l'étape result, point non compté`);
          // Marquer comme ayant une réponse mais sans scorer pour l'instant
          // Le point sera ajouté quand on atteindra l'étape 'result'
          continue;
        }
        
        if (question && answer.answerIndex === question.correctIndex) {
          calculatedScore++;
          newScoredQuestions.add(answer.questionIndex);
          console.log(`[RESTORE-SCORE] Question ${answer.questionIndex} correcte et terminée, score: ${calculatedScore}`);
        } else if (question) {
          // Marquer comme traitée même si incorrecte (pour éviter de la traiter plusieurs fois)
          newScoredQuestions.add(answer.questionIndex);
          console.log(`[RESTORE-SCORE] Question ${answer.questionIndex} incorrecte mais terminée`);
        }
      }

      this.totalScore = calculatedScore;
      this.scoredQuestions = newScoredQuestions;

      console.log(`[RESTORE-SCORE] Score final recalculé: ${this.totalScore}/${userAnswers.length}`);
      console.log(`[RESTORE-SCORE] Questions scorées:`, Array.from(this.scoredQuestions));
      console.log(`[RESTORE-SCORE] Étape actuelle: ${this.step}, Question courante: ${this.currentIndex}`);

      // CORRECTION: Synchroniser le score recalculé avec le serveur
      if (this.totalScore > 0) {
        this.sendScoreToServer(this.totalScore, this.currentIndex);
      }
      
      // Sauvegarder l'état mis à jour
      this.savePlayerState();

    } catch (error) {
      console.error('[RESTORE-SCORE] Erreur lors de la restauration du score:', error);
      // En cas d'erreur, utiliser le score sauvegardé localement
      const savedData = localStorage.getItem(this.PLAYER_STATE_KEY);
      if (savedData) {
        const playerState = JSON.parse(savedData);
        this.totalScore = playerState.totalScore || 0;
        console.log('[RESTORE-SCORE] Utilisation du score local sauvegardé:', this.totalScore);
      }
    }
  }

  private async waitForQuestionsToLoad(): Promise<void> {
    return new Promise((resolve) => {
      const checkQuestions = () => {
        if (this.quizService.getQuestions().length > 0) {
          console.log('[RESTORE-SCORE] Questions chargées, nombre:', this.quizService.getQuestions().length);
          resolve();
        } else {
          console.log('[RESTORE-SCORE] En attente du chargement des questions...');
          setTimeout(checkQuestions, 100);
        }
      };
      checkQuestions();
    });
  }

  get totalQuestions(): number {
    return this.quizService.getQuestions().length;
  }

  get currentQuestionNumber(): string {
    const questionNum = (this.currentIndex + 1).toString().padStart(2, '0');
    const totalQuestions = this.totalQuestions.toString().padStart(2, '0');
    return `${questionNum} sur ${totalQuestions}`;
  }

  // ✅ NOUVEAU: Forcer l'affichage des résultats côté joueur
  private forceShowResults(): void {
    console.log('[FORCE-RESULTS] Passage forcé à l\'étape result côté joueur');
    
    // Changer localement l'étape pour afficher les résultats
    this.step = 'result';
    this.webSocketStep = 'result';
    
    // Calculer le score pour la question courante
    this.calculateScoreForCurrentQuestion();
    
    // Forcer la détection de changements
    this.cdr.detectChanges();
    
    // Sauvegarder l'état
    this.savePlayerState();
  }

  // ✅ NOUVEAU: Forcer le reset des états si incohérence détectée
  private lastResetIndex: number = -1; // Pour éviter les appels répétés
  
  public forceResetIfNeeded(): string {
    // Éviter les appels répétés pour le même index
    if (this.lastResetIndex === this.currentIndex) {
      return '';
    }
    
    // Si selectedAnswerIndex n'est pas null mais qu'on n'a pas encore répondu à cette question
    if (this.selectedAnswerIndex !== null && !this.answeredQuestions.has(this.currentIndex)) {
      console.log('[FORCE-RESET] Incohérence détectée - reset forcé:', {
        selectedAnswerIndex: this.selectedAnswerIndex,
        currentIndex: this.currentIndex,
        hasAnswered: this.answeredQuestions.has(this.currentIndex)
      });
      
      this.selectedAnswerIndex = null;
      this.answerSubmitted = false;
      this.isAnswerCorrect = null;
      this.lastResetIndex = this.currentIndex;
      this.cdr.detectChanges();
      return '';
    }
    
    // ✅ NOUVEAU: Si on a répondu mais selectedAnswerIndex est vide, restaurer depuis le serveur
    if (this.selectedAnswerIndex === null && this.answeredQuestions.has(this.currentIndex)) {
      console.log('[FORCE-RESTORE] Question répondue mais selectedAnswerIndex null - restauration depuis serveur');
      this.restoreSelectedAnswerFromServer();
      this.lastResetIndex = this.currentIndex;
      return '';
    }
    
    return '';
  }

  // ✅ NOUVEAU: Restaurer selectedAnswerIndex depuis le serveur pour les questions déjà répondues
  private async restoreSelectedAnswerFromServer(): Promise<void> {
    if (!this.userId || !this.answeredQuestions.has(this.currentIndex)) {
      return;
    }

    console.log('[RESTORE-SELECTION] Tentative de restauration de la sélection depuis le serveur pour question', this.currentIndex);
    
    try {
      const userAnswers = await this.quizService.getUserAnswers(this.userId);
      const answerForCurrentQuestion = userAnswers.find(a => a.questionIndex === this.currentIndex);
      
      if (answerForCurrentQuestion) {
        // ✅ CORRECTION TYPE: S'assurer que answerIndex est un nombre valide
        const answerIndex = answerForCurrentQuestion.answerIndex;
        if (typeof answerIndex === 'number' && answerIndex >= 0) {
          this.selectedAnswerIndex = answerIndex;
        } else {
          console.warn('[RESTORE-SELECTION] ⚠️ answerIndex invalide:', answerIndex, typeof answerIndex);
          this.selectedAnswerIndex = null;
        }
        
        this.answerSubmitted = true;
        this.isAnswerCorrect = answerForCurrentQuestion.answerIndex === this.currentQuestion?.correctIndex;
        
        this.cdr.detectChanges();
        this.savePlayerState();
        
        // Vérification finale pour s'assurer que la valeur est correctement assignée
        setTimeout(() => {
          if ((this.selectedAnswerIndex as any) === '') {
            const answerIndex = answerForCurrentQuestion.answerIndex;
            if (typeof answerIndex === 'number' && answerIndex >= 0) {
              this.selectedAnswerIndex = answerIndex;
              this.cdr.detectChanges();
            }
          }
        }, 100);
      }
    } catch (error) {
      console.error('[RESTORE-SELECTION] ❌ Erreur restauration depuis serveur:', error);
    }
  }

  // ✅ NOUVEAU: Obtenir l'étape active (priorité au WebSocket)
  get activeStep(): QuizStep {
    return (this.webSocketStep as QuizStep) || this.step;
  }

  // ✅ NOUVEAU: Vérifier si on est en étape question ou résultat
  get isQuestionOrResultStep(): boolean {
    const active = this.activeStep;
    return active === 'question' || active === 'result';
  }

  // Vérifier si le joueur peut jouer (seulement quand le timer est démarré par le maître)
  // ✅ CORRECTION TYPE: Nettoyer selectedAnswerIndex si invalide
  private sanitizeSelectedAnswerIndex(): void {
    const value = this.selectedAnswerIndex as any;
    
    if (this.selectedAnswerIndex !== null && 
        (typeof this.selectedAnswerIndex !== 'number' || 
         this.selectedAnswerIndex < 0 || 
         value === '' || 
         isNaN(this.selectedAnswerIndex as any))) {
      
      // Si on a répondu à cette question, restaurer depuis le serveur
      if (this.answeredQuestions.has(this.currentIndex) && this.answerSubmitted) {
        this.restoreSelectedAnswerFromServer();
      } else {
        this.selectedAnswerIndex = null;
      }
      
      this.cdr.detectChanges();
    }
  }

  get canPlay(): boolean {
    // ✅ CORRECTION TYPE: Nettoyer selectedAnswerIndex si invalide
    this.sanitizeSelectedAnswerIndex();
    
    // ✅ PROTECTION VOTE: Ne pas permettre de jouer si déjà répondu à cette question
    if (this.answeredQuestions.has(this.currentIndex)) {
      return false;
    }
    
    // ✅ CORRECTION TIMER: Les joueurs ne peuvent jouer QUE si le timer est démarré côté maître
    const activeStep = this.webSocketStep || this.step;
    const isQuestionPhase = activeStep === 'question';
    
    // ✅ FIX MOBILE: Assouplir la condition du timer actif pour éviter les faux négatifs
    // Sur certains appareils le flag timerActive peut être incorrect alors que questionStartTime est correct
    const timerStarted = this.questionStartTime > 0; // Enlevé la dépendance sur timerActive
    
    // Ajouter un log pour déboguer les problèmes sur les appareils mobiles
    console.log('[DEBUG][MOBILE-FIX] canPlay:', { 
      answerSubmitted: this.answerSubmitted,
      isQuestionPhase,
      activeStep,
      questionStartTime: this.questionStartTime,
      timerActive: this.timerActive,
      timerStarted
    });
    
    // Permettre de jouer SEULEMENT si:
    // - En phase question ET
    // - Timer démarré côté maître (questionStartTime > 0) ET
    // - Pas encore répondu
    return !this.answerSubmitted && 
           isQuestionPhase && 
           timerStarted &&
           this.currentQuestion !== null;
  }

  // AJOUT: Vérification périodique des questions (solution de contournement au WebSocket manqué)
  private periodicQuestionsInterval: any;
  private lastKnownQuestionsCount = 0;

  private startPeriodicQuestionsCheck() {
    // Démarrer la vérification toutes les 5 secondes
    this.periodicQuestionsInterval = setInterval(async () => {
      try {
        // Obtenir le nombre actuel de questions
        const currentQuestions = await this.quizService.questions$.pipe(take(1)).toPromise();
        const currentQuestionsCount = currentQuestions?.length || 0;
        
        // Vérifier s'il y a eu un changement
        if (currentQuestionsCount !== this.lastKnownQuestionsCount && this.lastKnownQuestionsCount > 0) {
          console.log('[PERIODIC-CHECK] Changement détecté dans les questions:', {
            ancien: this.lastKnownQuestionsCount,
            nouveau: currentQuestionsCount
          });
          
          // Recharger les questions
          await this.quizService.reloadQuestions();
          
          // Mettre à jour la question courante
          const newCurrentQuestion = this.quizService.getCurrentQuestion(this.currentIndex);
          if (newCurrentQuestion) {
            this.currentQuestion = newCurrentQuestion;
            console.log('[PERIODIC-CHECK] Question courante mise à jour');
          }
          
          this.cdr.detectChanges();
        }
        
        this.lastKnownQuestionsCount = currentQuestionsCount;
        
      } catch (error) {
        console.error('[PERIODIC-CHECK] Erreur lors de la vérification périodique:', error);
      }
    }, 5000); // Toutes les 5 secondes
    
    // Initialiser le compteur avec les questions actuelles
    this.quizService.questions$.pipe(take(1)).subscribe((questions: Question[]) => {
      this.lastKnownQuestionsCount = questions?.length || 0;
    });
  }

  // ✅ FIX MOBILE: Méthode pour identifier le type d'appareil mobile pour le débogage
  getMobileDeviceInfo(): string {
    try {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      
      // Détection basique du type d'appareil
      if (/android/i.test(userAgent)) {
        return `Android: ${userAgent.split('Android')[1]?.split(';')[0] || 'unknown'}`.substring(0, 30);
      }
      
      // iOS detection
      if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
        return `iOS: ${userAgent.split('OS ')[1]?.split(' ')[0].replace(/_/g, '.') || 'unknown'}`.substring(0, 30);
      }
      
      // Détection du navigateur
      if (/chrome/i.test(userAgent)) return 'Chrome Browser';
      if (/firefox/i.test(userAgent)) return 'Firefox Browser';
      if (/safari/i.test(userAgent)) return 'Safari Browser';
      
      return `Other: ${userAgent.substring(0, 30)}`;
    } catch (e) {
      return 'Error detecting device';
    }
  }
  
  // CORRECTION: Envoyer le score au serveur pour synchronisation avec le classement côté maître
  private sendScoreToServer(score: number, questionIndex: number): void {
    try {
      if (!this.userId) {
        console.warn('[SCORE-SYNC] UserId manquant, impossible de synchroniser le score');
        return;
      }
      
      console.log(`[SCORE-SYNC] Envoi du score ${score} au serveur pour l'utilisateur ${this.userId} (question ${questionIndex})`);
      
      // Utiliser le service WebSocket pour envoyer le score
      this.websocketTimerService.sendUserScore({
        userId: this.userId,
        userName: this.userName,
        score: score,
        questionIndex: questionIndex,
        avatarUrl: this.avatarUrl || undefined,
        timestamp: Date.now()
      });
      
      console.log('[SCORE-SYNC] Score envoyé avec succès');
    } catch (error) {
      console.error('[SCORE-SYNC] Erreur lors de l\'envoi du score au serveur:', error);
    }
  }

  ngOnDestroy(): void {
    if (this.quizStateUnsub) this.quizStateUnsub();
    if (this.websocketTimerSub) this.websocketTimerSub.unsubscribe();
    if (this.stepTransitionSub) this.stepTransitionSub.unsubscribe();
    if (this.stepActivationSub) this.stepActivationSub.unsubscribe();
    if (this.questionsSyncSub) this.questionsSyncSub.unsubscribe();
    if (this.answersSub) this.answersSub.unsubscribe();
    this.stopTimer();
    
    // CORRECTION: Nettoyer toutes les souscriptions dans la collection
    this.subscriptions.forEach(sub => {
      if (sub) sub.unsubscribe();
    });
    this.subscriptions = [];
    
    // AJOUT: Nettoyer la vérification périodique
    if (this.periodicQuestionsInterval) {
      clearInterval(this.periodicQuestionsInterval);
      console.log('[PERIODIC-CHECK] Interval de vérification arrêté');
    }
  }
}