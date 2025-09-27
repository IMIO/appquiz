import { User } from './models/user.model';
import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Subscription, interval, take } from 'rxjs';
import { Question } from './models/question.model';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { QuizService, QuizStep } from './services/quiz-secure.service';
import { WebSocketTimerService } from './services/websocket-timer.service';
import { environment } from '../environments/environment';

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
  private quizStateUnsub?: () => void;
  private lastQuestionIndex: number = -1;
  private lastStep: QuizStep | null = null;
  
  // Données utilisateur
  userId: string = '';
  userName: string = '';
  step: QuizStep = 'lobby';
  answers: any[] = [];
  personalScore: { good: number, bad: number, none: number } = { good: 0, bad: 0, none: 0 };
  totalScore: number = 0;
  questionResults: { good: number, bad: number, none: number }[] = [];
  answersSub?: Subscription;

  // Clé de stockage pour l'état du joueur
  private readonly PLAYER_STATE_KEY = 'quiz_player_state';

  constructor(
    private quizService: QuizService, 
    private router: Router, 
    private cdr: ChangeDetectorRef,
    private websocketTimerService: WebSocketTimerService
  ) { }

  ngOnInit(): void {
    this.avatarUrl = localStorage.getItem('avatarUrl');
    this.quizService.initQuestions();
    
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
        step: this.step
      });
      
      // Ne démarrer le timer que si questionStartTime > 0 (démarrage manuel effectué)
      if (timerState.questionStartTime && timerState.questionStartTime > 0 && this.step === 'question') {
        this.questionStartTime = timerState.questionStartTime;
        const oldTimerValue = this.timerValue;
        this.timerValue = timerState.timeRemaining;
        this.timerPercent = (timerState.timeRemaining / timerState.timerMax) * 100;
        this.timerActive = timerState.isActive;
        this.timerMax = timerState.timerMax;
        
        console.log('[PLAYER-TIMER-WS] Timer activé, questionStartTime mis à jour:', {
          questionStartTime: this.questionStartTime,
          canPlay: this.canPlay,
          timeRemaining: this.timerValue
        });
        
        // Forcer la détection de changements pour réactiver les boutons
        this.cdr.detectChanges();
        
        // Gestion de l'expiration automatique
        if (this.timerValue <= 0 && this.timerActive) {
          this.handleTimerExpired();
        }
        
        console.log('🔄 WebSocket Timer Update (manuel démarré):', {
          serverStartTime: timerState.questionStartTime,
          timeRemaining: timerState.timeRemaining,
          isActive: timerState.isActive,
          oldValue: oldTimerValue,
          newValue: this.timerValue
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

    // Fallback pour les changements d'étapes sans WebSocket
    this.quizService.getStep().subscribe((step: QuizStep) => {
      if (this.step === step) {
        return;
      }
      console.log('[STEP-FALLBACK] Changement d\'étape direct:', this.step, '->', step);
      this.step = step;
      this.handleStepActivation(step);
    });
    
    // Gestion des changements d'index de question
    this.userId = localStorage.getItem('userId') || '';
    this.userName = localStorage.getItem('userName') || '';
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
      
      console.log('[INDEX] États réinitialisés pour nouvelle question, questionStartTime = 0');
      
      this.savePlayerState();
    });
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
  }

  selectAnswer(index: number) {
    // Logs de débogage pour comprendre pourquoi les boutons ne fonctionnent pas
    console.log('[SELECT] Tentative sélection:', {
      index: index,
      answerSubmitted: this.answerSubmitted,
      questionStartTime: this.questionStartTime,
      step: this.step,
      canPlay: this.canPlay
    });
    
    if (this.answerSubmitted) {
      console.log('[SELECT] Bloqué - réponse déjà soumise');
      return;
    }

    console.log('[SELECT] Réponse sélectionnée:', index);
    this.selectedAnswerIndex = index;
    
    if (this.currentQuestion) {
      this.isAnswerCorrect = index === this.currentQuestion.correctIndex;
      console.log('[SELECT] Réponse correcte?', this.isAnswerCorrect);
    }

    this.submitAnswer(index);
  }

  async submitAnswer(answerIndex: number) {
    if (this.answerSubmitted) {
      return;
    }

    this.answerSubmitted = true;
    this.justSubmitted = true;

    try {
      await this.quizService.submitAnswer(this.userId, answerIndex, this.userName, this.currentIndex);
      console.log('[SUBMIT] Réponse soumise avec succès');
    } catch (error) {
      console.error('[SUBMIT] Erreur lors de la soumission:', error);
      this.answerSubmitted = false;
      return;
    }

    // Calculer le score local
    if (this.currentQuestion && answerIndex === this.currentQuestion.correctIndex && answerIndex >= 0) {
      this.totalScore++;
      console.log('[SCORE] Score mis à jour:', this.totalScore);
    }

    this.savePlayerState();
  }

  // Système de loading pour les transitions synchronisées
  private showLoadingForTransition(fromStep: QuizStep, toStep: QuizStep) {
    this.isLoading = true;
    this.loadingType = this.getTransitionType(fromStep, toStep);
    this.loadingMessage = this.getLoadingMessage(this.loadingType);
    console.log('[LOADING] Transition:', fromStep, '->', toStep, 'Type:', this.loadingType);
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
      case 'question-start': return 'Prochaine question en cours...';
      case 'question-result': return 'Calcul des résultats...';
      case 'next-question': return 'Préparation de la question...';
      case 'quiz-end': return 'Quiz terminé !';
      default: return 'Chargement...';
    }
  }

  // Gestion des actions spécifiques lors de l'activation synchronisée des étapes
  private handleStepActivation(step: QuizStep) {
    console.log('[STEP-ACTIVATION] Traitement de l\'étape:', step);
    
    if (step === 'lobby') {
      console.log('[QUIZ] Reset détecté, nettoyage et redirection vers login');
      localStorage.removeItem('userId');
      localStorage.removeItem('userName');
      localStorage.removeItem('avatarUrl');
      localStorage.removeItem(this.PLAYER_STATE_KEY);
      
      this.router.navigate(['/login']);
      this.totalScore = 0;
      this.questionResults = [];
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
      timestamp: Date.now()
    };

    try {
      localStorage.setItem(this.PLAYER_STATE_KEY, JSON.stringify(playerState));
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

      // Restaurer l'état
      this.userId = playerState.userId || '';
      this.userName = playerState.userName || '';
      this.currentIndex = playerState.currentIndex || 0;
      this.selectedAnswerIndex = playerState.selectedAnswerIndex || null;
      this.answerSubmitted = playerState.answerSubmitted || false;
      this.isAnswerCorrect = playerState.isAnswerCorrect || null;
      this.totalScore = playerState.totalScore || 0;
      this.personalScore = playerState.personalScore || { good: 0, bad: 0, none: 0 };

      console.log('[RESTORE-STATE] État restauré:', {
        currentIndex: this.currentIndex,
        answerSubmitted: this.answerSubmitted,
        totalScore: this.totalScore
      });

      return true;
    } catch (error) {
      console.error('[RESTORE-STATE] Erreur restauration état:', error);
      localStorage.removeItem(this.PLAYER_STATE_KEY);
      return false;
    }
  }

  get totalQuestions(): number {
    return this.quizService.getQuestions().length;
  }

  // Vérifier si le joueur peut jouer (timer démarré manuellement)
  get canPlay(): boolean {
    return this.questionStartTime > 0 && !this.answerSubmitted && this.step === 'question';
  }

  ngOnDestroy(): void {
    if (this.quizStateUnsub) this.quizStateUnsub();
    if (this.websocketTimerSub) this.websocketTimerSub.unsubscribe();
    if (this.stepTransitionSub) this.stepTransitionSub.unsubscribe();
    if (this.stepActivationSub) this.stepActivationSub.unsubscribe();
    if (this.answersSub) this.answersSub.unsubscribe();
    this.stopTimer();
  }
}