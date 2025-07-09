
import { Component } from '@angular/core';
import { TimerService } from '../services/timer.service';
import { CommonModule } from '@angular/common';
import { QRCodeComponent } from 'angularx-qrcode';
import { QuizService, QuizStep } from '../services/quiz.service';
import { Question } from '../models/question.model';
import { User } from '../models/user.model';
import { Observable, timer, Subscription } from 'rxjs';


@Component({
  selector: 'app-presentation',
  standalone: true,
  imports: [CommonModule, QRCodeComponent],
  templateUrl: './presentation.component.html',
  styleUrls: ['./presentation.component.css']
})
export class PresentationComponent {
  step: QuizStep = 'lobby';
  participants: User[] = [];
  currentIndex: number = 0;
  currentQuestion: Question | null = null;
  answersCount: number[] = [];
  answersCountSub?: Subscription;
  leaderboard: User[] = [];
  windowLocation = window.location.origin;
  timerValue: number = 15;
  timerSub?: Subscription;
  totalAnswers: number = 0;
  totalGood: number = 0;
  totalBad: number = 0;
  voters: string[] = [];


  canShowEndButton(): boolean {
    return this.currentIndex === (this.quizService.getQuestions().length - 1) && this.step !== 'end';
  }

  constructor(public quizService: QuizService, private timerService: TimerService) {
    // Synchro temps réel de l'étape du quiz
    this.quizService.getStep().subscribe(step => {
      if (!step) return;
      this.step = step;
      this.refresh();
      if (step === 'question') this.startTimer();
      else this.stopTimer();
    });
    // Synchro temps réel de l'index de la question
    this.quizService.getCurrentIndex().subscribe(idx => {
      this.currentIndex = idx;
      this.refresh();
      // Synchro temps réel des votants pour la question courante
      this.quizService.getVoters$(idx).subscribe(voters => {
        this.voters = voters;
      });
      // Synchro temps réel du nombre de réponses par option
      if (this.answersCountSub) this.answersCountSub.unsubscribe();
      this.answersCountSub = this.quizService.getAnswersCount$(idx).subscribe(counts => {
        this.answersCount = counts;
        this.refresh();
      });
    });
    // Synchro temps réel des inscrits
    this.quizService.getParticipants$().subscribe(participants => {
      this.participants = participants;
      // Recalcul dynamique du score de chaque participant pour le classement final
      this.quizService.getAllAnswers$().subscribe((allAnswersDocs: any[]) => {
        const nbQuestions = this.quizService.getQuestions().length;
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
    // Synchro temps réel des questions Firestore
    this.quizService.questions$.subscribe(() => {
      this.refresh();
    });
    this.refresh();
  }

  forceEndTimer() {
    this.timerValue = 0;
    this.stopTimer();
    this.showResult();
  }

  ngOnInit() {
    // Appel unique dans le contexte Angular pour éviter les warnings
    this.quizService.initQuestions();
  }

  refresh() {
    // this.participants = ... supprimé, car synchro via Firestore
    this.currentQuestion = this.quizService.getCurrentQuestion(this.currentIndex);
    // Ne pas écraser le leaderboard dynamique ici !
    if (this.currentQuestion && this.answersCount) {
      this.totalGood = this.answersCount[this.currentQuestion.correctIndex] || 0;
      this.totalAnswers = this.answersCount.reduce((a, b) => a + b, 0);
      this.totalBad = this.totalAnswers - this.totalGood;
    } else {
      this.totalGood = 0;
      this.totalAnswers = 0;
      this.totalBad = 0;
    }
  }

  launchGame() {
    // Passe à l'étape "waiting" avant de lancer la première question
    this.quizService.setStep('waiting');
  }

  // Méthode à appeler pour vraiment démarrer la première question après l'attente
  async startFirstQuestion() {
    // Ajoute le timestamp de début de question dans Firestore
    const { doc, setDoc } = await import('firebase/firestore');
    const now = Date.now();
    await (await import('@angular/core')).runInInjectionContext(this.quizService['injector'], async () => {
      const quizStateDoc = doc(this.quizService['firestore'], 'quizState/main');
      await setDoc(quizStateDoc, { step: 'question', questionStartTime: now }, { merge: true });
    });
  }

  startTimer() {
    // ...
    this.timerValue = 15;
    this.stopTimer();
    if (this.timerSub) {
      // ...
      this.timerSub.unsubscribe();
    }
    this.timerSub = timer(0, 1000).subscribe(val => {
      this.timerValue = 15 - val;
      if (this.timerValue <= 0) {
        this.showResult();
      }
    });
  }

  stopTimer() {
    if (this.timerSub) this.timerSub.unsubscribe();
  }

  showResult() {
    // ...
    this.quizService.setStep('result');
  }

  nextQuestion() {
    // Incrémente l'index et met à jour le timestamp de début de question
    (async () => {
      const { doc, setDoc } = await import('firebase/firestore');
      const now = Date.now();
      await (await import('@angular/core')).runInInjectionContext(this.quizService['injector'], async () => {
        const quizStateDoc = doc(this.quizService['firestore'], 'quizState/main');
        await setDoc(quizStateDoc, { currentQuestionIndex: this.currentIndex + 1, step: 'question', questionStartTime: now }, { merge: true });
      });
    })();
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
    const { doc, setDoc, collection, getDocs, deleteDoc } = await import('firebase/firestore');
    await (await import('@angular/core')).runInInjectionContext(this.quizService['injector'], async () => {
      const quizStateDoc = doc(this.quizService['firestore'], 'quizState/main');
      const participantsCol = collection(this.quizService['firestore'], 'participants');
      const answersCol = collection(this.quizService['firestore'], 'answers');
      // Reset étape et index
      await setDoc(quizStateDoc, { step: 'lobby', currentQuestionIndex: 0 }, { merge: true });
      // Supprime tous les participants
      const participantsSnap = await getDocs(participantsCol);
      for (const docu of participantsSnap.docs) {
        await deleteDoc(docu.ref);
      }
      // Supprime toutes les réponses
      const answersSnap = await getDocs(answersCol);
      for (const docu of answersSnap.docs) {
        await deleteDoc(docu.ref);
      }
    });
    alert('Quiz réinitialisé. Tous les participants et réponses ont été supprimés.');
    // Réinitialisation locale de l'état du composant
    this.step = 'lobby';
    this.currentIndex = 0;
    this.currentQuestion = null;
    this.answersCount = [];
    this.leaderboard = [];
    this.timerValue = 15;
    this.voters = [];
    this.refresh();
  }
}
