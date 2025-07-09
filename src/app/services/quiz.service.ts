import { Injectable, inject, runInInjectionContext, EnvironmentInjector } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { Firestore, collectionData, collection, doc, setDoc, docData, runTransaction } from '@angular/fire/firestore';
import { arrayUnion, arrayRemove, updateDoc } from 'firebase/firestore';
import { deleteDoc } from '@angular/fire/firestore';
import { Question } from '../models/question.model';
import { User } from '../models/user.model';

const QUESTIONS_COLLECTION = 'questions';
export type QuizStep = 'lobby' | 'waiting' | 'question' | 'result' | 'end';

@Injectable({ providedIn: 'root' })
export class QuizService {
  private questions: Question[] = [];
  private questionsSubject = new BehaviorSubject<Question[]>([]);
  public questions$ = this.questionsSubject.asObservable();

  private questionsLoaded = false;

  private injector = inject(EnvironmentInjector);
  constructor(private firestore: Firestore) {}

  /**
   * À appeler explicitement dans le composant principal pour charger les questions Firestore
   */
  initQuestions() {
    if (this.questionsLoaded) return;
    this.questionsLoaded = true;
    // Appeler cette méthode UNIQUEMENT dans un composant Angular (jamais dans le service ou son constructeur)
    try {
      runInInjectionContext(this.injector, () => {
        collectionData(collection(this.firestore, QUESTIONS_COLLECTION)).subscribe((qs: any[]) => {
          // Correction : tri explicite par id croissant pour garantir l'ordre
          this.questions = Array.isArray(qs) ? (qs as Question[]).sort((a, b) => a.id - b.id) : [];
          this.questionsSubject.next(this.questions);
        }, (err) => {
          // En cas d'erreur Firestore, on vide le tableau pour éviter un état incohérent
          this.questions = [];
          this.questionsSubject.next([]);
        });
      });
    } catch (e) {
      this.questions = [];
      this.questionsSubject.next([]);
      console.warn('[QuizService] Appel à initQuestions() hors contexte Angular, ignoré.', e);
    }
  }

  /**
   * Observable : toutes les réponses de tous les participants pour toutes les questions
   */
  getAllAnswers$() {
    // On récupère aussi l'id du document Firestore (l'index de la question)
    return runInInjectionContext(this.injector, () =>
      collectionData(collection(this.firestore, 'answers'), { idField: 'id' })
    );
  }

  /**
   * Observable : toutes les réponses d'un joueur pour toutes les questions
   */
  getAllAnswersForUser$(userId: string) {
    const safeUserId = String(userId).trim();
    return this.getAllAnswers$().pipe(
      map((docs: any[]) => {
        // docs = [{answers: [...]}, ...] mais docs[i] n'est pas garanti pour chaque index
        // On reconstruit un tableau de la taille du nombre de questions
        const nbQuestions = this.questions.length;
        const answersByIndex: any[] = Array(nbQuestions).fill(null);
        docs.forEach((doc: any) => {
          // doc.id ou doc['id'] doit correspondre à l'index de la question (sous forme string)
          const idx = parseInt(doc['id'] ?? doc['index'] ?? '-1', 10);
          if (!isNaN(idx) && idx >= 0 && idx < nbQuestions) {
            const a = (doc.answers || []).find((ans: any) => String(ans.userId).trim() === safeUserId);
            answersByIndex[idx] = { index: idx, answer: a };
          }
        });
        // Pour chaque index, on retourne l'objet {index, answer}
        return answersByIndex.map((entry, idx) => entry || { index: idx, answer: null });
      })
    );
  }

  /**
   * Retourne un Observable temps réel sur l'étape du quiz (stockée dans Firestore)
   */
  getStep(): Observable<QuizStep> {
    return runInInjectionContext(this.injector, () => {
      const quizStateDoc = doc(this.firestore, 'quizState/main');
      // docData renvoie un Observable de l'objet { step: ... }
      return docData(quizStateDoc).pipe(
        // On extrait uniquement la propriété step
        // @ts-ignore
        map((data: any) => data?.step as QuizStep)
      );
    });
  }

  /**
   * Met à jour l'étape du quiz dans Firestore
   */
  async setStep(step: QuizStep) {
    await runInInjectionContext(this.injector, async () => {
      const quizStateDoc = doc(this.firestore, 'quizState/main');
      await setDoc(quizStateDoc, { step }, { merge: true });
    });
  }

  setQuestions(qs: Question[]) {
    this.questions = qs;
  }

  getParticipants(): User[] {
    throw new Error('getParticipants() n’est plus supporté, utiliser getParticipants$().');
  }

  getParticipants$() {
    // Observable temps réel Firestore
    return runInInjectionContext(this.injector, () =>
      collectionData(collection(this.firestore, 'participants'), { idField: 'id' }) as Observable<User[]>
    );
  }

  getQuestions() {
    return this.questions;
  }

  /**
   * Observable temps réel sur l'index de la question courante (Firestore)
   */
  getCurrentIndex(): Observable<number> {
    return runInInjectionContext(this.injector, () => {
      const quizStateDoc = doc(this.firestore, 'quizState/main');
      return docData(quizStateDoc).pipe(
        // @ts-ignore
        map((data: any) => data?.currentQuestionIndex ?? 0)
      );
    });
  }

  /**
   * Retourne la question courante (en local, à partir de l'index partagé)
   */
  getCurrentQuestion(index?: number): Question | null {
    if (typeof index === 'number') {
      return this.questions[index] || null;
    }
    return null;
  }

  /**
   * Passe à la question suivante (synchronisé Firestore)
   */
  async nextQuestion(currentIndex: number) {
    const nextIndex = currentIndex + 1;
    if (nextIndex < this.questions.length) {
      await runInInjectionContext(this.injector, async () => {
        const quizStateDoc = doc(this.firestore, 'quizState/main');
        await setDoc(quizStateDoc, { currentQuestionIndex: nextIndex }, { merge: true });
      });
    }
  }

  async addParticipant(user: User) {
    // Ajoute le participant dans Firestore (id = user.id)
    await runInInjectionContext(this.injector, async () => {
      await setDoc(doc(this.firestore, 'participants', user.id), user);
    });
  }

  /**
   * Enregistre la réponse d'un participant et ajoute son nom/id à la liste des votants pour la question courante
   */
  async submitAnswer(userId: string, answerIndex: number, userName: string, questionIndex: number) {
    console.log('[DEBUG][submitAnswer] userId:', String(userId).trim(), 'answerIndex:', answerIndex, 'userName:', userName, 'questionIndex:', questionIndex);
    // Ajoute la réponse dans le document answers/{questionIndex} via une transaction AngularFire
    // Ajout atomique de la réponse du joueur sans transaction (évite failed-precondition)
    await runInInjectionContext(this.injector, async () => {
      const answerDoc = doc(this.firestore, 'answers', String(questionIndex));
      const { getDoc, setDoc } = await import('firebase/firestore');
      const snap = await getDoc(answerDoc);
      if (!snap.exists()) {
        // Création du document avec la première réponse
        await setDoc(answerDoc, { answers: [{ userId, userName, answerIndex }] });
        return;
      }
      // Sinon, suppression des anciennes réponses du user puis ajout de la nouvelle
      const existingAnswers = snap.data()?.['answers'] ?? [];
      for (const a of existingAnswers) {
        if (a.userId === userId) {
          await updateDoc(answerDoc, { answers: arrayRemove(a) });
        }
      }
      await updateDoc(answerDoc, { answers: arrayUnion({ userId, userName, answerIndex }) });
    });
  }

  /**
   * Retourne un Observable temps réel sur les réponses pour une question donnée
   */
  getAnswers$(questionIndex: number): Observable<any[]> {
    return runInInjectionContext(this.injector, () => {
      const answerDoc = doc(this.firestore, 'answers', String(questionIndex));
      return docData(answerDoc).pipe(
        map((data: any) => data?.answers ?? [])
      );
    });
  }

  /**
   * Calcule le nombre de bonnes, mauvaises et non-réponses pour une question
   */
  countResults(answers: any[], correctIndex: number, participants: any[]): {good: number, bad: number, none: number} {
    const total = participants.length;
    let good = 0, bad = 0;
    const answeredIds = new Set();
    for (const a of answers) {
      answeredIds.add(a.userId);
      if (a.answerIndex === correctIndex) good++;
      else if (a.answerIndex !== -1) bad++;
    }
    const none = total - answeredIds.size;
    return { good, bad, none };
  }

  /**
   * Observable temps réel sur la liste des votants pour la question courante
   */
  getVoters$(questionIndex: number): Observable<string[]> {
    return runInInjectionContext(this.injector, () => {
      const answerDoc = doc(this.firestore, 'answers', String(questionIndex));
      return docData(answerDoc).pipe(
        map((data: any) => data?.voters ?? [])
      );
    });
  }

  // Retourne le nombre de réponses par option pour la question courante
  /**
   * Observable temps réel : nombre de réponses par option pour une question donnée
   */
  getAnswersCount$(questionIndex: number): Observable<number[]> {
    return runInInjectionContext(this.injector, () => {
      const answerDoc = doc(this.firestore, 'answers', String(questionIndex));
      return docData(answerDoc).pipe(
        map((data: any) => {
          const answers = data?.answers ?? [];
          // On compte le nombre de réponses pour chaque option
          const nbOptions = this.questions[questionIndex]?.options?.length ?? 0;
          if (nbOptions === 0) return [];
          const counts = Array(nbOptions).fill(0);
          for (const a of answers) {
            if (typeof a.answerIndex === 'number' && a.answerIndex >= 0 && a.answerIndex < nbOptions) {
              counts[a.answerIndex]++;
            }
          }
          return counts;
        })
      );
    });
  }

  getLeaderboard(): User[] {
    // À adapter si besoin de classement temps réel
    return [];
  }

  // Ajoute un reset des participants (optionnel)
  async resetParticipants() {
    // Supprime tous les documents de la collection participants
    await runInInjectionContext(this.injector, async () => {
      const participants = await firstValueFrom(
        collectionData(collection(this.firestore, 'participants'), { idField: 'id' })
      );
      await Promise.all(participants.map(user =>
        deleteDoc(doc(this.firestore, 'participants', user['id']))
      ));
      // Remet l'étape du quiz à 'lobby' (toutes les pages sauf QR code reviendront à l'inscription)
      await this.setStep('lobby');
    });
  }
}
