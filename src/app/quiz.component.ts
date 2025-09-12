import { User } from './models/user.model';
import { Component, OnInit } from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { Question } from './question.model';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { QuizService, QuizStep } from './services/quiz.service';
// import { TimerService } from './services/timer.service';

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quiz.component.html',
  styleUrls: ['./quiz.component.css']
})
export class QuizComponent implements OnInit {
  // ...
  // Ajout pour accès public dans le template
  public get totalQuestions(): number {
    return this.quizService.getQuestions().length;
  }
  leaderboard: User[] = [];
  avatarUrl: string | null = null;
  // Stocke le temps de chaque bonne réponse (en secondes)
  goodAnswersTimes: number[] = [];
  get goodAnswersCount(): number {
    return this.questionResults.filter(r => r.good).length;
  }

  get badAnswersCount(): number {
    return this.questionResults.filter(r => r.bad).length;
  }
  // Retourne le temps total des bonnes réponses
  getTotalGoodAnswersTime(): number {
    return this.goodAnswersTimes.reduce((sum, t) => sum + t, 0);
  }
  private answerSubmitted = false;
  currentIndex: number = 0;
  currentQuestion: Question | null = null;
  selectedAnswerIndex: number | null = null;
  isAnswerCorrect: boolean | null = null;
  quizFinished = false;
  timerValue: number = 20;
  timerMax: number = 20; // Durée du timer en secondes, pour la barre animée
  timerPercent: number = 100;
  timerActive: boolean = false;
  waitingForStart: boolean = false;
  private timerQuestionIndex: number = -1;
  private questionStartTime: number = 0;
  private timerCountdownSub?: Subscription;
  private quizStateUnsub?: () => void;
  userId: string = '';
  userName: string = '';
  step: QuizStep = 'lobby';
  answers: any[] = [];
  personalScore: { good: number, bad: number, none: number } = { good: 0, bad: 0, none: 0 };
  totalScore: number = 0;
  questionResults: { good: number, bad: number, none: number }[] = [];
  answersSub?: Subscription;
  timerInterval?: any;

  constructor(private quizService: QuizService, private router: Router) { }

  ngOnInit(): void {
    // Classement final : synchro temps réel
    this.quizService.getParticipants$().subscribe(participants => {
      // On recalcule dynamiquement le score de chaque participant à partir de ses réponses Firestore
      this.quizService.getAllAnswers$().subscribe((allAnswersDocs: any[]) => {
        const nbQuestions = this.totalQuestions;
        const leaderboard = participants.map(user => {
          let score = 0;
          for (let i = 0; i < nbQuestions; i++) {
            const doc = allAnswersDocs.find((d: any) => String(d.id) === String(i));
            if (doc && doc.answers) {
              const answer = doc.answers.find((a: any) => String(a.userId) === String(user.id));
              if (answer && typeof answer.answerIndex !== 'undefined') {
                const question = this.quizService.getCurrentQuestion(i);
                if (question && answer.answerIndex === question.correctIndex) {
                  score++;
                }
              }
            }
          }
          return { ...user, score };
        });
        this.leaderboard = leaderboard.sort((a, b) => b.score - a.score);
      });
    });
    this.avatarUrl = localStorage.getItem('avatarUrl');
    // Correction AngularFire : initialisation explicite des questions
    this.quizService.initQuestions();

    // Abonnement à la liste des questions pour garantir la synchro
    this.quizService.questions$.subscribe(questions => {
      // Si la liste des questions change, on met à jour la question courante
      console.log('[DEBUG][QUESTIONS]', questions, 'currentIndex:', this.currentIndex);
      this.currentQuestion = this.quizService.getCurrentQuestion(this.currentIndex);
      console.log('[DEBUG][CURRENT_QUESTION]', this.currentQuestion);
    });

    this.quizService.getStep().subscribe((step: QuizStep) => {
      console.log('[DEBUG][QUIZ][STEP] step:', step, '| currentIndex:', this.currentIndex);
      this.step = step;
      if (step === 'lobby') {
        this.router.navigate(['/login']);
      }
      if (step === 'end') {
        this.quizFinished = true;
        this.stopTimer();
      }
      if (step === 'result') {
        this.timerActive = false;
        this.stopTimer();
        // À l'étape résultat, on force la synchro de l'index sélectionné avec la réponse Firestore
        const currentAnswer = this.questionResults[this.currentIndex]?.good || this.questionResults[this.currentIndex]?.bad
          ? this.quizService.getAllAnswersForUser$(this.userId)
              .subscribe(allAnswers => {
                const entry = allAnswers[this.currentIndex];
                if (entry && entry.answer) {
                  this.selectedAnswerIndex = entry.answer.answerIndex;
                } else {
                  this.selectedAnswerIndex = null;
                }
              })
          : this.selectedAnswerIndex = null;
      }
      if (step === 'question') {
        this.currentQuestion = this.quizService.getCurrentQuestion(this.currentIndex);
        this.answerSubmitted = false; // Correction : autorise la soumission à chaque nouvelle question
        this.startTimer();
      } else {
        this.stopTimer();
      }
    });
    this.userId = localStorage.getItem('userId') || '';
    this.userName = localStorage.getItem('userName') || '';
    this.quizService.getCurrentIndex().subscribe(idx => {
      console.log('[DEBUG][QUIZ][INDEX] currentIndex reçu:', idx);
      this.currentIndex = idx;
      this.currentQuestion = this.quizService.getCurrentQuestion(idx);
      this.answerSubmitted = false;
      this.selectedAnswerIndex = null;
      this.questionStartTime = 0;
      this.listenToQuestionStartTime(idx);
    });
    // Nouvelle logique : score réactif sur toutes les réponses du joueur
    if (this.answersSub) this.answersSub.unsubscribe();
    this.answersSub = this.quizService.getAllAnswersForUser$(this.userId).subscribe(allAnswers => {
      const debugEntry = allAnswers[this.currentIndex];
      console.log('[DEBUG][JOUEUR] userId:', this.userId, 'allAnswers:', allAnswers, 'currentIndex:', this.currentIndex, 'entry:', debugEntry);
      // allAnswers = [{index, answer}...]
      if (!this.quizService['questions'] || this.quizService['questions'].length === 0) {
        return;
      }
      this.questionResults = allAnswers.map((entry, i) => {
        const currentQ = this.quizService.getCurrentQuestion(i);
        const myAnswer = entry.answer;
        let result = { good: 0, bad: 0, none: 0 };
        if (myAnswer && currentQ) {
          console.log('[DEBUG][SCORE] i:', i, 'answerIndex:', myAnswer.answerIndex, 'correctIndex:', currentQ.correctIndex, 'userId:', this.userId);
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
      // Score de la question courante
      this.personalScore = this.questionResults[this.currentIndex] || { good: 0, bad: 0, none: 0 };
      // Met à jour l'index sélectionné à partir de la réponse Firestore (jamais du clic local)
      const entry = allAnswers[this.currentIndex];
      if (entry && entry.answer && typeof entry.answer.answerIndex !== 'undefined') {
        this.selectedAnswerIndex = entry.answer.answerIndex;
      } else {
        this.selectedAnswerIndex = null;
      }
      // Score total
      this.totalScore = this.questionResults.reduce((sum, r) => sum + (r?.good || 0), 0);
    });
  }


  /** Abonnement temps réel au timestamp de début de question dans Firestore */
  async listenToQuestionStartTime(idx: number) {
    if (this.quizStateUnsub) this.quizStateUnsub();
    const { doc, onSnapshot } = await import('firebase/firestore');
    const quizStateDoc = doc(this.quizService['firestore'], 'quizState/main');
    this.quizStateUnsub = onSnapshot(quizStateDoc, (snap: any) => {
      const data = snap.data();
      let newStartTime = 0;
      if (data && data['questionStartTimes']) {
        newStartTime = data['questionStartTimes'][String(idx)] || 0;
      } else if (data && typeof data['questionStartTime'] !== 'undefined') {
        newStartTime = data['questionStartTime'];
      }
      this.questionStartTime = newStartTime;
      this.startTimer();
    });
  }

  private updateTimerValue() {
    const now = Date.now();
    if (!this.questionStartTime || this.questionStartTime <= 0) {
      this.waitingForStart = true;
      this.timerValue = null as any;
      console.log('[DEBUG][QUIZ][TIMER] WAITING | currentIndex:', this.currentIndex, '| questionStartTime:', this.questionStartTime, '| now:', now);
      return;
    }
    this.waitingForStart = false;
    const elapsed = Math.floor((now - this.questionStartTime) / 1000);
    this.timerValue = Math.max(this.timerMax - elapsed, 0);
    this.timerPercent = (this.timerValue / this.timerMax) * 100;
    this.timerActive = this.timerValue > 0;
    console.log('[DEBUG][QUIZ][TIMER] TICK | currentIndex:', this.currentIndex, '| questionStartTime:', this.questionStartTime, '| now:', now, '| timerValue:', this.timerValue);
    if (this.timerValue <= 0) {
      this.timerActive = false;
      this.stopTimer();
      if (!this.answerSubmitted && this.step === 'question') {
        this.submitAnswer(-1);
      }
    }
  }

  startTimer() {
    this.stopTimer();
    this.timerQuestionIndex = this.currentIndex;
    this.updateTimerValue();
    this.timerCountdownSub = interval(1000).subscribe(() => {
      if (this.currentIndex !== this.timerQuestionIndex) {
        this.timerQuestionIndex = this.currentIndex;
        this.updateTimerValue();
      } else {
        this.updateTimerValue();
      }
    });
  }

  stopTimer() {
    if (this.timerCountdownSub) {
      this.timerCountdownSub.unsubscribe();
      this.timerCountdownSub = undefined;
    }
  }

  // Ancienne méthode startTimer supprimée (remplacée par la logique Firestore)

  selectAnswer(index: number) {
    console.log('[DEBUG][QUIZ][selectAnswer] userId:', this.userId, 'index:', index, 'timerActive:', this.timerActive, 'answerSubmitted:', this.answerSubmitted);
    if (!this.timerActive || this.answerSubmitted) return;
    this.selectedAnswerIndex = index;
    this.isAnswerCorrect = this.currentQuestion?.correctIndex === index;
    this.timerActive = false;
    this.answerSubmitted = true;
    this.submitAnswer(index);
  }
  ngOnDestroy(): void {
    if (this.quizStateUnsub) this.quizStateUnsub();
    this.stopTimer();
  }

  async submitAnswer(answerIndex: number) {
    // answerIndex = -1 si non-réponse
    this.answerSubmitted = true;
    await this.quizService.submitAnswer(this.userId, answerIndex, this.userName, this.currentIndex);
    // Calcul du temps de réponse uniquement si bonne réponse
    if (
      this.currentQuestion &&
      answerIndex === this.currentQuestion.correctIndex &&
      this.questionStartTime > 0
    ) {
      const now = Date.now();
      const timeTaken = Math.floor((now - this.questionStartTime) / 1000);
      // On stocke le temps pour cette question (index = currentIndex)
      this.goodAnswersTimes[this.currentIndex] = timeTaken;
    } else {
      // Si mauvaise réponse ou non-réponse, on ne stocke rien
      this.goodAnswersTimes[this.currentIndex] = undefined as any;
    }
    // Le score sera mis à jour automatiquement par la souscription réactive dans ngOnInit
  }

  // La méthode loadPersonalScore n'est plus utilisée (remplacée par la souscription réactive)

  nextQuestion() {
    // Côté joueur, la navigation se fait via la synchro Firestore (admin)
    // On ne fait rien ici, sauf marquer la fin du quiz si besoin
    if (this.currentIndex >= (this.questionResults.length - 1)) {
      this.quizFinished = true;
    }
    // Optionnel : reset du timer de bonne réponse pour la prochaine question
    // this.goodAnswersTimes[this.currentIndex + 1] = undefined as any;
  }
}
