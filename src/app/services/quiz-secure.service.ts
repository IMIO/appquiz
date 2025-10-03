import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom, interval, timer, concat, Subscription } from 'rxjs';
import { map, switchMap, catchError, distinctUntilChanged, tap } from 'rxjs/operators';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Question } from '../models/question.model';
import { User } from '../models/user.model';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { GamePersistenceService } from './game-persistence.service';
import { LeaderboardCacheService } from './leaderboard-cache.service';
import { WebSocketTimerService } from './websocket-timer.service';
// Import du nouveau service de nettoyage de cache
import { CacheCleanerService } from './cache-cleaner.service';

export type QuizStep = 'lobby' | 'waiting' | 'question' | 'result' | 'end';

@Injectable({ providedIn: 'root' })
export class QuizService {
  public participants: User[] = [];
  private questions: Question[] = [];
  private questionsSubject = new BehaviorSubject<Question[]>([]);
  public questions$ = this.questionsSubject.asObservable();
  
  // Subject pour notifier les composants lors d'un reset explicite des participants
  private participantsResetSubject = new BehaviorSubject<boolean>(false);
  public participantsReset$ = this.participantsResetSubject.asObservable();
  
  // Indicateurs de reset permettant d'accepter une liste vide légitime après un reset serveur
  private resetGracePeriodUntil = 0; // timestamp jusqu'auquel une liste vide est considérée comme valide
  private lastResetTimestamp = 0; // debug / traçabilité

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
    private leaderboardCacheService: LeaderboardCacheService,
    public websocketTimerService: WebSocketTimerService,
    // Injecter le service de nettoyage de cache
    private cacheCleaner: CacheCleanerService
  ) {}
  
  // Headers standard (pas d'authentification requise avec SQLite)
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json'
    });
  }
  
  /**
   * Accès public au service WebSocketTimer
   * Pour éviter l'utilisation de ['websocketTimerService']
   */
  getWebSocketTimerService(): WebSocketTimerService {
    return this.websocketTimerService;
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

    try {
      console.log('[SERVICE] Chargement des questions depuis l\'API...');
      const questions: Question[] = await firstValueFrom(
        this.http.get<Question[]>(`${this.apiUrl}/questions`, {
          headers: this.getHeaders()
        })
      );

      // Log pour débogage
      console.log('[SERVICE] Questions chargées:', questions.length);
      
      // Vérifier les données des questions pour débogage
      questions.forEach((q, idx) => {
        // Afficher les informations sur chaque question
        console.log(`[SERVICE] Question ${idx} (id=${q.id}): ${q.text?.substring(0, 30)}... correctIndex=${q.correctIndex}`);
        
        // CORRECTION : Vérification que les IDs des questions correspondent à leur index
        // Si ce n'est pas le cas, émettre un avertissement car cela peut causer des problèmes de score
        if (q.id !== idx) {
          console.warn(`[SERVICE] ⚠️ ATTENTION: Incohérence détectée - La question à l'index ${idx} a l'ID ${q.id}. Cela peut causer des problèmes de calcul de score.`);
        }
        
        // Vérification que correctIndex est bien défini et valide
        if (q.correctIndex === undefined || q.correctIndex === null) {
          console.warn(`[SERVICE] ⚠️ ATTENTION: La question à l'index ${idx} (id=${q.id}) n'a pas de correctIndex défini.`);
        } else if (q.options && (q.correctIndex < 0 || q.correctIndex >= q.options.length)) {
          console.warn(`[SERVICE] ⚠️ ATTENTION: La question à l'index ${idx} (id=${q.id}) a un correctIndex (${q.correctIndex}) hors limites (0-${q.options.length - 1}).`);
        }
      });

      // CORRECTION : Normaliser les questions pour garantir la cohérence des données
      const normalizedQuestions = questions.map(q => {
        // S'assurer que correctIndex est un nombre
        const correctIndex = typeof q.correctIndex === 'string' ? parseInt(q.correctIndex) : Number(q.correctIndex);
        
        // S'assurer que l'ID est un nombre (important pour les comparaisons)
        const id = typeof q.id === 'string' ? parseInt(q.id) : Number(q.id);
        
        return {
          ...q,
          id,
          correctIndex,
          // Ajouter une propriété originIndex pour conserver l'index d'origine
          // utile pour déboguer les problèmes d'incohérence
          originIndex: q.originIndex !== undefined ? q.originIndex : id
        };
      });
      
      // Créer un mapping entre les IDs et les indices pour aider à débugguer
      const idToIndexMap = new Map();
      normalizedQuestions.forEach((q, idx) => {
        idToIndexMap.set(q.id, idx);
      });
      console.log('[SERVICE] Mapping des IDs aux indices:', Object.fromEntries(idToIndexMap));

      this.questions = normalizedQuestions; // Respecter l'ordre du backend avec correctIndex normalisé
      this.questionsSubject.next(this.questions);
      
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

  // Observable : toutes les réponses via polling de l'API - VERSION ROBUSTE
  getAllAnswers$(): Observable<any[]> {
    return interval(8000).pipe(
      switchMap(async () => {
        const nbQuestions = this.questions.length;
        console.log(`[SERVICE] getAllAnswers$ - 📊 Récupération des réponses pour ${nbQuestions} questions`);
        const allAnswersDocs: any[] = [];

        // Vérifier que nous avons bien chargé des questions
        if (nbQuestions === 0) {
          console.warn('[SERVICE] getAllAnswers$ - ⚠️ Aucune question chargée');
          return [];
        }

        // AMÉLIORATION: Créer un mapping entre ID et index pour gérer les discordances
        const questionIdToIndexMap = new Map<number, number>();
        this.questions.forEach((q, idx) => {
          if (q && q.id !== undefined) {
            questionIdToIndexMap.set(Number(q.id), idx);
            // Si l'ID est différent de l'index, on le note pour diagnostic
            if (q.id !== idx) {
              console.log(`[SERVICE] getAllAnswers$ - ℹ️ Question à l'index ${idx} a l'ID=${q.id}`);
            }
          }
        });

        // Pour chaque question, récupérer les réponses - PAR INDEX
        for (let idx = 0; idx < nbQuestions; idx++) {
          try {
            const currentQuestion = this.questions[idx];
            const questionId = currentQuestion?.id;
            
            // Log de diagnostic pour le mapping index <-> ID
            if (questionId !== undefined && questionId !== idx) {
              console.log(`[SERVICE] getAllAnswers$ - 🔍 Récupération réponses pour Q${idx} (ID=${questionId})`);
            }
            
            // Requête par index pour récupérer les réponses
            const response: any = await firstValueFrom(
              this.http.get(`${this.apiUrl}/answers/${idx}`, {
                headers: this.getHeaders()
              })
            );
            
            // Vérifier si les réponses sont valides
            const answers = response.answers || [];
            
            // Normaliser les réponses pour garantir que answerIndex est un nombre
            const normalizedAnswers = answers.map((ans: any) => ({
              ...ans,
              // Convertir explicitement answerIndex en nombre
              answerIndex: typeof ans.answerIndex === 'string' ? 
                            parseInt(ans.answerIndex) : 
                            Number(ans.answerIndex)
            }));
            
            // Log uniquement s'il y a des réponses pour réduire la verbosité
            if (normalizedAnswers.length > 0) {
              console.log(`[SERVICE] Question ${idx} (ID=${questionId}): ${normalizedAnswers.length} réponses reçues`);
              
              // Log détaillé pour quelques réponses uniquement
              if (idx === 0) {
                normalizedAnswers.slice(0, 2).forEach((ans: any, i: number) => {
                  console.log(`[SERVICE] Exemple réponse ${i} pour Q${idx} (ID=${questionId}): userId=${ans.userId}, answerIndex=${ans.answerIndex}`);
                });
              }
            }
            
            // AMÉLIORATION: Stocker à la fois l'ID et l'index pour une recherche flexible
            allAnswersDocs.push({
              id: idx,                    // Pour compatibilité avec l'accès par index
              questionId: questionId,     // Pour permettre l'accès par ID de question
              index: idx,                 // Index explicite pour clarté
              answers: normalizedAnswers
            });
            
            // AMÉLIORATION: Si l'ID est différent de l'index, ajouter une deuxième entrée pour la recherche par ID
            if (questionId !== undefined && questionId !== idx) {
              allAnswersDocs.push({
                id: questionId,           // Pour compatibilité avec l'accès par ID
                questionId: questionId,   // ID explicite pour clarté
                index: idx,               // Index d'origine pour référence
                answers: normalizedAnswers,
                isDuplicate: true         // Marqueur pour indiquer que c'est une entrée dupliquée
              });
              console.log(`[SERVICE] getAllAnswers$ - ✅ Entrée dupliquée ajoutée pour Q${idx} (ID=${questionId})`);
            }
            
          } catch (error) {
            console.warn(`[SERVICE] getAllAnswers$ - ❌ Erreur pour question ${idx}:`, error);
            
            // En cas d'erreur, ajouter quand même une entrée vide pour maintenir la correspondance
            const currentQuestion = this.questions[idx];
            const questionId = currentQuestion?.id;
            
            allAnswersDocs.push({
              id: idx,
              questionId: questionId,
              index: idx,
              answers: [],
              error: true
            });
          }
        }

        // Vérifier rapidement toutes les réponses
        const totalResponses = allAnswersDocs.reduce((sum, doc) => sum + doc.answers.length, 0);
        if (totalResponses > 0) {
          console.log(`[SERVICE] getAllAnswers$ - Total de ${totalResponses} réponses récupérées`);
        }

        return allAnswersDocs;
      }),
      catchError((err) => {
        console.error('[SERVICE] Erreur dans getAllAnswers$:', err);
        return of([]);
      })
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
    return interval(2000).pipe( // 2s offre un bon équilibre entre réactivité et charge serveur
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
    console.log(`[SERVICE] setStep: Tentative de passage à l'étape "${step}"`);
    try {
      const response = await firstValueFrom(
        this.http.put(`${this.apiUrl}/quiz-state`, { step }, {
          headers: this.getHeaders()
        })
      );
      console.log(`[SERVICE] setStep: Passage à l'étape "${step}" réussi`, response);
      
      // Mise à jour immédiate de la variable lastStep pour éviter les problèmes de détection
      this.lastStep = step;
      
      // Sauvegarde automatique après changement d'étape (sauf pour lobby)
      if (step !== 'lobby') {
        this.persistenceService.updateGameState({
          step,
          currentQuestionIndex: 0, // Reset index pour nouvelles étapes
          questionStartTime: step === 'question' ? Date.now() : undefined
        });
      }
      
      // Vérification immédiate pour confirmer le changement d'état
      setTimeout(async () => {
        const state = await this.forceCheckState();
        console.log(`[SERVICE] setStep: Vérification après transition, état actuel = "${state}", attendu = "${step}"`);
      }, 500);
      
      return true; // Retourne true pour confirmation
    } catch (error) {
      console.error('[SERVICE] Erreur setStep:', error);
      return false; // Retourne false en cas d'erreur
    }
  }

  setQuestions(qs: Question[]) {
    this.questions = qs;
    this.questionsSubject.next(this.questions);
  }

  getParticipants(): User[] {
    return this.participants;
  }
  
  // Méthode explicite pour forcer le vidage du cache des participants
  // et signaler aux abonnés que la liste doit être considérée comme vide
  clearParticipantsCache(): void {
    console.log('[SERVICE] Vidage explicite du cache des participants');
    this.participants = [];
    try {
      localStorage.removeItem('presentation_participants_cache');
    } catch (e) {
      console.warn('[SERVICE] Erreur lors du vidage du cache:', e);
    }
    this.participantsResetSubject.next(true);
  }

  // Récupérer les participants directement du serveur (pour synchronisation)
  async fetchParticipantsFromServer(): Promise<User[]> {
    try {
      console.log('[SERVICE] Récupération des participants du serveur...');
      
      // Tenter de récupérer les participants depuis le cache local en premier
      let cachedParticipants: User[] = [];
      try {
        const cachedParticipantsStr = localStorage.getItem('presentation_participants_cache');
        if (cachedParticipantsStr) {
          const parsedCache = JSON.parse(cachedParticipantsStr);
          if (Array.isArray(parsedCache) && parsedCache.length > 0) {
            cachedParticipants = parsedCache;
            console.log(`[SERVICE] ${cachedParticipants.length} participants trouvés dans le cache local`);
          }
        }
      } catch (cacheError) {
        console.warn('[SERVICE] Erreur lors de la lecture du cache des participants:', cacheError);
      }
      
      // Utiliser timeout pour éviter de bloquer trop longtemps en cas de problème réseau
      const timeoutPromise = new Promise<User[]>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout récupération participants')), 10000);
      });
      
      const fetchPromise = firstValueFrom(
        this.http.get<User[]>(`${this.apiUrl}/participants`, {
          headers: this.getHeaders()
        })
      );
      
      // Utiliser la promesse qui se résout en premier
      let response;
      try {
        response = await Promise.race([fetchPromise, timeoutPromise]);
      } catch (raceError) {
        console.warn('[SERVICE] Erreur lors de la course de promesses:', raceError);
        
        // En cas d'erreur, essayer d'utiliser la promesse de fetch directement
        // (au cas où l'erreur provienne du timeout et que le fetch puisse quand même réussir)
        try {
          console.log('[SERVICE] Tentative directe de récupération après erreur...');
          response = await firstValueFrom(
            this.http.get<User[]>(`${this.apiUrl}/participants`, {
              headers: this.getHeaders()
            })
          );
        } catch (directError) {
          console.error('[SERVICE] Échec de la tentative directe:', directError);
          
          // Retourner la liste existante ou le cache
          if (this.participants.length > 0) {
            console.log('[SERVICE] Conservation de la liste existante après échec:', this.participants.length);
            return [...this.participants];
          } else if (cachedParticipants.length > 0) {
            console.log('[SERVICE] Utilisation du cache après échec:', cachedParticipants.length);
            this.participants = [...cachedParticipants];
            return this.participants;
          }
          return [];
        }
      }
      
      // Gestion des réponses nulles/undefined
      if (response === null || response === undefined) {
        console.log('[SERVICE] Réponse nulle ou indéfinie du serveur pour les participants');
        
        // Vérifier d'abord si nous sommes en période de grâce après un reset
        const now = Date.now();
        const inGrace = now < this.resetGracePeriodUntil;
        
        // MODIFICATION: Pendant ou après une période de grâce, accepter les listes vides comme légitimes
        // Cela empêche la réapparition des participants fantômes
        if (inGrace) {
          // Pendant la période de grâce: accepter la liste vide comme légitime
          console.log('[SERVICE] En période de grâce après reset: acceptation de la liste vide');
          this.participants = [];
          try { 
            // Nettoyer TOUS les caches liés aux participants
            localStorage.removeItem('presentation_participants_cache');
            localStorage.removeItem('leaderboard_cache');
            localStorage.removeItem('presentation_leaderboard_cache');
            console.log('[SERVICE] Tous les caches de participants supprimés');
          } catch (e) {
            console.error('[SERVICE] Erreur lors de la suppression des caches:', e);
          }
          return [];
        }
        
        // MODIFICATION: Même hors période de grâce, on considère une réponse null/undefined comme 
        // une liste potentiellement vide légitime pour éviter les participants fantômes
        console.log('[SERVICE] Hors période de grâce mais réponse nulle considérée comme potentiellement légitime');
        this.participants = [];
        try { 
          localStorage.removeItem('presentation_participants_cache');
          console.log('[SERVICE] Cache des participants supprimé (hors période de grâce)');
        } catch {}
        return [];
      }
      
      if (Array.isArray(response)) {
        // Gestion spécifique si la réponse est vide
        if (response.length === 0) {
          const now = Date.now();
          const inGrace = now < this.resetGracePeriodUntil;
          console.log('[SERVICE] Liste vide reçue du serveur (gracePeriod actif? ', inGrace, ')');
          
          // MODIFICATION: Accepter TOUJOURS une liste vide comme légitime
          // C'est la façon la plus sûre d'éviter les participants fantômes
          console.log('[SERVICE] Une liste vide du serveur est toujours considérée comme légitime');
          this.participants = [];
          
          try { 
            // Nettoyer TOUS les caches liés aux participants
            localStorage.removeItem('presentation_participants_cache');
            localStorage.removeItem('leaderboard_cache');
            localStorage.removeItem('presentation_leaderboard_cache');
            console.log('[SERVICE] Tous les caches de participants supprimés suite à une liste vide légitime');
          } catch (e) {
            console.error('[SERVICE] Erreur lors de la suppression des caches:', e);
          }
          
          return [];
        }
        // Réponse non vide -> adoption directe
        console.log('[SERVICE] Participants récupérés du serveur:', response.length);
        this.participants = response;
        try { localStorage.setItem('presentation_participants_cache', JSON.stringify(this.participants)); } catch {}
      } else {
        console.warn('[SERVICE] Format invalide de la réponse du serveur');
        
        // Stratégie de fallback
        if (this.participants.length > 0) {
          return [...this.participants];
        } else if (cachedParticipants.length > 0) {
          console.log('[SERVICE] Utilisation du cache après format invalide:', cachedParticipants.length);
          this.participants = [...cachedParticipants];
          return this.participants;
        }
      }
      
      return this.participants;
    } catch (error) {
      console.error('[SERVICE] Erreur récupération participants du serveur:', error);
      
      // Ne pas vider la liste en cas d'erreur temporaire
      if (this.participants.length > 0) {
        return [...this.participants];
      }
      
      // Essayer de récupérer depuis le cache en dernier recours
      try {
        const cachedParticipantsStr = localStorage.getItem('presentation_participants_cache');
        if (cachedParticipantsStr) {
          const cachedParticipants = JSON.parse(cachedParticipantsStr);
          if (Array.isArray(cachedParticipants) && cachedParticipants.length > 0) {
            console.log(`[SERVICE] Utilisation du cache en dernier recours: ${cachedParticipants.length} participants`);
            this.participants = [...cachedParticipants];
            return this.participants;
          }
        }
      } catch (cacheError) {
        console.warn('[SERVICE] Erreur lors de la récupération du cache en dernier recours:', cacheError);
      }
      
      return [];
    }
  }

  // Observable : participants via polling (réduit à 6s)
  getParticipants$(): Observable<User[]> {
    // Émettre immédiatement la valeur courante, puis continuer avec le polling
    const immediate = of(this.participants);
    console.log('[SERVICE] getParticipants$ - Émission immédiate:', this.participants.length, 'participants');
    
    const polling = interval(6000).pipe(
      switchMap(() => {
        console.log('[SERVICE] getParticipants$ - Requête HTTP pour participants...');
        return this.http.get<User[]>(`${this.apiUrl}/participants`, {
          headers: this.getHeaders()
        });
      }),
      map((users: User[]) => {
        const now = Date.now();
        const inGrace = now < this.resetGracePeriodUntil;
        console.log('[SERVICE] getParticipants$ - Réponse HTTP:', users.length, 'participants reçus');
        
        if (users.length === 0) {
          if (inGrace) {
            // Pendant la période de grâce après reset -> propager liste vide
            console.log('[SERVICE] getParticipants$ - En période de grâce: acceptation de la liste vide');
            this.participants = [];
            try { localStorage.removeItem('presentation_participants_cache'); } catch {}
            return [];
          }
          // Hors grâce: comportement précédent (prévenir clignotement)
          if (this.participants.length > 0) {
            console.log('[SERVICE] getParticipants$ - Hors période de grâce: conservation ancienne liste:', this.participants.length);
            return this.participants;
          }
          console.log('[SERVICE] getParticipants$ - Aucun participant côté serveur ni en local');
          return [];
        }
        // Réponse non vide -> adoption directe
        console.log('[SERVICE] getParticipants$ - Mise à jour liste avec', users.length, 'participants:', users.map(u => u.name).join(', '));
        this.participants = users;
        return this.participants;
      }),
      catchError((error) => {
        // Vérifier si nous sommes en période de grâce après un reset
        const now = Date.now();
        const inGrace = now < this.resetGracePeriodUntil;
        if (inGrace) {
          // Pendant la période de grâce: accepter la liste vide comme légitime même en cas d'erreur
          console.log('[SERVICE] getParticipants$ - Erreur mais en période de grâce après reset: vider liste');
          this.participants = [];
          try { localStorage.removeItem('presentation_participants_cache'); } catch {}
          return of([]);
        }
        
        console.warn('[SERVICE] Erreur getParticipants, conservation de la liste existante:', error);
        return of(this.participants); // Conserver la liste existante au lieu de tableau vide (hors période de grâce)
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
    // Vérification approfondie de l'index et des questions
    if (typeof index !== 'number') {
      console.log('[SERVICE] getCurrentQuestion: index non numérique fourni:', index);
      return null;
    }
    
    // CORRECTION MAJEURE: Stratégie de recherche améliorée en 3 étapes
    
    // ÉTAPE 1: Essayer de trouver la question par son index dans le tableau
    const questionByIndex = this.questions[index] || null;
    
    // ÉTAPE 2: Si non trouvée, essayer par l'ID exact
    const questionById = this.questions.find(q => q.id === index);
    
    // ÉTAPE 3: Si toujours rien, recherche approximative par ID proche
    let questionByApprox = null;
    if (!questionByIndex && !questionById && (index < 0 || index >= this.questions.length)) {
      questionByApprox = this.questions.find(q => Math.abs(q.id - index) < 2);
    }
    
    // Décision et journalisation détaillée
    if (questionByIndex) {
      // Vérifier si l'ID correspond à l'index (pour débogage)
      if (questionByIndex.id !== index) {
        console.log(`[SERVICE] Question trouvée à l'index ${index}, mais son ID=${questionByIndex.id} est différent (⚠️ potentiel problème de score)`);
        
        // CORRECTION: Normaliser correctIndex pour s'assurer qu'il s'agit d'un nombre
        if (typeof questionByIndex.correctIndex === 'string') {
          questionByIndex.correctIndex = parseInt(questionByIndex.correctIndex);
        }
      } else {
        console.log(`[SERVICE] Question trouvée à l'index ${index}, ID=${questionByIndex.id} (cohérent)`); 
      }
      return questionByIndex;
    } 
    
    if (questionById) {
      console.log(`[SERVICE] Question trouvée via son ID=${index}, à la position ${this.questions.indexOf(questionById)} du tableau`);
      return questionById;
    }
    
    if (questionByApprox) {
      console.log(`[SERVICE] Index ${index} invalide mais question avec ID similaire trouvée: ${questionByApprox.id} à la position ${this.questions.indexOf(questionByApprox)}`);
      return questionByApprox;
    }
    
    // Aucune question trouvée
    console.log(`[SERVICE] Aucune question trouvée pour l'index ou ID ${index} (ni par approximation)`);
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
      console.log('[SERVICE] Ajout participant:', user.name, user.id);
      
      // Vérifier si l'utilisateur existe déjà
      const existingParticipants = await this.fetchParticipantsFromServer();
      const userExists = existingParticipants.some(p => p.id === user.id);
      
      if (userExists) {
        console.log('[SERVICE] L\'utilisateur existe déjà:', user.id);
        return; // Ne pas ajouter de nouveau si l'utilisateur existe déjà
      }
      
      // Effectuer une requête POST pour ajouter le participant
      const response = await firstValueFrom(
        this.http.post(`${this.apiUrl}/participants`, user, {
          headers: this.getHeaders()
        })
      );
      
      console.log('[SERVICE] Réponse du serveur pour addParticipant:', response);
      
      // Ajouter le participant à la liste locale
      const userIndex = this.participants.findIndex(p => p.id === user.id);
      if (userIndex === -1) {
        this.participants.push(user);
      } else {
        // Remplacer l'utilisateur existant si trouvé
        this.participants[userIndex] = user;
      }
      
      // Synchroniser immédiatement avec le serveur pour s'assurer que la liste est à jour
      await this.fetchParticipantsFromServer();
      
      // Vérifier une dernière fois que l'utilisateur a bien été ajouté
      const updatedParticipants = await this.fetchParticipantsFromServer();
      const userAdded = updatedParticipants.some(p => p.id === user.id);
      
      if (!userAdded) {
        console.warn('[SERVICE] L\'utilisateur n\'apparaît pas dans la liste après ajout:', user.id);
      } else {
        console.log('[SERVICE] ✅ Utilisateur correctement ajouté et vérifié:', user.id);
      }
      
      // Sauvegarde automatique des participants
      this.persistenceService.updateGameState({
        participants: this.participants
      });
      
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
        // CORRECTION : Trouver la question soit par index, soit par ID
        let question: Question | undefined = this.questions[questionIndex];
        
        // Si la question n'est pas trouvée par index, essayer de la trouver par ID
        if (!question) {
          console.log(`[SERVICE] getAnswersCount$ - Question non trouvée à l'index ${questionIndex}, recherche par ID...`);
          const questionById = this.questions.find(q => q.id === questionIndex);
          
          if (questionById) {
            console.log(`[SERVICE] getAnswersCount$ - Question trouvée par ID ${questionIndex} plutôt que par index`);
            question = questionById;
          } else {
            console.warn(`[SERVICE] getAnswersCount$ - Aucune question trouvée pour index/ID ${questionIndex}`);
            
            // Recherche plus flexible: essayer de trouver une question avec un ID proche
            const closestQuestion = this.questions.find(q => Math.abs(q.id - questionIndex) < 2);
            if (closestQuestion) {
              console.log(`[SERVICE] getAnswersCount$ - Question approximative trouvée: index/ID ${questionIndex} -> ID ${closestQuestion.id}`);
              question = closestQuestion;
            } else {
              console.error(`[SERVICE] getAnswersCount$ - Impossible de trouver une question proche de index/ID ${questionIndex}`);
              return Array(4).fill(0); // Retourner un tableau vide par défaut
            }
          }
        }
        
        const nbOptions = question?.options?.length || 4;
        const counts = Array(nbOptions).fill(0);
        
        // Log détaillé pour débogage
        console.log(`[SERVICE] getAnswersCount$ - Question ${questionIndex} (ID=${question.id}): ${answers.length} réponses`);
        
        for (const answer of answers) {
          // CORRECTION : Normalisation des types pour garantir que answerIndex est un nombre
          let answerIdx: number;
          if (typeof answer.answerIndex === 'string') {
            answerIdx = parseInt(answer.answerIndex);
          } else {
            answerIdx = Number(answer.answerIndex);
          }
          
          // Vérification plus robuste
          if (!isNaN(answerIdx) && answerIdx >= 0 && answerIdx < nbOptions) {
            counts[answerIdx]++;
            
            // Log pour les premières réponses uniquement (limiter la verbosité)
            if (counts[answerIdx] <= 3) {
              console.log(`[SERVICE] getAnswersCount$ - Q${questionIndex} (ID=${question.id}): answerIdx=${answerIdx} (type original: ${typeof answer.answerIndex})`);
            }
          }
        }
        
        // Log du résultat final
        if (answers.length > 0) {
          console.log(`[SERVICE] getAnswersCount$ - Q${questionIndex}: Résultat final counts=${JSON.stringify(counts)}`);
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
      // MODIFICATION: Utiliser le service dédié pour nettoyer TOUS les caches liés aux participants
      try {
        // Nettoyage silencieux (pas d'alerte) car nous sommes dans une méthode interne
        this.cacheCleaner.cleanAllParticipantCaches(true);
        
        // Utiliser également la méthode dédiée du service de leaderboard pour nettoyer son cache
        this.leaderboardCacheService.clearAllCaches();
        
        console.log('[SERVICE] Reset participants - ✅ Tous les caches ont été effacés via CacheCleanerService');
      } catch (e) {
        console.warn('[SERVICE] Impossible de supprimer les caches avant reset:', e);
      }
      
      // Vider la liste locale AVANT l'appel API
      this.participants = [];
      
      console.log('[SERVICE] Reset participants - Appel API /quiz/reset...');
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/quiz/reset`, {}, {
          headers: this.getHeaders()
        })
      );
      console.log('[SERVICE] Reset participants - ✅ API appelée avec succès');
      
      // Accepter explicitement une liste vide dans les prochaines secondes
      this.lastResetTimestamp = Date.now();
      this.resetGracePeriodUntil = this.lastResetTimestamp + 30000; // 30s de fenêtre d'acceptation des listes vides (augmentée)
      
      // Émettre un événement de reset explicite
      this.participantsResetSubject.next(true);
      
      console.log('[SERVICE] Reset participants - Liste locale vidée + fenêtre d\'acceptation des listes vides ouverte (15s)');
      
      await this.setStep('lobby');
      console.log('[SERVICE] Reset participants - ✅ Étape lobby définie');
      
      // Effacer la sauvegarde lors du reset
      this.persistenceService.clearSavedGameState();
      console.log('[SERVICE] Reset participants - ✅ Sauvegarde effacée');
      
      // Reset de nouveau la liste après un court délai pour garantir la propagation
      setTimeout(() => {
        this.participants = [];
        this.participantsResetSubject.next(true);
        console.log('[SERVICE] Deuxième signal de reset des participants après délai');
      }, 500);
      
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
  
  // Exposer l'accès aux informations de sauvegarde
  getSaveInfo() {
    return this.persistenceService.getSaveInfo();
  }
  
  // Récupérer l'état du serveur
  async getServerState(): Promise<{step: string, currentQuestionIndex: number} | null> {
    try {
      const response = await firstValueFrom(
        this.http.get<{step: string, currentQuestionIndex: number}>(`${this.apiUrl}/quiz-state`, {
          headers: this.getHeaders()
        })
      );
      return response;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération de l\'\u00e9tat du serveur:', error);
      return null;
    }
  }
}
       