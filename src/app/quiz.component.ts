import { User } from './models/user.model';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { Question } from './models/question.model';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { QuizService, QuizStep } from './services/quiz-secure.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quiz.component.html',
  styleUrls: ['./quiz.component.css']
})
export class QuizComponent implements OnInit {
  syncSelectedAnswerFromServer() {
    // À compléter selon la logique métier
  }

  updateTimerValue() {
    // Logique simplifiée : décrémenter de 1 seconde à chaque appel
    if (this.timerValue > 0) {
      this.timerValue--;
      this.timerPercent = Math.round((this.timerValue / this.timerMax) * 100);
      this.timerActive = this.timerValue > 0;

      // Reduced timer logging to prevent spam
      if (this.timerValue % 5 === 0 || this.timerValue <= 3) { // Log every 5 seconds or last 3 seconds
        console.log('[TIMER] Décrémentation:', {
          timerValue: this.timerValue,
          timerPercent: this.timerPercent,
          timerActive: this.timerActive
        });
      }
    } else {
      this.timerActive = false;
      this.timerValue = 0;
      this.timerPercent = 0;
      console.log('[TIMER] Temps écoulé, timer arrêté');
    }
  }
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
  timerValue: number = 15;
  timerMax: number = 15;
  timerPercent: number = 100;
  timerActive: boolean = false;
  waitingForStart: boolean = false;
  private timerQuestionIndex: number = -1;
  private questionStartTime: number = 0;
  private timerCountdownSub?: Subscription;
  private quizStateUnsub?: () => void;
  private lastQuestionIndex: number = -1;
  private lastStep: QuizStep | null = null;
  userId: string = '';
  userName: string = '';
  step: QuizStep = 'lobby';
  answers: any[] = [];
  personalScore: { good: number, bad: number, none: number } = { good: 0, bad: 0, none: 0 };
  totalScore: number = 0;
  questionResults: { good: number, bad: number, none: number }[] = [];
  answersSub?: Subscription;

  constructor(private quizService: QuizService, private router: Router, private cdr: ChangeDetectorRef) { }

  public get totalQuestions(): number {
    return this.quizService.getQuestions().length;
  }
  get goodAnswersCount(): number {
    return this.questionResults.filter(r => r.good).length;
  }
  get badAnswersCount(): number {
    return this.questionResults.filter(r => r.bad).length;
  }
  getTotalGoodAnswersTime(): number {
    return this.goodAnswersTimes.reduce((sum, t) => sum + t, 0);
  }

  ngOnInit(): void {
    this.avatarUrl = localStorage.getItem('avatarUrl');
    this.quizService.initQuestions();
    this.subscribeAnswers();
    this.quizService.getStep().subscribe((step: QuizStep) => {
      // Éviter les redéclenchements inutiles
      if (this.step === step) {
        return;
      }

      console.log('[STEP] Changement d\'étape de', this.step, 'vers', step);
      this.step = step;
      if (step === 'lobby') {
        this.router.navigate(['/login']);
        this.totalScore = 0;
        this.questionResults = [];
        this.personalScore = { good: 0, bad: 0, none: 0 };
        this.goodAnswersTimes = [];
        this.selectedAnswerIndex = null;
        this.answerSubmitted = false;
        this.quizFinished = false;
      }
      if (step === 'end') {
        this.quizFinished = true;
        this.stopTimer();
      }
      if (step === 'result') {
        this.timerActive = false;
        this.stopTimer();
        this.syncSelectedAnswerFromServer();
      }
      if (step === 'question') {
        this.currentQuestion = this.quizService.getCurrentQuestion(this.currentIndex);

        // FORCER la réinitialisation si on vient de result (question suivante)
        const comingFromResult = this.lastStep === 'result';

        // Une nouvelle question = changement d'index OU transition depuis result/waiting/lobby vers question
        const isNewQuestion = this.lastQuestionIndex !== this.currentIndex ||
                             comingFromResult ||
                             this.lastStep === 'waiting' ||
                             this.lastStep === 'lobby' ||
                             this.lastStep === null;

        if (isNewQuestion || comingFromResult) {
          // Nouvelle question : toujours réinitialiser
          this.answerSubmitted = false;
          this.justSubmitted = false;
          this.selectedAnswerIndex = null;
          this.isAnswerCorrect = null;
          this.lastQuestionIndex = this.currentIndex;

          console.log('[QUESTION] NOUVELLE question détectée - Réinitialisation:', {
            currentIndex: this.currentIndex,
            lastQuestionIndex: this.lastQuestionIndex,
            lastStep: this.lastStep,
            newStep: step,
            comingFromResult,
            answerSubmitted: this.answerSubmitted
          });
        } else {
          // Même question : préserver l'état si réponse soumise
          const shouldPreserveState = this.answerSubmitted && this.selectedAnswerIndex !== null;

          if (!shouldPreserveState) {
            this.answerSubmitted = false;
            this.justSubmitted = false;
            this.selectedAnswerIndex = null;
            this.isAnswerCorrect = null;
          }

          console.log('[QUESTION] Même question - État préservé:', {
            currentIndex: this.currentIndex,
            answerSubmitted: this.answerSubmitted,
            selectedAnswerIndex: this.selectedAnswerIndex
          });
        }

        // Mettre à jour lastStep
        this.lastStep = step;

        // Démarrer le timer seulement si pas déjà actif
        if (!this.timerActive || this.timerQuestionIndex !== this.currentIndex) {
          this.startTimer();
        }
      } else {
        this.stopTimer();
        // Mettre à jour lastStep pour les autres étapes aussi
        this.lastStep = step;
      }
    });
    this.userId = localStorage.getItem('userId') || '';
    this.userName = localStorage.getItem('userName') || '';
    this.quizService.getCurrentIndex().subscribe(idx => {
      // Éviter de redéclencher si même index
      if (this.currentIndex === idx) {
        // Reduced logging to prevent console spam
        if (Math.random() < 0.01) { // Only log 1% of the time
          console.log('[INDEX] Même index, pas de changement nécessaire');
        }
        return;
      }

      console.log('[INDEX] Changement vers nouvelle question - Réinitialisation complète:', {
        oldIndex: this.currentIndex,
        newIndex: idx,
        oldAnswerSubmitted: this.answerSubmitted,
        oldSelectedAnswer: this.selectedAnswerIndex
      });

      this.currentIndex = idx;
      this.currentQuestion = this.quizService.getCurrentQuestion(idx);

      console.log('[INDEX] Question récupérée pour index', idx, ':', {
        question: this.currentQuestion ? {
          id: this.currentQuestion.id,
          text: this.currentQuestion.text.substring(0, 50) + '...'
        } : 'NULL',
        totalQuestions: this.quizService.getQuestions().length
      });

      // Forcer la détection de changement pour l'affichage
      this.cdr.detectChanges();

      // TOUJOURS réinitialiser pour une nouvelle question (changement d'index)
      this.answerSubmitted = false;
      this.justSubmitted = false;
      this.selectedAnswerIndex = null;
      this.isAnswerCorrect = null;

      console.log('[INDEX] Après réinitialisation pour nouvelle question:', {
        currentIndex: this.currentIndex,
        answerSubmitted: this.answerSubmitted,
        selectedAnswerIndex: this.selectedAnswerIndex
      });

      // Si on est dans l'étape question, redémarrer le timer
      if (this.step === 'question') {
        this.startTimer();
      }
    });
    this.totalScore = this.questionResults.reduce((sum, r) => sum + (r?.good || 0), 0);
  }

  private subscribeAnswers() {
    if (this.answersSub) this.answersSub.unsubscribe();
    this.answersSub = this.quizService.getAllAnswersForUser$(this.userId).subscribe(allAnswers => {
      this.answers = allAnswers;
    });
  }

  startTimer() {
    console.log('[TIMER] Démarrage du timer pour question', this.currentIndex);

    // Éviter de redémarrer si déjà actif pour la même question
    if (this.timerActive && this.timerQuestionIndex === this.currentIndex && this.timerCountdownSub) {
      console.log('[TIMER] Timer déjà actif pour cette question, ignorer');
      return;
    }

    this.stopTimer();

    // Initialiser le timer à sa valeur maximale
    this.timerValue = this.timerMax;
    this.timerPercent = 100;
    this.timerActive = true;
    this.timerQuestionIndex = this.currentIndex;

    console.log('[TIMER] Timer initialisé:', {
      timerValue: this.timerValue,
      timerMax: this.timerMax,
      timerActive: this.timerActive
    });

    // Démarrer l'intervalle de décrémentation
    this.timerCountdownSub = interval(1000).subscribe(() => {
      if (this.currentIndex !== this.timerQuestionIndex) {
        console.log('[TIMER] Changement de question détecté, arrêt du timer');
        this.stopTimer();
        return;
      }

      if (this.timerActive) {
        this.updateTimerValue();
      }
    });

    console.log('[TIMER] Timer démarré avec interval de 1000ms');
  }

  stopTimer() {
    if (this.timerCountdownSub) {
      this.timerCountdownSub.unsubscribe();
      this.timerCountdownSub = undefined;
    }
  }

  selectAnswer(index: number) {
    console.log('[SELECT] Tentative de sélection:', {
      index,
      timerActive: this.timerActive,
      answerSubmitted: this.answerSubmitted,
      currentIndex: this.currentIndex,
      step: this.step
    });

    if (!this.timerActive || this.answerSubmitted) {
      console.log('[SELECT] Sélection bloquée - timerActive:', this.timerActive, 'answerSubmitted:', this.answerSubmitted);
      return;
    }

    console.log('[SELECT] Sélection de la réponse:', index);
    this.selectedAnswerIndex = index;
    this.isAnswerCorrect = this.currentQuestion?.correctIndex === index;

    // Laisser la réponse visuellement sélectionnée avant de soumettre
    setTimeout(() => {
      this.submitAnswer(index);
    }, 100);
  }

  ngOnDestroy(): void {
    if (this.quizStateUnsub) this.quizStateUnsub();
    this.stopTimer();
  }

  async submitAnswer(answerIndex: number) {
    if (this.answerSubmitted) {
      console.log('[DEBUG] Tentative de soumission multiple bloquée');
      return; // Empêche les soumissions multiples
    }

    console.log('[DEBUG] Soumission de la réponse', answerIndex);
    this.answerSubmitted = true;
    this.justSubmitted = true;

    try {
      await this.quizService.submitAnswer(this.userId, answerIndex, this.userName, this.currentIndex);
      console.log('[DEBUG] Réponse soumise avec succès - selectedAnswerIndex conservé:', this.selectedAnswerIndex);
    } catch (error) {
      console.error('[DEBUG] Erreur lors de la soumission:', error);
      // En cas d'erreur, permettre une nouvelle tentative mais conserver la sélection
      this.answerSubmitted = false;
      return;
    }

    // Removed redundant getAnswers$ subscription that was causing console spam

    if (
      this.currentQuestion &&
      answerIndex === this.currentQuestion.correctIndex &&
      this.questionStartTime > 0
    ) {
      // ... logique de calcul du temps ...
    }

    if (this.currentQuestion) {
      let result;
      if (answerIndex === this.currentQuestion.correctIndex) {
        result = { good: 1, bad: 0, none: 0 };
      } else if (answerIndex === -1) {
        result = { good: 0, bad: 0, none: 1 };
      } else {
        result = { good: 0, bad: 1, none: 0 };
      }
      const updatedResults = [...this.questionResults];
      updatedResults[this.currentIndex] = result;
      this.questionResults = updatedResults;
      this.totalScore = this.questionResults.reduce((sum, r) => sum + (r?.good || 0), 0);
      this.personalScore = result;
    }
  }

  nextQuestion() {
    if (this.currentIndex >= (this.questionResults.length - 1)) {
      this.quizFinished = true;
    }
  }

  fetchQuestionStartTime(idx: number): Promise<void> {
    console.log('[SYNC] Début fetchQuestionStartTime pour question', idx);
    return fetch(`${environment.apiUrl.replace('/api', '')}/api/quiz-state`)
      .then((response) => response.json())
      .then((data) => {
        console.log('[SYNC] fetchQuestionStartTime - Réponse serveur:', data);
        const now = Date.now();

        // Synchronisation stricte : récupération du timerMax si disponible
        if (data && typeof data.timerMax !== 'undefined' && data.timerMax > 0) {
          this.timerMax = data.timerMax;
          console.log('[SYNC] timerMax serveur utilisé:', this.timerMax);
        } else {
          this.timerMax = 15;
          console.log('[SYNC] timerMax par défaut utilisé:', this.timerMax);
        }

        if (data && typeof data.questionStartTime !== 'undefined') {
          if (data.questionStartTime > 0) {
            this.questionStartTime = data.questionStartTime;
            console.log('[SYNC] Timestamp serveur utilisé:', this.questionStartTime);

            // Compensation : si le timer démarre avec >2s de retard, on recale à timerMax
            const elapsed = Math.floor((now - this.questionStartTime) / 1000);
            if (elapsed > 2) {
              console.warn('[SYNC][COMPENSATION] Timer joueur recalé à timerMax (retard détecté)', {elapsed, timerMax: this.timerMax});
              this.questionStartTime = now;
              // Ne pas redémarrer le timer ici, on laisse la logique normale s'en charger
            }
          } else {
            this.questionStartTime = now;
            console.log('[SYNC] Timestamp local utilisé (serveur <= 0):', this.questionStartTime);
          }
        } else {
          this.questionStartTime = now;
          console.log('[SYNC] Timestamp local utilisé (pas de questionStartTime):', this.questionStartTime);
        }

        // Mise à jour immédiate du timer après synchronisation
        this.updateTimerValue();
        console.log('[SYNC] Synchronisation terminée, timer mis à jour');
      })
      .catch((e: unknown) => {
        this.questionStartTime = Date.now();
        this.timerMax = 15;
        console.log('[SYNC] Erreur fetch, timestamp local utilisé:', this.questionStartTime, e);
        this.updateTimerValue();
      });
  }
}
// Fin de la classe QuizComponent
