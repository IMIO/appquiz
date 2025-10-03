import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { TimerState } from './timer.service';
import { environment } from '../../environments/environment';

export interface StepTransitionData {
  fromStep: string;
  toStep: string;
  loadingDuration: number;
  timestamp: number;
}

export interface StepActivationData {
  step: string;
  timestamp: number;
}

export interface QuestionsSyncData {
  timestamp: number;
  action: string;
}

export interface UserScoreData {
  userId: string;
  userName: string;
  score: number;
  questionIndex: number;
  avatarUrl?: string;
  timestamp: number;
}

// Interface pour les messages de reset
export interface QuizResetData {
  timestamp: number;
  action: string;
}

@Injectable({ providedIn: 'root' })
export class WebSocketTimerService {
  private ws: WebSocket | null = null;
  private countdown$: BehaviorSubject<TimerState>;
  private stepTransition$ = new Subject<StepTransitionData>();
  private stepActivation$ = new Subject<StepActivationData>();
  private questionsSync$ = new Subject<QuestionsSyncData>();
  private userScore$ = new Subject<UserScoreData>();
  private userScoreSubject = new Subject<any>();
  private quizReset$ = new Subject<QuizResetData>();
  private currentState: TimerState = {
    timeRemaining: 20,
    timerMax: 20,
    isActive: false,
    questionStartTime: null,
    countdownToStart: 0,
    syncTimestamp: 0,
    step: null  // ✅ AJOUT: Étape initiale
  };
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
  this.countdown$ = new BehaviorSubject<TimerState>(this.currentState);
  this.connect();
  }

  private connect() {
    try {
      // Construction robuste de l'URL WebSocket qui fonctionne en dev et en prod
      let wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let host = window.location.host; // Inclut hostname:port ou domaine
      
      // Utilisation d'une URL simple qui fonctionne en dev et prod
      let wsUrl;
      if (environment.production) {
        // En production: utiliser le même domaine que l'application
        wsUrl = `${wsProtocol}//${host}`;
        console.log('[WS] Mode production: connexion WebSocket sur', wsUrl);
      } else {
        // En développement: utiliser l'URL de l'environnement
        const baseUrl = environment.apiUrl.replace(/\/api$/, '');
        wsUrl = baseUrl.replace(/^http/, 'ws').replace(/^https/, 'wss');
        console.log('[WS] Mode développement: connexion WebSocket sur', wsUrl);
      }
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('[WS] Connexion WebSocket établie avec succès sur', wsUrl);
        this.reconnectAttempts = 0;
      };
      
    // Gestion des messages reçus
    this.ws.addEventListener('message', (event: any) => {
      const rawData = JSON.parse(event.data);
  // ...existing code...
      
      // Les messages peuvent avoir une structure imbriquée, normalisons
      let data = rawData;
      let messageType = rawData.type;
      
      // Si le message a une structure imbriquée {type: X, data: {type: X, data: Y}}
      if (rawData.data && rawData.data.type && rawData.data.type === rawData.type) {
        data = rawData.data;
        messageType = rawData.data.type;
  // ...existing code...
      }
      
  // ...existing code...
      
      switch (messageType) {
        case 'timer-update':
          this.handleTimerUpdate(data);
          break;
        case 'step-transition':
          this.handleStepTransition(data);
          break;
        case 'step-activation':
          this.handleStepActivation(data);
          break;
        case 'questions-sync':
          // ...existing code...
          this.handleQuestionsSync(data);
          break;
        case 'user-score':
          this.handleUserScore(data);
          break;
        case 'quiz-reset':
          // CORRECTION: Ajouter la gestion du message de reset
          this.handleQuizReset(data);
          break;
        default:
          // ...existing code...
      }
    });      this.ws.onclose = () => {
  // ...existing code...
        this.scheduleReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('❌ Erreur WebSocket:', error);
      };
      
    } catch (error) {
      console.error('❌ Erreur connexion WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      console.log(`[WS] Tentative de reconnexion ${this.reconnectAttempts}/${this.maxReconnectAttempts} dans ${delay}ms...`);
      setTimeout(() => this.connect(), delay);
    } else {
      console.error('❌ Impossible de reconnect WebSocket après', this.maxReconnectAttempts, 'tentatives');
      console.log('[WS] Basculement en mode de secours (polling HTTP)');
      
      // Activer un mode de secours en utilisant le polling HTTP toutes les 2 secondes
      // au lieu des WebSockets
      setInterval(() => {
        this.pollTimerState();
      }, 2000);
    }
  }
  
  // Mode de secours : polling HTTP pour récupérer l'état du timer
  private pollTimerState() {
    fetch('/api/quiz-state')
      .then(response => response.json())
      .then(data => {
        // Simuler une mise à jour du timer comme si c'était un message WebSocket
        if (data) {
          const timerData = {
            timeRemaining: data.timeRemaining || data.preciseTimeRemaining || 0,
            timerMax: data.timerMax || 20,
            isActive: data.isTimerActive || false,
            questionStartTime: data.questionStartTime || null,
            countdownToStart: data.countdownToStart || 0,
            step: data.step || null,
            syncTimestamp: Date.now()
          };
          
          this.handleTimerUpdate({data: timerData});
          console.log('[WS-FALLBACK] État du timer récupéré via HTTP:', timerData.timeRemaining + 's');
        }
      })
      .catch(error => {
        console.error('[WS-FALLBACK] Erreur polling timer:', error);
      });
  }

  private handleTimerUpdate(data: any) {
    // Extraire les données du timer selon la structure serveur
    // Structure peut être: data.data (imbriquée) ou data (directe)
    let timerData = data;
    if (data.data && typeof data.data === 'object') {
      timerData = data.data;
    }
    
  // ...existing code...
    
    this.currentState = {
      timeRemaining: timerData.timeRemaining ?? 0,
      timerMax: timerData.timerMax ?? 20,
      isActive: timerData.isActive ?? timerData.isTimerActive ?? timerData.active ?? false,
      questionStartTime: timerData.questionStartTime ?? null,
      countdownToStart: timerData.countdownToStart ?? 0,
      step: timerData.step ?? null,  // ✅ AJOUT: Extraire le step du serveur
      syncTimestamp: Date.now()
    };
    
    this.countdown$.next({ ...this.currentState });
    
    // ...existing code...
    
    if (this.currentState.countdownToStart && this.currentState.countdownToStart > 0) {
      // ...existing code...
    } else {
      // ...existing code...
    }
  }

  getCountdown() {
    return this.countdown$.asObservable();
  }

  getCurrentState(): TimerState {
    return { ...this.currentState };
  }

  private handleStepTransition(data: StepTransitionData) {
  // ...existing code...
    this.stepTransition$.next(data);
  }

  private handleStepActivation(data: StepActivationData) {
  // ...existing code...
    this.stepActivation$.next(data);
  }

  private handleQuestionsSync(data: QuestionsSyncData) {
  // ...existing code...
    this.questionsSync$.next(data);
  }
  
  private handleUserScore(message: any): void {
    console.log('[WS] Score utilisateur reçu:', message);
    try {
      // Vérifier que le message est correctement formaté
      if (message && message.data && (message.data.userId || message.data.id) && message.data.score !== undefined) {
        // Émission du message via le Subject
        this.userScoreSubject.next(message);
        console.log('[WS] Score transmis au composant:', message.data.userId || message.data.id, ':', message.data.score);
      } else {
        console.warn('[WS] Format de message de score invalide:', message);
      }
    } catch (error) {
      console.error('[WS] Erreur lors du traitement du score:', error);
    }
  }
  
  // CORRECTION: Ajouter la gestion du message de reset du quiz
  private handleQuizReset(data: any) {
    console.log('[WS] Message de reset du quiz reçu:', data);
    // Créer un sujet pour les messages de reset si nécessaire
    if (!this.quizReset$) {
      this.quizReset$ = new Subject<any>();
    }
    this.quizReset$.next(data);
    
    // Nettoyer également tous les caches locaux
    try {
      localStorage.removeItem('presentation_participants_cache');
      localStorage.removeItem('leaderboard_cache');
      localStorage.removeItem('presentation_leaderboard_cache');
      localStorage.removeItem('quiz_player_state');
      console.log('[WS] Caches locaux nettoyés suite à un reset du quiz');
    } catch (e) {
      console.warn('[WS] Erreur lors du nettoyage des caches locaux:', e);
    }
  }

  getStepTransitions() {
    return this.stepTransition$.asObservable();
  }

  getStepActivations() {
    return this.stepActivation$.asObservable();
  }

  getQuestionsSync() {
    return this.questionsSync$.asObservable();
  }
  
  getUserScores(): Observable<any> {
    return this.userScoreSubject.asObservable().pipe(
      map(message => {
        // Si le message est de type 'user-score', extraire directement les données
        if (message && message.type === 'user-score' && message.data) {
          console.log('[WS] Message de score formaté:', message.data);
          return message.data;
        }
        // Sinon, renvoyer le message tel quel
        return message;
      })
    );
  }
  
  // CORRECTION: Méthode pour récupérer les messages de reset
  getQuizResets() {
    return this.quizReset$.asObservable();
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
  
  // CORRECTION: Méthode pour envoyer le score d'un utilisateur via WebSocket
  sendUserScore(scoreData: UserScoreData): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WS-SCORE] WebSocket non connecté, impossible d\'envoyer le score');
      return;
    }
    
    try {
      const message = {
        type: 'user-score',
        data: scoreData
      };
      
      this.ws.send(JSON.stringify(message));
      console.log('[WS-SCORE] Score envoyé avec succès:', scoreData.score);
    } catch (error) {
      console.error('[WS-SCORE] Erreur envoi score:', error);
    }
  }
}