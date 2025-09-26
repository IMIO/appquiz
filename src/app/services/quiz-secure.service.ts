import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom, interval, timer } from 'rxjs';
import { map, switchMap, catchError, distinctUntilChanged, tap } from 'rxjs/operators';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Question } from '../models/question.model';
import { User } from '../models/user.model';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { GamePersistenceService } from './game-persistence.service';

export type QuizStep = 'lobby' | 'waiting' | 'question' | 'result' | 'end';

@Injectable({ providedIn: 'root' })
export class QuizService {
  public participants: User[] = [];
  private questions: Question[] = [];
  private questionsSubject = new BehaviorSubject<Question[]>([]);
  public questions$ = this.questionsSubject.asObservable();

  private questionsLoaded = false;
  private readonly apiUrl = environment.apiUrl;

  // Cache pour éviter les logs répétitifs
  private lastStep: QuizStep | null = null;

  constructor(private http: HttpClient, private persistenceService: GamePersistenceService) {
    this.initQuestions();
  }

  // Headers standard (pas d'authentification requise avec SQLite)
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json'
    });
  }

  // Chargement des questions via l'API SQLite
  async initQuestions() {
    if (this.questionsLoaded) return;
    this.questionsLoaded = true;

    console.log('[SERVICE] Début chargement des questions...');

    try {
      const questions: Question[] = await firstValueFrom(
        this.http.get<Question[]>(`${this.apiUrl}/questions`, {
          headers: this.getHeaders()
        })
      );

      this.questions = questions.sort((a, b) => a.id - b.id);
      this.questionsSubject.next(this.questions);

      console.log('[SERVICE] Questions chargées:', {
        total: this.questions.length,
        questions: this.questions.map(q => ({ id: q.id, text: q.text.substring(0, 50) + '...' }))
      });
    } catch (error) {
      console.error('[SERVICE] Erreur chargement questions:', error);
      this.questions = [];
      this.questionsSubject.next([]);
    }
  }

  // Reset toutes les réponses via l'API
  async resetAllAnswers() {
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/quiz/reset`, {}, {
          headers: this.getHeaders()
        })
      );
    } catch (error) {
      console.error('Erreur reset answers:', error);
    }
  }

  // Observable : toutes les réponses via polling de l'API
  getAllAnswers$(): Observable<any[]> {
    return interval(4000).pipe(
      switchMap(async () => {
        const nbQuestions = this.questions.length;
        const allAnswersDocs: any[] = [];

        // Pour chaque question, récupérer les réponses
        for (let idx = 0; idx < nbQuestions; idx++) {
          try {
            const response: any = await firstValueFrom(
              this.http.get(`${this.apiUrl}/answers/${idx}`, {
                headers: this.getHeaders()
              })
            );
            allAnswersDocs.push({
              id: idx,
              answers: response.answers || []
            });
          } catch (error) {
            console.error(`[SERVICE] Erreur récupération réponses question ${idx}:`, error);
            allAnswersDocs.push({
              id: idx,
              answers: []
            });
          }
        }

        return allAnswersDocs;
      }),
      catchError(() => of([]))
    );
  }

  // Observable : réponses d'un utilisateur spécifique
  getAllAnswersForUser$(userId: string): Observable<any[]> {
    const safeUserId = String(userId).trim();
    return interval(5000).pipe(
      switchMap(async () => {
        const nbQuestions = this.questions.length;
        const answersByIndex: any[] = Array(nbQuestions).fill(null);

        // Pour chaque question, récupérer les réponses de l'utilisateur
        for (let idx = 0; idx < nbQuestions; idx++) {
          try {
            const response: any = await firstValueFrom(
              this.http.get(`${this.apiUrl}/answers/${idx}`, {
                headers: this.getHeaders()
              })
            );
            const answers = response.answers || [];
            const userAnswer = answers.find((ans: any) =>
              String(ans.userId).trim() === safeUserId
            );
            answersByIndex[idx] = { index: idx, answer: userAnswer };
          } catch {
            answersByIndex[idx] = { index: idx, answer: null };
          }
        }

        return answersByIndex;
      }),
      catchError(() => of([]))
    );
  }

  // Observable : état du quiz via polling optimisé
  getStep(): Observable<QuizStep> {
  return interval(1000).pipe( // Augmentation à 1s pour réduire la charge réseau
      switchMap(() =>
        this.http.get<any>(`${this.apiUrl}/quiz-state`, {
          headers: this.getHeaders()
        })
      ),
      map((data: any) => {
        const currentStep = data?.step as QuizStep || 'lobby';
        // Log uniquement si l'état a changé
        if (currentStep !== this.lastStep) {
          console.log('[DEBUG][API][getStep] Changement détecté:', this.lastStep, '->', currentStep);
          this.lastStep = currentStep;
        }
        return currentStep;
      }),
      distinctUntilChanged(), // Éviter les émissions répétées
      catchError((error) => {
        console.warn('[SERVICE] Erreur getStep, conservation du dernier état:', error);
        return of(this.lastStep || 'lobby' as QuizStep); // Conserver le dernier état connu au lieu de forcer 'lobby'
      })
    );
  }

  // Récupérer l'état complet du jeu (pour la synchronisation du timer)
  async getGameState(): Promise<any> {
    try {
      return await firstValueFrom(
        this.http.get<any>(`${this.apiUrl}/quiz-state`, {
          headers: this.getHeaders()
        })
      );
    } catch (error) {
      console.error('Erreur récupération état du jeu:', error);
      return null;
    }
  }

  // Mise à jour de l'étape du quiz
  async setStep(step: QuizStep) {
    try {
      await firstValueFrom(
        this.http.put(`${this.apiUrl}/quiz-state`, { step }, {
          headers: this.getHeaders()
        })
      );
      
      // Sauvegarde automatique après changement d'étape (sauf pour lobby)
      if (step !== 'lobby') {
        this.persistenceService.updateGameState({
          step,
          currentQuestionIndex: 0, // Reset index pour nouvelles étapes
          questionStartTime: step === 'question' ? Date.now() : undefined
        });
      }
      
    } catch (error) {
      console.error('Erreur setStep:', error);
    }
  }

  setQuestions(qs: Question[]) {
    this.questions = qs;
    this.questionsSubject.next(this.questions);
  }

  getParticipants(): User[] {
    return this.participants;
  }

  // Récupérer les participants directement du serveur (pour synchronisation)
  async fetchParticipantsFromServer(): Promise<User[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<User[]>(`${this.apiUrl}/participants`, {
          headers: this.getHeaders()
        })
      );
      this.participants = response || [];
      return this.participants;
    } catch (error) {
      console.error('Erreur récupération participants du serveur:', error);
      return [];
    }
  }

  // Observable : participants via polling (réduit de 2s à 4s)
  getParticipants$(): Observable<User[]> {
    return interval(4000).pipe(
      switchMap(() =>
        this.http.get<User[]>(`${this.apiUrl}/participants`, {
          headers: this.getHeaders()
        })
      ),
      map((users: User[]) => {
        this.participants = users;
        return users;
      }),
      catchError((error) => {
        console.warn('[SERVICE] Erreur getParticipants, conservation de la liste existante:', error);
        return of(this.participants); // Conserver la liste existante au lieu de tableau vide
      })
    );
  }

  getQuestions() {
    return this.questions;
  }

  // Observable : index de question courante via polling (réduit à 1s pour test)
  getCurrentIndex(): Observable<number> {
    return interval(1000).pipe(
      switchMap(() =>
        this.http.get<any>(`${this.apiUrl}/quiz-state`, {
          headers: this.getHeaders()
        })
      ),
      map((data: any) => data?.currentQuestionIndex ?? 0),
      distinctUntilChanged(), // Éviter les émissions répétées de la même valeur
      catchError(() => of(0))
    );
  }

  getCurrentQuestion(index?: number): Question | null {
    console.log('[SERVICE] getCurrentQuestion appelé avec index:', index, {
      questionsLength: this.questions.length,
      questionsAvailable: this.questions.map(q => ({ id: q.id, text: q.text.substring(0, 30) + '...' }))
    });

    if (typeof index === 'number') {
      const question = this.questions[index] || null;
      console.log('[SERVICE] Question retournée pour index', index, ':', question ? {
        id: question.id,
        text: question.text.substring(0, 50) + '...'
      } : 'NULL');
      return question;
    }
    return null;
  }

  // Passage à la question suivante
  async nextQuestion(currentIndex: number) {
    const nextIndex = currentIndex + 1;

    console.log('[SERVICE] nextQuestion appelé:', {
      currentIndex,
      nextIndex,
      totalQuestions: this.questions.length,
      willProceed: nextIndex < this.questions.length
    });

    try {
      if (nextIndex < this.questions.length) {
        console.log('[SERVICE] Envoi PUT vers API pour index:', nextIndex);
        
        // Préparer les données pour l'API
        const updateData: any = {
          currentQuestionIndex: nextIndex,
          questionStartTime: Date.now()
        };
        
        // Si on passe à la première question (index 0), on met aussi le step à 'question'
        if (nextIndex === 0) {
          updateData.step = 'question';
        }
        
        const result = await firstValueFrom(
          this.http.put(`${this.apiUrl}/quiz-state`, updateData, {
            headers: this.getHeaders()
          })
        );
        console.log('[SERVICE] Réponse API:', result);
      } else {
        console.log('[SERVICE] Fin du quiz - appel setStep(end)');
        await this.setStep('end');
      }
    } catch (error) {
      console.error('[SERVICE] Erreur nextQuestion:', error);
    }
  }

  // Ajout d'un participant
  async addParticipant(user: User) {
    try {
      console.log('[SERVICE] Ajout participant via API:', user);
      const response = await firstValueFrom(
        this.http.post(`${this.apiUrl}/participants`, user, {
          headers: this.getHeaders()
        })
      );
      console.log('[SERVICE] ✅ Réponse API addParticipant:', response);
      
      // Ajouter le participant à la liste locale
      this.participants.push(user);
      console.log('[SERVICE] ✅ Participant ajouté à la liste locale, total:', this.participants.length);
      
      // Sauvegarde automatique des participants
      this.persistenceService.updateGameState({
        participants: this.participants
      });
      console.log('[SERVICE] ✅ État sauvegardé');
      
    } catch (error) {
      console.error('[SERVICE] ❌ Erreur addParticipant:', error);
      throw error; // Re-throw pour que le composant puisse gérer l'erreur
    }
  }

  // Soumission d'une réponse
  async submitAnswer(userId: string, answerIndex: number, userName: string, questionIndex: number) {
    console.log('[DEBUG][submitAnswer] userId:', String(userId).trim(), 'answerIndex:', answerIndex, 'userName:', userName, 'questionIndex:', questionIndex);

    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/answers`, {
          questionIndex,
          userId,
          userName,
          answerIndex
        }, {
          headers: this.getHeaders()
        })
      );
    } catch (error) {
      console.error('Erreur submitAnswer:', error);
    }
  }

  // Observable : réponses pour une question donnée (réduit de 2s à 3s)
  getAnswers$(questionIndex: number): Observable<any[]> {
    return interval(3000).pipe(
      switchMap(() =>
        this.http.get<any>(`${this.apiUrl}/answers/${questionIndex}`, {
          headers: this.getHeaders()
        })
      ),
      map((data: any) => {
        const answers = data?.answers ?? [];
        // Reduced logging frequency to prevent console spam
        if (Math.random() < 0.1) { // Only log 10% of the time
          console.log(`[DEBUG][getAnswers$] Question ${questionIndex} API response:`, data);
          console.log(`[DEBUG][getAnswers$] Extracted answers:`, answers);
        }
        return answers;
      }),
      catchError((error) => {
        console.log(`[DEBUG][getAnswers$] Error for question ${questionIndex}:`, error);
        return of([]);
      })
    );
  }

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

  getVoters$(questionIndex: number): Observable<string[]> {
    return this.getAnswers$(questionIndex).pipe(
      map((answers: any[]) => answers.map(a => a.userId))
    );
  }

  getAnswersCount$(questionIndex: number): Observable<number[]> {
    console.log(`[DEBUG][getAnswersCount$] STARTING for question ${questionIndex}`);
    console.log(`[DEBUG][getAnswersCount$] Questions array:`, this.questions);
    console.log(`[DEBUG][getAnswersCount$] Question at index ${questionIndex}:`, this.questions[questionIndex]);

    // Utilisation d'un timer avec émission immédiate et puis toutes les 4 secondes
    return timer(0, 4000).pipe(
      switchMap(() => {
        console.log(`[DEBUG][getAnswersCount$] Making API call for question ${questionIndex}`);
        return this.http.get<any>(`${this.apiUrl}/answers/${questionIndex}`, {
          headers: this.getHeaders()
        });
      }),
      map((data: any) => {
        const answers = data?.answers ?? [];
        console.log(`[DEBUG][getAnswersCount$] Question ${questionIndex} API response:`, data);
        console.log(`[DEBUG][getAnswersCount$] Question ${questionIndex} received answers:`, answers);

        const question = this.questions[questionIndex];
        console.log(`[DEBUG][getAnswersCount$] Current question object:`, question);

        const nbOptions = question?.options?.length ?? 0;
        console.log(`[DEBUG][getAnswersCount$] Question ${questionIndex} has ${nbOptions} options`);

        if (nbOptions === 0) {
          console.log(`[DEBUG][getAnswersCount$] RETURNING EMPTY ARRAY - no options found`);
          return [];
        }

        const counts = Array(nbOptions).fill(0);
        console.log(`[DEBUG][getAnswersCount$] Initialized counts array:`, counts);

        for (const a of answers) {
          console.log(`[DEBUG][getAnswersCount$] Processing answer:`, a);
          if (typeof a.answerIndex === 'number' && a.answerIndex >= 0 && a.answerIndex < nbOptions) {
            counts[a.answerIndex]++;
            console.log(`[DEBUG][getAnswersCount$] Incremented count for option ${a.answerIndex}, counts now:`, counts);
          } else {
            console.log(`[DEBUG][getAnswersCount$] Invalid answerIndex:`, a.answerIndex);
          }
        }
        console.log(`[DEBUG][getAnswersCount$] Final counts for question ${questionIndex}:`, counts);
        return counts;
      }),
      catchError((error) => {
        console.log(`[DEBUG][getAnswersCount$] Error for question ${questionIndex}:`, error);
        return of([]);
      })
    );
  }

  getLeaderboard(): User[] {
    return [...this.participants].sort((a, b) => b.score - a.score);
  }

  async resetParticipants() {
    try {
      console.log('[SERVICE] Reset participants - Appel API /quiz/reset...');
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/quiz/reset`, {}, {
          headers: this.getHeaders()
        })
      );
      console.log('[SERVICE] Reset participants - ✅ API appelée avec succès');
      
      this.participants = [];
      console.log('[SERVICE] Reset participants - Liste locale vidée');
      
      await this.setStep('lobby');
      console.log('[SERVICE] Reset participants - ✅ Étape lobby définie');
      
      // Effacer la sauvegarde lors du reset
      this.persistenceService.clearSavedGameState();
      console.log('[SERVICE] Reset participants - ✅ Sauvegarde effacée');
      
    } catch (error) {
      console.error('[SERVICE] ❌ Erreur resetParticipants:', error);
      throw error; // Re-throw pour que le composant puisse gérer l'erreur
    }
  }

  // Méthodes de persistance et restauration
  canRestoreGameState(): boolean {
    return this.persistenceService.canRestoreGame();
  }

  clearSavedGameState(): void {
    this.persistenceService.clearSavedGameState();
  }

  async restoreGameState(): Promise<boolean> {
    try {
      const savedState = this.persistenceService.getSavedGameState();
      if (!savedState) {
        console.log('🔄 Aucun état sauvegardé trouvé');
        return false;
      }

      console.log('🔄 Restauration de l\'état du jeu:', savedState);

      // Restaurer l'état serveur
      await firstValueFrom(
        this.http.put(`${this.apiUrl}/quiz-state`, {
          step: savedState.step,
          currentQuestionIndex: savedState.currentQuestionIndex || 0,
          questionStartTime: savedState.questionStartTime || Date.now()
        }, {
          headers: this.getHeaders()
        })
      );

      // Restaurer les participants (si pas déjà présents sur le serveur)
      if (savedState.participants && savedState.participants.length > 0) {
        for (const participant of savedState.participants) {
          try {
            await this.addParticipant(participant);
          } catch (error) {
            // Ignorer si le participant existe déjà
            console.warn('Participant déjà existant:', participant.name);
          }
        }
      }

      // Mettre à jour l'état local
      this.participants = savedState.participants || [];
      
      console.log('✅ État du jeu restauré avec succès');
      return true;

    } catch (error) {
      console.error('❌ Erreur lors de la restauration:', error);
      return false;
    }
  }

  // Initialiser la sauvegarde pour une nouvelle partie
  initGameState(): void {
    this.persistenceService.saveGameState({
      step: 'lobby',
      currentQuestionIndex: 0,
      questionStartTime: 0,
      participants: [],
      leaderboard: [],
      totalQuestions: this.questions.length,
      gameStartTime: Date.now(),
      lastActivity: Date.now()
    });
  }
}
