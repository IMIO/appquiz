
import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { QuizService, QuizStep } from '../services/quiz-secure.service';
import { User } from '../models/user.model';
import { TimerService, TimerState } from '../services/timer.service';
import { Subscription, interval } from 'rxjs';
import { CommonModule } from '@angular/common';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-participant',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './participant.html',
  styleUrls: ['./participant.css']
})
export class Participant implements OnInit {
  private timerQuestionIndex: number = -1;
  waitingForStart: boolean = false;
  private timerCountdownSub?: Subscription;
  private questionStartTime: number = 0;
  private quizStateUnsub?: () => void;
  userId: string = '';
  userName: string = '';
  avatarUrl: string | null = null;
  totalScore: number = 0;
  totalQuestions: number = 0;
  step: QuizStep = 'lobby';
  private previousStep: QuizStep = 'lobby';
  private hasReceivedFirstStep = false;
  leaderboard: User[] = [];
  personalScore: { good: number, bad: number, none: number } = { good: 0, bad: 0, none: 0 };
  questionResults: { good: number, bad: number, none: number }[] = [];
  currentIndex: number = 0;
  answersSub?: Subscription;
  currentQuestion: any = null;
  timerValue: number = 15;
  timerMax: number = 20; // Durée du timer en secondes, synchronisée avec timerValue
  hasAnswered: boolean = false;

  constructor(private quizService: QuizService, private timerService: TimerService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.userId = localStorage.getItem('userId') || '';
    this.userName = localStorage.getItem('userName') || '';
    this.avatarUrl = localStorage.getItem('avatarUrl');
    this.totalQuestions = this.quizService.getQuestions().length;

    this.quizService.getStep().subscribe((step: QuizStep) => {
      console.log('[DEBUG][PARTICIPANT][STEP] step:', step, '| currentIndex:', this.currentIndex, '| previousStep:', this.previousStep);
      
      // Détecter si le quiz a été réinitialisé par l'admin
      // Reset détecté si on revient à 'lobby' après avoir été dans un autre état
      if (step === 'lobby' && this.hasReceivedFirstStep && this.previousStep !== 'lobby' && this.userId) {
        console.log('[RESET][DETECTION] Reset détecté - redirection vers /login');
        console.log('[RESET][DETECTION] Détails:', { step, previousStep: this.previousStep, hasReceivedFirstStep: this.hasReceivedFirstStep, userId: this.userId });
        // Nettoyer le localStorage
        localStorage.removeItem('userId');
        localStorage.removeItem('userName');
        localStorage.removeItem('avatarUrl');
        localStorage.removeItem('quiz-user');
        // Rediriger vers la page d'inscription
        window.location.href = '/login';
        return;
      }
      
      // Marquer qu'on a reçu le premier step et sauvegarder l'état précédent
      if (!this.hasReceivedFirstStep) {
        this.hasReceivedFirstStep = true;
        console.log('[DEBUG][PARTICIPANT][STEP] Premier step reçu:', step);
      }
      this.previousStep = this.step;
      this.step = step;
      
      if (step === 'question') {
        this.currentQuestion = this.quizService.getCurrentQuestion(this.currentIndex);
        console.log('[DEBUG][PARTICIPANT][STEP] startTimer() called - utilisation service centralisé');
        // Plus besoin de fetchQuestionStartTime - le service centralisé gère tout
        this.startTimer();
        this.hasAnswered = false;
      } else {
        this.stopTimer();
      }
    });
    this.quizService.getCurrentIndex().subscribe(idx => {
      console.log('[DEBUG][PARTICIPANT][INDEX] currentIndex reçu:', idx);
      this.currentIndex = idx;
      this.currentQuestion = this.quizService.getCurrentQuestion(idx);
      this.hasAnswered = false; // Réinitialise la possibilité de répondre à chaque nouvelle question
      // Plus besoin de questionStartTime local - le service centralisé gère tout
      // Plus besoin de synchronisation forcée - le service centralisé est déjà synchronisé
      if (this.step === 'question') {
        console.log('[DEBUG][PARTICIPANT][INDEX] Utilisation service centralisé pour timer');
        this.startTimer();
      }
    });
    if (this.answersSub) this.answersSub.unsubscribe();
    this.answersSub = this.quizService.getAllAnswersForUser$(this.userId).subscribe(allAnswers => {
      if (!this.quizService['questions'] || this.quizService['questions'].length === 0) {
        return;
      }
      this.questionResults = allAnswers.map((entry, i) => {
        const currentQ = this.quizService.getCurrentQuestion(i);
        const myAnswer = entry.answer;
        let result = { good: 0, bad: 0, none: 0 };
        if (myAnswer && currentQ) {
          if (Number(myAnswer.answerIndex) === Number(currentQ.correctIndex)) {
            result = { good: 1, bad: 0, none: 0 };
          } else if (Number(myAnswer.answerIndex) === -1) {
            result = { good: 0, bad: 0, none: 1 };
          } else {
            result = { good: 0, bad: 1, none: 0 };
          }
        } else {
          result = { good: 0, bad: 0, none: 1 };
        }
        return result;
      });
      this.totalScore = this.questionResults.reduce((sum, r) => sum + (r?.good || 0), 0);
      this.personalScore = this.questionResults[this.currentIndex] || { good: 0, bad: 0, none: 0 };
      // Synchronise hasAnswered avec la présence d'une réponse pour la question courante
      const entry = allAnswers[this.currentIndex];
      this.hasAnswered = !!(entry && entry.answer && typeof entry.answer.answerIndex !== 'undefined');
    });
  }

  startTimer() {
    this.stopTimer();
    this.timerQuestionIndex = this.currentIndex;
    
    console.log('🕐 [PARTICIPANT] Écoute du timer centralisé (pas de démarrage de sync)');
    
    // S'abonner aux mises à jour du timer centralisé (la présentation gère la synchronisation)
    this.timerCountdownSub = this.timerService.getCountdown().subscribe((timerState: TimerState) => {
      const countdown = timerState.countdownToStart || 0;
      
      if (countdown > 0) {
        // Mode countdown avant démarrage
        this.timerValue = countdown;
        this.timerMax = countdown;
        this.waitingForStart = true;
        console.log(`⏳ [PARTICIPANT] Countdown: Question démarre dans ${countdown}s`);
      } else {
        // Mode timer normal
        this.timerValue = timerState.timeRemaining;
        this.timerMax = timerState.timerMax;
        this.waitingForStart = !timerState.isActive && timerState.questionStartTime === null;
        console.log(`🕐 [PARTICIPANT] Timer: ${timerState.timeRemaining}s/${timerState.timerMax}s, active: ${timerState.isActive}`);
      }
      
      // Forcer la détection des changements pour mise à jour UI immédiate
      if (this.cdr) {
        this.cdr.detectChanges();
      }
      
      if (timerState.timeRemaining <= 0 && timerState.isActive === false && !this.hasAnswered) {
        console.log('🕐 [PARTICIPANT] Timer fini, marquer comme répondu');
        this.hasAnswered = true;
      }
    });
    
    // Log de l'état initial
    const currentState = this.timerService.getCurrentState();
    console.log(`🕐 [PARTICIPANT] État initial: ${currentState.timeRemaining}s/${currentState.timerMax}s, active: ${currentState.isActive}`);
  }

  /** DEPRECATED: Remplacée par le service timer centralisé */
  async listenToQuestionStartTime_DEPRECATED(idx: number) {
    console.warn('[DEPRECATED] listenToQuestionStartTime appelée - utiliser le service timer centralisé');
    // Cette méthode ne fait plus rien - le service centralisé gère tout
    return;
  }

  // DEPRECATED: Remplacée par le service timer centralisé
  private updateTimerValue_DEPRECATED() {
    console.warn('[DEPRECATED] updateTimerValue appelée - utiliser le service timer centralisé');
    // Cette méthode ne fait plus rien - le service centralisé gère tout
    return;
  }

  /** DEPRECATED: Remplacée par le service timer centralisé */
  async fetchQuestionStartTime_DEPRECATED(idx: number) {
    console.warn('[DEPRECATED] fetchQuestionStartTime appelée - utiliser le service timer centralisé');
    // Cette méthode ne fait plus rien - le service centralisé gère tout
    return;
  }

  stopTimer() {
    if (this.timerCountdownSub) {
      this.timerCountdownSub.unsubscribe();
      this.timerCountdownSub = undefined;
    }
    // Note: Ne pas arrêter la synchronisation serveur ici car d'autres composants peuvent en avoir besoin
    console.log('🕐 [PARTICIPANT] Arrêt écoute timer');
  }

  ngOnDestroy(): void {
    if (this.quizStateUnsub) this.quizStateUnsub();
    this.stopTimer();
  }

  async selectAnswer(idx: number) {
    if (this.hasAnswered || this.step !== 'question') return;
    this.hasAnswered = true;
    await this.quizService.submitAnswer(this.userId, idx, this.userName, this.currentIndex);
  }
}
