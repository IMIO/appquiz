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

@Injectable({ providedIn: 'root' })
export class WebSocketTimerService {
  private ws: WebSocket | null = null;
  private countdown$: BehaviorSubject<TimerState>;
  private stepTransition$ = new Subject<StepTransitionData>();
  private stepActivation$ = new Subject<StepActivationData>();
  private currentState: TimerState = {
    timeRemaining: 20,
    timerMax: 20,
    isActive: false,
    questionStartTime: null,
    countdownToStart: 0,
    syncTimestamp: 0
  };
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    this.countdown$ = new BehaviorSubject<TimerState>(this.currentState);
    this.connect();
  }

  private connect() {
    try {
      const wsUrl = environment.apiUrl.replace('http', 'ws').replace('https', 'wss');
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('🔌 WebSocket connecté pour sync temps réel');
        this.reconnectAttempts = 0;
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'timer-update') {
            this.handleTimerUpdate(message.data);
          } else if (message.type === 'step-transition') {
            this.handleStepTransition(message.data);
          } else if (message.type === 'step-activation') {
            this.handleStepActivation(message.data);
          }
        } catch (error) {
          console.error('❌ Erreur parsing WebSocket message:', error);
        }
      };
      
      this.ws.onclose = () => {
        console.log('🔌 WebSocket déconnecté');
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
      console.log(`🔄 Reconnexion WebSocket dans ${delay}ms (tentative ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    } else {
      console.error('❌ Impossible de reconnect WebSocket après', this.maxReconnectAttempts, 'tentatives');
    }
  }

  private handleTimerUpdate(data: any) {
    this.currentState = {
      timeRemaining: data.timeRemaining || 0,
      timerMax: data.timerMax || 20,
      isActive: data.isTimerActive || false,
      questionStartTime: data.questionStartTime || null,
      countdownToStart: data.countdownToStart || 0,
      syncTimestamp: Date.now()
    };
    
    this.countdown$.next({ ...this.currentState });
    
    // Debug détaillé pour comprendre ce qui se passe
    console.log('🔄 WS TIMER UPDATE:', {
      timeRemaining: data.timeRemaining,
      isActive: data.isTimerActive,
      questionStartTime: data.questionStartTime,
      serverTime: data.serverTime,
      countdownToStart: data.countdownToStart,
      currentQuestionIndex: data.currentQuestionIndex
    });
    
    if (this.currentState.countdownToStart && this.currentState.countdownToStart > 0) {
      console.log(`⏳ WS SYNC: Question dans ${this.currentState.countdownToStart}s`);
    } else {
      console.log(`🕐 WS SYNC PARFAITE: ${this.currentState.timeRemaining}s restant`);
    }
  }

  getCountdown() {
    return this.countdown$.asObservable();
  }

  getCurrentState(): TimerState {
    return { ...this.currentState };
  }

  private handleStepTransition(data: StepTransitionData) {
    console.log('🔄 WS STEP TRANSITION:', data);
    this.stepTransition$.next(data);
  }

  private handleStepActivation(data: StepActivationData) {
    console.log('✅ WS STEP ACTIVATION:', data);
    this.stepActivation$.next(data);
  }

  getStepTransitions() {
    return this.stepTransition$.asObservable();
  }

  getStepActivations() {
    return this.stepActivation$.asObservable();
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}