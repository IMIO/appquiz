import { User } from './models/user.model';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Subscription, interval, take } from 'rxjs';
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
    // Ne pas écraser l'état restauré 
    const savedData = localStorage.getItem(this.PLAYER_STATE_KEY);
    if (savedData) {
      try {
        const playerState = JSON.parse(savedData);
        if (playerState.currentIndex === this.currentIndex && playerState.answerSubmitted) {
          console.log('[SYNC] État restauré préservé, pas de synchronisation serveur');
          return;
        }
      } catch (error) {
        console.error('[SYNC] Erreur lecture état pour sync:', error);
      }
    }
    
    // TODO: Logique de synchronisation avec le serveur si nécessaire
    console.log('[SYNC] Synchronisation avec serveur (pas d\'état restauré)');
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

  // Clé de stockage pour l'état du joueur
  private readonly PLAYER_STATE_KEY = 'quiz_player_state';

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

  /**
   * Sauvegarder l'état du joueur dans localStorage
   */
  private savePlayerState(): void {
    try {
      const playerState = {
        totalScore: this.totalScore,
        questionResults: this.questionResults,
        goodAnswersTimes: this.goodAnswersTimes,
        currentIndex: this.currentIndex,
        timerQuestionIndex: this.timerQuestionIndex,
        questionStartTime: this.questionStartTime,
        answerSubmitted: this.answerSubmitted,
        selectedAnswerIndex: this.selectedAnswerIndex,
        isAnswerCorrect: this.isAnswerCorrect,
        step: this.step,
        answers: this.answers,
        personalScore: this.personalScore,
        lastActivity: Date.now()
      };
      
      localStorage.setItem(this.PLAYER_STATE_KEY, JSON.stringify(playerState));
      console.log('[PLAYER-STATE] État sauvegardé:', playerState);
    } catch (error) {
      console.error('[PLAYER-STATE] Erreur sauvegarde:', error);
    }
  }

  /**
   * Restaurer l'état du joueur depuis localStorage
   */
  private restorePlayerState(): boolean {
    try {
      const savedData = localStorage.getItem(this.PLAYER_STATE_KEY);
      if (!savedData) return false;

      const playerState = JSON.parse(savedData);
      
      // Vérifier que la sauvegarde n'est pas trop ancienne (30 minutes)
      const maxAge = 30 * 60 * 1000;
      const age = Date.now() - (playerState.lastActivity || 0);
      if (age > maxAge) {
        console.log('[PLAYER-STATE] Sauvegarde trop ancienne, suppression');
        localStorage.removeItem(this.PLAYER_STATE_KEY);
        return false;
      }

      // Restaurer les données importantes
      this.questionResults = playerState.questionResults || [];
      this.goodAnswersTimes = playerState.goodAnswersTimes || [];
      this.currentIndex = playerState.currentIndex || 0;
      this.timerQuestionIndex = playerState.timerQuestionIndex || -1;
      this.questionStartTime = playerState.questionStartTime || 0;
      this.answerSubmitted = playerState.answerSubmitted || false;
      this.selectedAnswerIndex = playerState.selectedAnswerIndex;
      this.isAnswerCorrect = playerState.isAnswerCorrect;
      this.answers = playerState.answers || [];
      this.personalScore = playerState.personalScore || { good: 0, bad: 0, none: 0 };

      // Recalculer le score total à partir des résultats restaurés
      this.totalScore = this.questionResults.reduce((sum, r) => sum + (r?.good || 0), 0);

      console.log('[PLAYER-STATE] État restauré:', {
        totalScore: this.totalScore,
        questionResults: this.questionResults.length,
        questionResultsData: this.questionResults,
        currentIndex: this.currentIndex,
        answerSubmitted: this.answerSubmitted,
        selectedAnswerIndex: this.selectedAnswerIndex
      });

      return true;
    } catch (error) {
      console.error('[PLAYER-STATE] Erreur restauration:', error);
      localStorage.removeItem(this.PLAYER_STATE_KEY);
      return false;
    }
  }

  /**
   * Calculer le temps de timer restant en fonction du temps du serveur
   */
  private calculateSyncedTimer(): void {
    if (this.questionStartTime && this.step === 'question') {
      const elapsed = Date.now() - this.questionStartTime;
      const maxTime = this.timerMax * 1000;
      const remaining = Math.max(0, maxTime - elapsed);
      
      this.timerValue = Math.ceil(remaining / 1000);
      this.timerPercent = (remaining / maxTime) * 100;
      
      console.log('[TIMER-SYNC] Timer synchronisé:', {
        elapsed: elapsed,
        remaining: remaining,
        timerValue: this.timerValue,
        timerPercent: this.timerPercent
      });
    }
  }

  ngOnInit(): void {
    this.avatarUrl = localStorage.getItem('avatarUrl');
    this.quizService.initQuestions();
    
    // Restaurer l'état du joueur s'il existe
    const stateRestored = this.restorePlayerState();
    if (stateRestored) {
      console.log('[PLAYER-STATE] État restauré avec succès au démarrage');
    }
    
    this.subscribeAnswers();
    
    // Détecter les resets complets par disparition des participants (VERSION RENFORCÉE)
    let lastParticipantCount = 0;
    let hasSeenParticipants = false; // S'assurer qu'on a vu des participants avant
    
    this.quizService.getParticipants$().subscribe((participants: User[]) => {
      const userId = localStorage.getItem('userId');
      
      // Marquer qu'on a vu des participants (seulement si > 0)
      if (participants.length > 0) {
        hasSeenParticipants = true;
      }
      
      // Détecter reset SEULEMENT si on a vu des participants ET qu'ils disparaissent tous
      if (hasSeenParticipants && lastParticipantCount > 0 && participants.length === 0 && userId) {
        console.log('[QUIZ] 🔄 Reset complet potentiel détecté (participants: ' + lastParticipantCount + ' → 0)');
        
        // Délai de confirmation pour éviter les faux positifs
        setTimeout(() => {
          this.quizService.getParticipants$().pipe(take(1)).subscribe((recheck: User[]) => {
            if (recheck.length === 0) {
              console.log('[QUIZ] 🔄 Reset confirmé après délai, redirection vers login');
              localStorage.removeItem('userId');
              localStorage.removeItem('userName');
              localStorage.removeItem('avatarUrl');
              localStorage.removeItem(this.PLAYER_STATE_KEY); // Nettoyer l'état du joueur
              this.router.navigate(['/login']);
            } else {
              console.log('[QUIZ] ℹ️ Fausse alerte reset, participants revenus:', recheck.length);
            }
          });
        }, 2000); // 2 secondes de délai de confirmation
        return;
      }
      
      lastParticipantCount = participants.length;
    });
    
    this.quizService.getStep().subscribe((step: QuizStep) => {
      // Éviter les redéclenchements inutiles
      if (this.step === step) {
        return;
      }

      console.log('[STEP] Changement d\'étape de', this.step, 'vers', step);
      this.step = step;
      if (step === 'lobby') {
        console.log('[QUIZ] Reset détecté, nettoyage et redirection vers login');
        
        // Nettoyer le localStorage
        localStorage.removeItem('userId');
        localStorage.removeItem('userName');
        localStorage.removeItem('avatarUrl');
        localStorage.removeItem(this.PLAYER_STATE_KEY); // Nettoyer l'état du joueur
        
        // Nettoyer les données locales et rediriger
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

        // Vérifier si on a un état restauré pour cette question
        const savedData = localStorage.getItem(this.PLAYER_STATE_KEY);
        let hasRestoredState = false;
        
        if (savedData) {
          try {
            const playerState = JSON.parse(savedData);
            hasRestoredState = playerState.currentIndex === this.currentIndex && playerState.answerSubmitted;
          } catch (error) {
            console.error('[QUESTION] Erreur lecture état:', error);
          }
        }

        if ((isNewQuestion || comingFromResult) && !hasRestoredState) {
          // Nouvelle question : réinitialiser seulement si pas d'état restauré
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
          // Même question OU état restauré : préserver l'état
          const shouldPreserveState = this.answerSubmitted && this.selectedAnswerIndex !== null;

          if (!shouldPreserveState && !hasRestoredState) {
            this.answerSubmitted = false;
            this.justSubmitted = false;
            this.selectedAnswerIndex = null;
            this.isAnswerCorrect = null;
          }

          console.log('[QUESTION] État préservé (même question ou restauré):', {
            currentIndex: this.currentIndex,
            answerSubmitted: this.answerSubmitted,
            selectedAnswerIndex: this.selectedAnswerIndex,
            hasRestoredState
          });
        }

        // Mettre à jour lastStep
        this.lastStep = step;

        // Démarrer le timer seulement si pas déjà actif
        if (!this.timerActive || this.timerQuestionIndex !== this.currentIndex) {
          this.startTimer();
        }
        
        // Sauvegarder l'état après changement d'étape
        this.savePlayerState();
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

      // Réinitialiser SEULEMENT si pas d'état restauré pour cette question
      const savedData = localStorage.getItem(this.PLAYER_STATE_KEY);
      let shouldResetAnswer = true;
      
      if (savedData) {
        try {
          const playerState = JSON.parse(savedData);
          // Ne pas réinitialiser si on a une réponse sauvegardée pour cette question
          if (playerState.currentIndex === idx && playerState.answerSubmitted) {
            shouldResetAnswer = false;
            console.log('[INDEX] État restauré préservé pour question', idx);
          }
        } catch (error) {
          console.error('[INDEX] Erreur lecture état sauvegardé:', error);
        }
      }
      
      if (shouldResetAnswer) {
        this.answerSubmitted = false;
        this.justSubmitted = false;
        this.selectedAnswerIndex = null;
        this.isAnswerCorrect = null;
        console.log('[INDEX] Réinitialisation pour nouvelle question:', idx);
      } else {
        console.log('[INDEX] État préservé pour question avec réponse:', {
          currentIndex: this.currentIndex,
          answerSubmitted: this.answerSubmitted,
          selectedAnswerIndex: this.selectedAnswerIndex
        });
      }

      // Si on est dans l'étape question, redémarrer le timer
      if (this.step === 'question') {
        this.startTimer();
      }
      
      // Sauvegarder l'état après changement d'index
      this.savePlayerState();
    });
    
    // Recalculer le score total seulement si pas d'état restauré
    if (!stateRestored) {
      this.totalScore = this.questionResults.reduce((sum, r) => sum + (r?.good || 0), 0);
    }
  }

  private subscribeAnswers() {
    if (this.answersSub) this.answersSub.unsubscribe();
    this.answersSub = this.quizService.getAllAnswersForUser$(this.userId).subscribe(allAnswers => {
      this.answers = allAnswers;
    });
  }

  startTimer() {
    console.log('[TIMER] Démarrage timer pour question', this.currentIndex);

    // Éviter de redémarrer si déjà actif pour la même question
    if (this.timerActive && this.timerQuestionIndex === this.currentIndex && this.timerCountdownSub) {
      console.log('[TIMER] Timer déjà actif pour cette question, ignorer');
      return;
    }

    this.stopTimer();

    // Marquer le temps de début de la question (pour synchronisation)
    this.questionStartTime = Date.now();
    
    // Si on a une sauvegarde récente, ajuster le temps de début
    const savedData = localStorage.getItem(this.PLAYER_STATE_KEY);
    if (savedData) {
      try {
        const playerState = JSON.parse(savedData);
        if (playerState.questionStartTime && playerState.timerQuestionIndex === this.currentIndex) {
          // Utiliser le temps de début sauvegardé pour rester synchronisé
          this.questionStartTime = playerState.questionStartTime;
        }
      } catch (error) {
        console.error('[TIMER] Erreur lors de la synchronisation:', error);
      }
    }

    // Initialiser le timer à sa valeur maximale
    this.timerValue = this.timerMax;
    this.timerPercent = 100;
    this.timerActive = true;
    this.timerQuestionIndex = this.currentIndex;

    // Calculer le timer synchronisé immédiatement
    this.calculateSyncedTimer();

    console.log('[TIMER] Timer initialisé:', {
      timerValue: this.timerValue,
      timerMax: this.timerMax,
      timerActive: this.timerActive,
      questionStartTime: this.questionStartTime
    });

    // Démarrer l'intervalle de décrémentation
    this.timerCountdownSub = interval(1000).subscribe(() => {
      if (this.currentIndex !== this.timerQuestionIndex) {
        console.log('[TIMER] Changement de question détecté, arrêt du timer');
        this.stopTimer();
        return;
      }

      if (this.timerActive) {
        this.calculateSyncedTimer(); // Utiliser la synchronisation au lieu d'updateTimerValue
      }
    });

    console.log('[TIMER] Timer démarré avec interval de 1000ms et synchronisation');
    
    // Sauvegarder l'état après démarrage du timer
    this.savePlayerState();
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

    // Sauvegarder l'état après sélection
    this.savePlayerState();

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
      
      // Sauvegarder l'état après soumission de la réponse
      this.savePlayerState();
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
