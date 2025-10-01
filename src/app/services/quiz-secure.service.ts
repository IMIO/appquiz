import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom, interval, timer, concat, Subscription } from 'rxjs';
import { map, switchMap, catchError, distinctUntilChanged, tap } from 'rxjs/operators';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Question } from '../models/question.model';
import { User } from '../models/user.model';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { GamePersistenceService } from './game-persistence.service';
import { WebSocketTimerService } from './websocket-timer.service';

export type QuizStep = 'lobby' | 'waiting' | 'question' | 'result' | 'end';

@Injectable({ providedIn: 'root' })
export class QuizService {
  public participants: User[] = [];
  private questions: Question[] = [];
  private questionsSubject = new BehaviorSubject<Question[]>([]);
  public questions$ = this.questionsSubject.asObservable();

  private questionsLoaded = false;
  private readonly apiUrl = environment.apiUrl;

  // Upload image pour une question
  async uploadQuestionImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);
    try {
      const response: any = await firstValueFrom(
        this.http.post(`${this.apiUrl}/upload-image`, formData)
      );
      // On suppose que le backend retourne { url: '...' }
      let url: string = response.url;
      // Si l'URL commence par l'API définie dans l'environnement, ne garder que le chemin relatif
      if (url && url.startsWith(this.apiUrl + '/assets/')) {
        url = url.replace(this.apiUrl, '');
      }
      // Idem pour https ou autre domaine (en prod)
      if (url && url.includes('/assets/')) {
        const idx = url.indexOf('/assets/');
        url = url.substring(idx);
      }
      return url;
    } catch (error) {
      console.error('[SERVICE] Erreur upload image:', error);
      throw error;
    }
  }

  // Mettre à jour l’URL d’image d’une question
  async updateQuestionImageUrl(questionId: number, imageUrl: string): Promise<void> {
    try {
      let safeUrl = imageUrl;
      // Forcer le chemin relatif si besoin
      if (safeUrl && safeUrl.startsWith(this.apiUrl + '/assets/')) {
        safeUrl = safeUrl.replace(this.apiUrl, '');
      }
      if (safeUrl && safeUrl.includes('/assets/')) {
        const idx = safeUrl.indexOf('/assets/');
        safeUrl = safeUrl.substring(idx);
      }
      await firstValueFrom(
        this.http.patch(`${this.apiUrl}/questions/${questionId}/image`, { imageUrl: safeUrl })
      );
      // Mettre à jour localement si besoin
      const question = this.questions.find(q => q.id === questionId);
      if (question) {
        question.imageUrl = safeUrl;
        this.questionsSubject.next(this.questions);
      }
    } catch (error) {
      console.error('[SERVICE] Erreur update imageUrl:', error);
      throw error;
    }
  }

  // Cache pour éviter les logs répétitifs
  private lastStep: QuizStep | null = null;
  
  // AJOUT: Souscription WebSocket persistante pour questions sync
  private questionsSyncSub?: Subscription;

  constructor(
    private http: HttpClient, 
    private persistenceService: GamePersistenceService,
    private websocketTimerService: WebSocketTimerService  // AJOUT: Injection WebSocket service
  ) {
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
  if (this.questionsLoaded) return this.questions;
  return this.loadQuestions();
  }

  // Forcer le rechargement des questions (utilisé après modifications côté gestion)
  async reloadQuestions(): Promise<Question[]> {
  // ...existing code...
  this.questionsLoaded = false;
  this.questions = [];
  this.questionsSubject.next([]); // Vide la liste pour forcer la MAJ
  return this.loadQuestions();
  }

  // Méthode privée pour charger les questions
  private async loadQuestions(): Promise<Question[]> {
    this.questionsLoaded = true;

  // ...existing code...

    try {
      const questions: Question[] = await firstValueFrom(
        this.http.get<Question[]>(`${this.apiUrl}/questions`, {
          headers: this.getHeaders()
        })
      );

  this.questions = questions; // Respecter l'ordre du backend
  this.questionsSubject.next(this.questions);

  // ...existing code...
      
      return this.questions;
    } catch (error) {
      console.error('[SERVICE] Erreur chargement questions:', error);
      this.questions = [];
      this.questionsSubject.next([]);
      return [];
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

  // Synchronisation complète après modifications côté gestion
  async synchronizeAfterChanges(): Promise<void> {
  // ...existing code...
    
    try {
      // 1. Recharger les questions
      const newQuestions = await this.reloadQuestions();
      
      // 2. Reset les réponses si nécessaire (les anciennes réponses peuvent ne plus correspondre)
      await this.resetAllAnswers();
      
      // 3. Notifier tous les composants abonnés
      this.questionsSubject.next(newQuestions);
      
  // ...existing code...
    } catch (error) {
      console.error('[SERVICE] Erreur lors de la synchronisation:', error);
    }
  }

  // Observable : toutes les réponses via polling de l'API
  getAllAnswers$(): Observable<any[]> {
    return interval(8000).pipe(
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
            // Erreur silencieuse pour éviter la pollution de logs
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
    return interval(10000).pipe(
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
    return interval(1500).pipe( // Réduit à 1.5s pour une meilleure réactivité lors des resets
      switchMap(() =>
        this.http.get<any>(`${this.apiUrl}/quiz-state`, {
          headers: this.getHeaders()
        })
      ),
      map((data: any) => {
        const currentStep = data?.step as QuizStep || 'lobby';
        // Log uniquement si l'état a changé (débug réduit)
        if (currentStep !== this.lastStep) {
          // ...existing code...
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

  // Forcer une vérification immédiate de l'état (utile après un reset)
  async forceCheckState(): Promise<QuizStep> {
    try {
      const response = await firstValueFrom(
        this.http.get<any>(`${this.apiUrl}/quiz-state`, {
          headers: this.getHeaders()
        })
      );
      const currentStep = response?.step as QuizStep || 'lobby';
  // ...existing code...
      return currentStep;
    } catch (error) {
      console.error('[SERVICE] Erreur lors du check forcé d\'état:', error);
      return 'lobby';
    }
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

  // Observable : participants via polling (réduit à 6s)
  getParticipants$(): Observable<User[]> {
    // Émettre immédiatement la valeur courante, puis continuer avec le polling
    const immediate = of(this.participants);
    const polling = interval(6000).pipe(
      switchMap(() =>
        this.http.get<User[]>(`${this.apiUrl}/participants`, {
          headers: this.getHeaders()
        })
      ),
      map((users: User[]) => {
        // Eviter les fluctuations : ne pas vider si liste temporairement vide
        if (users.length === 0 && this.participants.length > 0) {
          return this.participants; // Conserver la liste existante
        }
        this.participants = users;
        return users;
      }),
      catchError((error) => {
        console.warn('[SERVICE] Erreur getParticipants, conservation de la liste existante:', error);
        return of(this.participants); // Conserver la liste existante au lieu de tableau vide
      })
    );
    
    return concat(immediate, polling);
  }

  getQuestions() {
    return this.questions;
  }

  // Observable : index de question courante via polling (réduit à 3s)
  getCurrentIndex(): Observable<number> {
    return interval(3000).pipe(
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
    // Log réduit pour éviter la pollution de console
    if (typeof index === 'number') {
      const question = this.questions[index] || null;
      return question;
    }
    return null;
  }

  // Passage à la question suivante
  async nextQuestion(currentIndex: number) {
    const nextIndex = currentIndex + 1;

  // ...existing code...

    try {
      if (nextIndex < this.questions.length) {
        
        // SOLUTION SYNC: Démarrer le timer 3 secondes dans le futur 
        // pour laisser le temps à TOUS les clients de se synchroniser
        const delayMs = 3000; // 3 secondes de délai
        const questionStartTime = Date.now() + delayMs;
        
        const updateData: any = {
          currentQuestionIndex: nextIndex,
          questionStartTime: questionStartTime,
          step: 'question' // TOUJOURS définir le step à 'question' pour toutes les questions
        };
        
  // ...existing code...
        
        const result = await firstValueFrom(
          this.http.put(`${this.apiUrl}/quiz-state`, updateData, {
            headers: this.getHeaders()
          })
        );
  // ...existing code...
      } else {
  // ...existing code...
        await this.setStep('end');
      }
    } catch (error) {
      console.error('[SERVICE] Erreur nextQuestion:', error);
    }
  }

  // Ajout d'un participant
  async addParticipant(user: User) {
    try {
  // ...existing code...
      const response = await firstValueFrom(
        this.http.post(`${this.apiUrl}/participants`, user, {
          headers: this.getHeaders()
        })
      );
  // ...existing code...
      
      // Ajouter le participant à la liste locale
      this.participants.push(user);
  // ...existing code...
      
      // Synchroniser immédiatement avec le serveur pour s'assurer que la liste est à jour
  // ...existing code...
      await this.fetchParticipantsFromServer();
  // ...existing code...
      
      // Sauvegarde automatique des participants
      this.persistenceService.updateGameState({
        participants: this.participants
      });
  // ...existing code...
      
    } catch (error) {
      console.error('[SERVICE] ❌ Erreur addParticipant:', error);
      throw error; // Re-throw pour que le composant puisse gérer l'erreur
    }
  }

  // Soumission d'une réponse
  async submitAnswer(userId: string, answerIndex: number, userName: string, questionIndex: number) {
  // ...existing code...

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
  // ...existing code...
    } catch (error: any) {
      console.error('Erreur submitAnswer:', error);
      
      // ✅ PROTECTION: Gérer le cas où l'utilisateur a déjà voté
      if (error.status === 400 && error.error?.alreadyAnswered) {
  // ...existing code...
        throw new Error('ALREADY_VOTED');
      }
      
      throw error;
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
        return answers;
      }),
      catchError((error) => {
        console.error(`[getAnswers$] Error for question ${questionIndex}:`, error);
        return of([]);
      })
    );
  }

  /**
   * Observable : liste des votants (utilisateurs ayant répondu) pour une question donnée
   */
  getVoters$(questionIndex: number): Observable<{id: any, name: any}[]> {
    return this.getAnswers$(questionIndex).pipe(
      map((answers: any[]) => {
        return answers.map(a => ({
          id: a.userId,
          name: a.userName || a.name || 'Anonyme',
        }));
      })
    );
  }

  /**
   * Observable : nombre de réponses par option pour une question donnée
   */
  getAnswersCount$(questionIndex: number): Observable<number[]> {
    return this.getAnswers$(questionIndex).pipe(
      map((answers: any[]) => {
        const question = this.questions[questionIndex];
        const nbOptions = question?.options?.length || 4;
        const counts = Array(nbOptions).fill(0);
        for (const answer of answers) {
          if (typeof answer.answerIndex === 'number' && answer.answerIndex >= 0 && answer.answerIndex < nbOptions) {
            counts[answer.answerIndex]++;
          }
        }
        return counts;
      })
    );
  }

  // Méthode pour récupérer les réponses d'un utilisateur spécifique
  async getUserAnswers(userId: string): Promise<any[]> {
    try {
      const allAnswers: any[] = [];
      const nbQuestions = this.questions.length;
      if (nbQuestions === 0) {
        console.warn('[RESTORE] Aucune question chargée, impossible de récupérer les réponses');
        return [];
      }
      for (let i = 0; i < nbQuestions; i++) {
        try {
          const response = await firstValueFrom(
            this.http.get<any>(`${this.apiUrl}/answers/${i}`, {
              headers: this.getHeaders()
            })
          );
          const answers = response?.answers ?? [];
          const userAnswer = answers.find((a: any) => String(a.userId) === String(userId));
          if (userAnswer) {
            allAnswers.push({
              questionIndex: i,
              answerIndex: userAnswer.answerIndex,
              timestamp: userAnswer.timestamp
            });
          }
        } catch (questionError) {
          // Log d'erreur conservé
          console.error(`[RESTORE] Erreur question ${i}:`, questionError);
        }
      }
      return allAnswers;
    } catch (error) {
      // Log d'erreur conservé
      console.error('[RESTORE] Erreur récupération réponses utilisateur:', error);
      return [];
    }
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
      questionStartTime: Date.now(),
      participants: [],
      leaderboard: [],
      totalQuestions: this.questions.length,
      gameStartTime: Date.now(),
      lastActivity: Date.now(),
    });
  }
}
       