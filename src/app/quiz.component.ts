import { User } from './models/user.model';
import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Question } from './question.model';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { QuizService, QuizStep } from './services/quiz.service';
import { TimerService } from './services/timer.service';

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
  get goodAnswersCount(): number {
    return this.questionResults.filter(r => r.good).length;
  }

  get badAnswersCount(): number {
    return this.questionResults.filter(r => r.bad).length;
  }
  private answerSubmitted = false;
  currentIndex: number = 0;
  currentQuestion: Question | null = null;
  selectedAnswerIndex: number | null = null;
  isAnswerCorrect: boolean | null = null;
  quizFinished = false;
  timer: number = 15;
  timerPercent: number = 100;
  timerActive: boolean = false;
  userId: string = '';
  userName: string = '';
  step: QuizStep = 'lobby';
  answers: any[] = [];
  personalScore: { good: number, bad: number, none: number } = { good: 0, bad: 0, none: 0 };
  totalScore: number = 0;
  questionResults: { good: number, bad: number, none: number }[] = [];
  answersSub?: Subscription;
  timerInterval?: any;

  constructor(private quizService: QuizService, private router: Router, private timerService: TimerService) { }

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
      this.step = step;
      if (step === 'lobby') {
        this.router.navigate(['/login']);
      }
      if (step === 'end') {
        this.quizFinished = true;
      }
      if (step === 'result') {
        this.timerActive = false;
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
      // Ajout : timer synchrone sur questionStartTime
      if (step === 'question') {
        this.syncTimerWithFirestore();
      }
    });
    this.userId = localStorage.getItem('userId') || '';
    this.userName = localStorage.getItem('userName') || '';
    this.quizService.getCurrentIndex().subscribe(idx => {
      this.currentIndex = idx;
      this.currentQuestion = this.quizService.getCurrentQuestion(idx);
      this.answerSubmitted = false; // Réinitialise answerSubmitted à chaque nouvelle question
      this.selectedAnswerIndex = null; // Réinitialise aussi l'index sélectionné
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
        this.selectedAnswerIndex = -1;
      }
      // Score total
      this.totalScore = this.questionResults.reduce((sum, r) => sum + (r?.good || 0), 0);
    });
  }

  // Timer synchrone basé sur Firestore
  async syncTimerWithFirestore() {
    const { doc, onSnapshot } = await import('firebase/firestore');
    const quizStateDoc = doc(this.quizService['firestore'], 'quizState/main');
    onSnapshot(quizStateDoc, (snap: any) => {
      const data = snap.data();
      if (data && data.questionStartTime) {
        const now = Date.now();
        const elapsed = Math.floor((now - data.questionStartTime) / 1000);
        const duration = 15;
        const remaining = Math.max(0, duration - elapsed);
        this.timer = remaining;
        this.timerPercent = (remaining / duration) * 100;
        this.timerActive = remaining > 0;
        if (this.timerInterval) clearInterval(this.timerInterval);
        if (remaining > 0) {
          this.timerInterval = setInterval(() => {
            const now2 = Date.now();
            const elapsed2 = Math.floor((now2 - data.questionStartTime) / 1000);
            const rem = Math.max(0, duration - elapsed2);
            this.timer = rem;
            this.timerPercent = (rem / duration) * 100;
            this.timerActive = rem > 0;
        if (rem === 0) {
          clearInterval(this.timerInterval);
          if (!this.answerSubmitted) {
            this.submitAnswer(-1);
          }
        }
          }, 1000);
        }
      }
    });
  }

  startTimer() {
    console.log('[DEBUG][QUIZ.COMPONENT] startTimer called');
    this.timer = 15;
    this.timerPercent = 100;
    this.timerActive = true;
    this.timerService.start(15);
    this.timerService.getCountdown().subscribe((value) => {
      this.timer = value;
      this.timerPercent = (value / 15) * 100;
      if (value === 0) {
        this.timerActive = false;
        this.submitAnswer(-1); // Non-réponse
      }
    });
  }

  selectAnswer(index: number) {
    console.log('[DEBUG][selectAnswer] userId:', this.userId, 'index:', index, 'timerActive:', this.timerActive, 'answerSubmitted:', this.answerSubmitted);
    if (!this.timerActive || this.answerSubmitted) return;
    this.selectedAnswerIndex = index;
    this.isAnswerCorrect = this.currentQuestion?.correctIndex === index;
    this.timerActive = false;
    this.answerSubmitted = true;
    this.submitAnswer(index);
  }

  async submitAnswer(answerIndex: number) {
    // answerIndex = -1 si non-réponse
    this.answerSubmitted = true;
    await this.quizService.submitAnswer(this.userId, answerIndex, this.userName, this.currentIndex);
    // Le score sera mis à jour automatiquement par la souscription réactive
    // Ne pas remettre answerSubmitted à false ici
  }

  // La méthode loadPersonalScore n'est plus utilisée (remplacée par la souscription réactive)

  nextQuestion() {
    // Côté joueur, la navigation se fait via la synchro Firestore (admin)
    // On ne fait rien ici, sauf marquer la fin du quiz si besoin
    if (this.currentIndex >= (this.questionResults.length - 1)) {
      this.quizFinished = true;
    }
  }
}
