
import { Component, ChangeDetectorRef } from '@angular/core';
import { TimerService } from '../services/timer.service';
import { CommonModule } from '@angular/common';
import { QRCodeComponent } from 'angularx-qrcode';
import { QuizService, QuizStep } from '../services/quiz.service';
import { Question } from '../models/question.model';
import { User } from '../models/user.model';
import { Observable, timer, Subscription } from 'rxjs';
import { doc, getDoc } from 'firebase/firestore';
import { LeaderboardEntry } from '../models/leaderboard-entry.model';

@Component({
  selector: 'app-presentation',
  standalone: true,
  imports: [CommonModule, QRCodeComponent],
  templateUrl: './presentation.component.html',
  styleUrls: ['./presentation.component.css']
})
export class PresentationComponent {
  step: any = 'lobby'; // Typage élargi pour compatibilité template Angular

  ngOnInit() {
    // Appel unique dans le contexte Angular pour éviter les warnings
    this.quizService.initQuestions();
    // Forcer l'étape lobby au démarrage
    this.step = 'lobby';
    this.quizService.setStep('lobby');
    // Diagnostic : log ultra-visible
    console.log('[DEBUG][ngOnInit] step initialisé à', this.step);
    // Vérification périodique de la synchro step
    setInterval(() => {
      if (!this.step || (this.step !== 'lobby' && this.step !== 'waiting' && this.step !== 'question' && this.step !== 'result' && this.step !== 'end')) {
        console.warn('[DIAGNOSTIC][step] Valeur non reconnue :', this.step);
      }
    }, 2000);
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

  // Retourne le temps total des bonnes réponses pour un user
  // (méthode unique, suppression du doublon)
  windowLocation = window.location.origin;
  timerValue: number = 15;
  timerMax: number = 15; // Durée du timer en secondes, synchronisée avec timerValue
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

  constructor(public quizService: QuizService, private timerService: TimerService, private cdr: ChangeDetectorRef) {
    // Synchro temps réel de l'étape du quiz
    this.quizService.getStep().subscribe(step => {
      if (!step) return;
      // Correction typage : accepte tous les états possibles
      this.step = step as QuizStep;
      this.refresh();
      console.log('[DEBUG][SYNC][getStep] Nouvelle étape reçue :', step);
      this.cdr.detectChanges(); // Forcer la synchro immédiate
      if (step === 'question') this.startTimer();
      else this.stopTimer();
      // Réinitialisation des réponses Firestore lors du retour à l'étape lobby
      if (step === 'lobby') {
        this.quizService.resetAllAnswers();
      }
      // NE PAS appeler showResult ici pour éviter la boucle infinie
    });
    // Synchro temps réel de l'index de la question
    this.quizService.getCurrentIndex().subscribe(async idx => {
      this.currentIndex = idx;
      await this.fetchQuestionStartTimes(); // Rafraîchit les timestamps à chaque question
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
        // Correction : recalcul du leaderboard à chaque changement d'index
        this.quizService.getParticipants$().subscribe(participants => {
          this.quizService.getAllAnswers$().subscribe((allAnswersDocs: any[]) => {
            // Recalcul du leaderboard à chaque mise à jour des réponses Firestore
            const nbQuestions = this.quizService.getQuestions().length;
            this.quizService.getParticipants$().subscribe(participants => {
              // Vérifie qu'au moins une réponse valide (≠ -1) existe pour chaque participant
              const hasValidAnswer = participants.every(user => {
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
                console.log('[DEBUG][LEADERBOARD][SKIP] Pas de réponse valide, leaderboard masqué.');
                return;
              }
              const leaderboard: LeaderboardEntry[] = participants.map(user => {
                let score = 0;
                let totalTime = 0;
                let goodTimes: number[] = [];
                for (let i = 0; i < nbQuestions; i++) {
                  const docAns = allAnswersDocs.find((d: any) => String(d.id) === String(i));
                  if (docAns && docAns.answers) {
                    // Prend toujours la dernière réponse Firestore du joueur pour la question
                    const answers = docAns.answers.filter((a: any) => String(a.userId) === String(user.id));
                    if (answers.length > 0) {
                      const answer = answers[answers.length - 1];
                      const question = this.quizService.getCurrentQuestion(i);
                      console.log(`[DEBUG][LEADERBOARD][USER]`, user.name, '| Q', i, '| answer:', answer?.answerIndex, '| correct:', question?.correctIndex);
                      if (question && typeof answer.answerIndex !== 'undefined') {
                        if (Number(answer.answerIndex) === Number(question.correctIndex)) {
                          score++;
                          console.log(`[DEBUG][LEADERBOARD][INCREMENT]`, user.name, '| Q', i, '| answer:', answer.answerIndex, '| correct:', question.correctIndex, '| score++');
                          const qStart = this.questionStartTimes[i] ?? this.questionStartTimes[String(i)];
                          if (answer.timestamp && qStart && answer.timestamp >= qStart) {
                            const timeTaken = Math.min(answer.timestamp - qStart, 15000);
                            goodTimes[i] = timeTaken;
                            totalTime += timeTaken;
                          }
                        } else {
                          goodTimes[i] = undefined as any;
                          // Log explicite si la réponse correcte n'est pas comptée
                          if (Number(answer.answerIndex) === Number(question.correctIndex)) {
                            console.warn(`[DEBUG][LEADERBOARD][NON-INCREMENT]`, user.name, '| Q', i, '| answer:', answer.answerIndex, '| correct:', question.correctIndex, '| MAIS score non incrémenté !');
                          }
                        }
                      }
                    } else {
                      goodTimes[i] = undefined as any;
                    }
                  } else {
                    goodTimes[i] = undefined as any;
                  }
                }
                this.goodAnswersTimesByUser[user.id] = goodTimes;
                return { id: user.id, name: user.name, avatarUrl: user.avatarUrl, score, totalTime };
              });
              this.leaderboard = leaderboard.sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return a.totalTime - b.totalTime;
              });
                console.log('[DEBUG][LEADERBOARD]', this.leaderboard);
              });
            console.log('[DEBUG][LEADERBOARD]', this.leaderboard);
          });
        });
    });
    // Synchro temps réel des inscrits
    this.quizService.getParticipants$().subscribe(participants => {
      this.participants = participants;
      this.fetchQuestionStartTimes().then(() => {
        this.quizService.getAllAnswers$().subscribe((allAnswersDocs: any[]) => {
          const nbQuestions = this.quizService.getQuestions().length;
          const leaderboard: LeaderboardEntry[] = participants.map(user => {
            let score = 0;
            let totalTime = 0;
            let goodTimes: number[] = [];
            for (let i = 0; i < nbQuestions; i++) {
              const docAns = allAnswersDocs.find((d: any) => String(d.id) === String(i));
              if (docAns && docAns.answers) {
                // On prend la dernière réponse du participant pour la question i
                const answers = docAns.answers.filter((a: any) => String(a.userId) === String(user.id));
                if (answers.length > 0) {
                  const answer = answers[answers.length - 1];
                  const question = this.quizService.getCurrentQuestion(i);
                  // Score
                  if (question && typeof answer.answerIndex !== 'undefined' && Number(answer.answerIndex) === Number(question.correctIndex)) {
                    score++;
                    // Temps de bonne réponse uniquement
                    const qStart = this.questionStartTimes[i] ?? this.questionStartTimes[String(i)];
                    if (answer.timestamp && qStart && answer.timestamp >= qStart) {
                      // Limite le temps de réponse à 15s max par question
                      const timeTaken = Math.min(answer.timestamp - qStart, 15000);
                      goodTimes[i] = timeTaken;
                      totalTime += timeTaken;
                    }
                  } else {
                    // Si mauvaise réponse ou non-réponse, on ne stocke rien
                    goodTimes[i] = undefined as any;
                  }
                } else {
                  goodTimes[i] = undefined as any;
                }
              } else {
                goodTimes[i] = undefined as any;
              }
            }
            // Stocke le tableau des temps de bonnes réponses pour ce user
            this.goodAnswersTimesByUser[user.id] = goodTimes;
            return { id: user.id, name: user.name, avatarUrl: user.avatarUrl, score, totalTime };
          });
          // Tri : score décroissant, puis temps total croissant
          this.leaderboard = leaderboard.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.totalTime - b.totalTime;
          });
        });
      });
    });
  }

  // Retourne le temps total des bonnes réponses pour un user
  public getTotalGoodAnswersTime(userId: string): number {
    const arr = this.goodAnswersTimesByUser[userId] || [];
    return arr.reduce((sum, t) => sum + (t || 0), 0);
  }

  // Récupère les questionStartTimes depuis Firestore (quizState/main)
  public async fetchQuestionStartTimes(): Promise<void> {
    try {
      const quizStateDoc = doc(this.quizService['firestore'], 'quizState/main');
      const snap = await getDoc(quizStateDoc);
      if (snap.exists()) {
        const data = snap.data();
        // Peut être un tableau ou un objet, on gère les deux cas
        if (data['questionStartTimes']) {
          this.questionStartTimes = data['questionStartTimes'];
        } else if (typeof data['questionStartTime'] !== 'undefined') {
          // Si un seul timestamp (cas legacy), on le met pour la première question
          this.questionStartTimes = { 0: data['questionStartTime'] };
        }
      }
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
    // Ajoute le timestamp de début de question dans Firestore, dans un objet cumulatif questionStartTimes
    const { doc, setDoc, getDoc } = await import('firebase/firestore');
    const now = Date.now();
    await (await import('@angular/core')).runInInjectionContext(this.quizService['injector'], async () => {
      const quizStateDoc = doc(this.quizService['firestore'], 'quizState/main');
      // On récupère l'objet existant si besoin
      let questionStartTimes: { [key: string]: number } = {};
      const snap = await getDoc(quizStateDoc);
      if (snap.exists() && snap.data()['questionStartTimes']) {
        questionStartTimes = { ...snap.data()['questionStartTimes'] };
      }
      questionStartTimes['0'] = now;
      await setDoc(quizStateDoc, {
        step: 'question',
        currentQuestionIndex: 0,
        questionStartTimes,
        questionStartTime: now // compatibilité descendante pour les clients qui attendent encore cette clé
      }, { merge: true });
    });
  }

  startTimer() {
    // ...
  this.timerValue = 15;
  this.timerMax = 15;
    this.stopTimer();
    if (this.timerSub) {
      // ...
      this.timerSub.unsubscribe();
    }
    this.timerSub = timer(0, 1000).subscribe(val => {
      this.timerValue = 15 - val;
      this.timerMax = 15;
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
    // On force la mise à jour des données avant d'afficher le résultat
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

  nextQuestion() {
    // Incrémente l'index et met à jour le timestamp de début de question dans l'objet cumulatif questionStartTimes
    (async () => {
      const { doc, setDoc, getDoc } = await import('firebase/firestore');
      const now = Date.now();
      await (await import('@angular/core')).runInInjectionContext(this.quizService['injector'], async () => {
        const quizStateDoc = doc(this.quizService['firestore'], 'quizState/main');
        const snap = await getDoc(quizStateDoc);
        let questionStartTimes: { [key: string]: number } = {};
        if (snap.exists() && snap.data()['questionStartTimes']) {
          questionStartTimes = { ...snap.data()['questionStartTimes'] };
        }
        // Ajoute le timestamp pour la nouvelle question
        questionStartTimes[String(this.currentIndex + 1)] = now;
        console.log('[DEBUG][PRESENTATION][nextQuestion] currentIndex:', this.currentIndex, '| newIndex:', this.currentIndex + 1, '| now:', now, '| questionStartTimes:', questionStartTimes);
        await setDoc(quizStateDoc, {
          currentQuestionIndex: this.currentIndex + 1,
          step: 'question',
          questionStartTimes
        }, { merge: true });
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
      // Vérification que la collection answers est bien vide
      const answersSnapAfter = await getDocs(answersCol);
      console.log('[DEBUG][RESET] Réponses restantes après suppression:', answersSnapAfter.docs.length);
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
    // Rafraîchit explicitement le leaderboard après reset
    setTimeout(() => {
      this.quizService.getAllAnswers$().subscribe((allAnswersDocs: any[]) => {
        console.log('[DEBUG][RESET][LEADERBOARD] Réponses Firestore après reset:', allAnswersDocs);
        this.leaderboard = [];
      });
    }, 500);
  }
}
