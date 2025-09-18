
import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { QuizService, QuizStep } from '../services/quiz-secure.service';
import { User } from '../models/user.model';
import { TimerService } from '../services/timer.service';
import { Subscription, interval } from 'rxjs';
import { CommonModule } from '@angular/common';

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
  leaderboard: User[] = [];
  personalScore: { good: number, bad: number, none: number } = { good: 0, bad: 0, none: 0 };
  questionResults: { good: number, bad: number, none: number }[] = [];
  currentIndex: number = 0;
  answersSub?: Subscription;
  currentQuestion: any = null;
  timerValue: number = 15;
  timerMax: number = 15; // Durée du timer en secondes, synchronisée avec timerValue
  hasAnswered: boolean = false;

  constructor(private quizService: QuizService, private timerService: TimerService) {}

  ngOnInit(): void {
    this.userId = localStorage.getItem('userId') || '';
    this.userName = localStorage.getItem('userName') || '';
    this.avatarUrl = localStorage.getItem('avatarUrl');
    this.totalQuestions = this.quizService.getQuestions().length;

    this.quizService.getStep().subscribe((step: QuizStep) => {
      console.log('[DEBUG][PARTICIPANT][STEP] step:', step, '| currentIndex:', this.currentIndex);
      this.step = step;
      if (step === 'question') {
        this.currentQuestion = this.quizService.getCurrentQuestion(this.currentIndex);
        console.log('[DEBUG][PARTICIPANT][STEP] startTimer() called');
        // Synchronisation forcée du timestamp à chaque passage à l'étape question
        this.fetchQuestionStartTime(this.currentIndex).then(() => {
          console.log('[DEBUG][PARTICIPANT][STEP] questionStartTime après fetch:', this.questionStartTime);
          this.startTimer();
        });
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
      this.questionStartTime = 0; // Force la réinitialisation du timer
      // Synchronisation forcée du timestamp à chaque changement d'index si on est sur une question
      if (this.step === 'question') {
        this.fetchQuestionStartTime(idx).then(() => {
          console.log('[DEBUG][PARTICIPANT][INDEX] questionStartTime après fetch:', this.questionStartTime);
          this.startTimer();
        });
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
    this.updateTimerValue();
    this.timerCountdownSub = interval(1000).subscribe(() => {
      // Si l'index de question a changé, on relance le timer
      if (this.currentIndex !== this.timerQuestionIndex) {
        this.timerQuestionIndex = this.currentIndex;
        this.updateTimerValue();
      } else {
        this.updateTimerValue();
      }
    });
  }

  /** Abonnement temps réel au timestamp de début de question via API SQLite */
  async listenToQuestionStartTime(idx: number) {
    if (this.quizStateUnsub) this.quizStateUnsub();
    
    console.log('[INFO] Listening to question start time for index:', idx);
    console.log('[DEBUG][LISTEN] FINAL FIX - Appel fetchQuestionStartTime...');
    // Appel immédiat pour récupérer le timestamp
    try {
      await this.fetchQuestionStartTime(idx);
      console.log('[DEBUG][LISTEN] fetchQuestionStartTime terminé avec succès');
    } catch (e) {
      console.error('[ERROR][LISTEN] Échec fetchQuestionStartTime:', e);
    }
  }

  private updateTimerValue() {
    const now = Date.now();
    if (!this.questionStartTime || this.questionStartTime <= 0) {
      this.waitingForStart = true;
      this.timerValue = null as any;
      console.log('[DEBUG][PARTICIPANT][TIMER] WAITING | currentIndex:', this.currentIndex, '| questionStartTime:', this.questionStartTime, '| now:', now);
      return;
    }
    this.waitingForStart = false;
    const elapsed = Math.floor((now - this.questionStartTime) / 1000);
    this.timerValue = Math.max(15 - elapsed, 0);
    this.timerMax = 15;
    console.log('[DEBUG][PARTICIPANT][TIMER] TICK | currentIndex:', this.currentIndex, '| questionStartTime:', this.questionStartTime, '| now:', now, '| timerValue:', this.timerValue, '| waitingForStart:', this.waitingForStart);
    if (this.timerValue <= 0) {
      this.hasAnswered = true;
      this.stopTimer();
    }
  }

  /** Récupère le timestamp de début de la question courante via l'API */
  async fetchQuestionStartTime(idx: number) {
    console.log('[DEBUG][FETCH] Début fetchQuestionStartTime pour index:', idx);
    try {
      // Récupération du timestamp via l'API HTTP
      console.log('[DEBUG][FETCH] Appel API http://localhost:3000/api/quiz-state pour index:', idx);
      const response = await fetch('http://localhost:3000/api/quiz-state');
      console.log('[DEBUG][FETCH] Réponse reçue, status:', response.status);
      const data = await response.json();
      console.log('[DEBUG][FETCH] Data parsée:', data);
      if (data && typeof data.questionStartTime !== 'undefined') {
        console.log('[DEBUG][PARTICIPANT][API] questionStartTime reçu du serveur:', data.questionStartTime);
        if (data.questionStartTime > 0) {
          this.questionStartTime = data.questionStartTime;
          console.log('[DEBUG][PARTICIPANT][API] questionStartTime utilisé:', this.questionStartTime, '- Now:', Date.now());
        } else {
          this.questionStartTime = Date.now();
          console.log('[DEBUG][PARTICIPANT][API] Pas de timestamp serveur (>0), utilisation de maintenant:', this.questionStartTime);
        }
        this.updateTimerValue();
      } else {
        // Si pas de timestamp, utiliser le timestamp actuel
        this.questionStartTime = Date.now();
        console.log('[DEBUG][PARTICIPANT][API] Pas de champ questionStartTime, utilisation de maintenant:', this.questionStartTime);
        this.updateTimerValue();
      }
    } catch (e) {
      console.error('[ERROR][FETCH] Erreur récupération questionStartTime:', e);
      // En cas d'erreur, utiliser le timestamp actuel pour débloquer
      this.questionStartTime = Date.now();
      this.updateTimerValue();
    }
  }

  stopTimer() {
    if (this.timerCountdownSub) {
      this.timerCountdownSub.unsubscribe();
      this.timerCountdownSub = undefined;
    }
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
