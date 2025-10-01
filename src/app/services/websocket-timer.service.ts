import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
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

@Injectable({ providedIn: 'root' })
export class WebSocketTimerService {
  private ws: WebSocket | null = null;
  private countdown$: BehaviorSubject<TimerState>;
  private stepTransition$ = new Subject<StepTransitionData>();
  private stepActivation$ = new Subject<StepActivationData>();
  private questionsSync$ = new Subject<QuestionsSyncData>();
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
      // Construire l'URL WebSocket à partir de l'apiUrl d'environnement (pas de référence à localhost)
      const baseUrl = environment.apiUrl.replace(/\/api$/, ''); // Retirer /api si présent
      const wsUrl = baseUrl.replace(/^http/, 'ws').replace(/^https/, 'wss');
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
  // ...existing code...
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
  // ...existing code...
      setTimeout(() => this.connect(), delay);
    } else {
      console.error('❌ Impossible de reconnect WebSocket après', this.maxReconnectAttempts, 'tentatives');
    }
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

  getStepTransitions() {
    return this.stepTransition$.asObservable();
  }

  getStepActivations() {
    return this.stepActivation$.asObservable();
  }

  getQuestionsSync() {
    return this.questionsSync$.asObservable();
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}