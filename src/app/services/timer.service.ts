import { Injectable } from '@angular/core';
import { BehaviorSubject, interval, Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { WebSocketTimerService } from './websocket-timer.service';

export interface TimerState {
  timeRemaining: number;
  timerMax: number;
  isActive: boolean;
  questionStartTime: number | null;
  countdownToStart?: number; // Compte à rebours avant démarrage
  syncTimestamp?: number; // Timestamp de synchronisation pour alignement forcé
  step?: string | null; // ✅ AJOUT: Étape actuelle du quiz reçue via WebSocket
}

@Injectable({ providedIn: 'root' })
export class TimerService {
  private countdown$: BehaviorSubject<TimerState>;
  private currentState: TimerState = {
    timeRemaining: 20,
    timerMax: 20,
    isActive: false,
    questionStartTime: null,
    countdownToStart: 0,
    syncTimestamp: 0,
    step: null // ✅ AJOUT: Étape initiale
  };
  private syncInterval?: Subscription;
  private tickInterval?: Subscription;
  private readonly apiUrl = environment.apiUrl;
  private isSyncing = false; // Éviter les synchronisations multiples
  private useWebSocket = true; // Préférer WebSocket

  constructor(private wsTimerService: WebSocketTimerService) {
    // Initialiser le BehaviorSubject avec l'état initial
    this.countdown$ = new BehaviorSubject<TimerState>(this.currentState);
    
    // Essayer WebSocket en priorité
    if (this.useWebSocket) {
  // ...existing code...
      this.wsTimerService.getCountdown().subscribe(
        (state) => {
          this.currentState = state;
          this.countdown$.next({ ...this.currentState });
        },
        (error) => {
          console.warn('❌ WebSocket failed, fallback HTTP:', error);
          this.useWebSocket = false;
          this.startServerSync(); // Fallback vers HTTP
        }
      );
    }
  }

  // Synchronisation ULTRA-rapide avec le serveur toutes les 50ms pour synchronisation parfaite forcée
  startServerSync() {
    if (this.isSyncing) {
  // ...existing code...
      return;
    }
    
    this.stopServerSync();
    this.isSyncing = true;
    
  // ...existing code...
    
    // Synchronisation immédiate
    this.syncWithServer();
    
    // Puis synchronisation périodique ULTRA-rapide pour éliminer tout décalage
    this.syncInterval = interval(50).subscribe(() => {
      this.syncWithServer();
    });
  }

  stopServerSync() {
    if (this.syncInterval) {
      this.syncInterval.unsubscribe();
      this.syncInterval = undefined;
    }
    // Plus de tick local - synchronisation serveur uniquement
    this.isSyncing = false;
  // ...existing code...
  }

  // DEPRECATED: Plus de tick local, synchronisation serveur uniquement
  private startLocalTick() {
    console.warn('⚠️ startLocalTick DEPRECATED - synchronisation serveur uniquement');
    // Ne plus utiliser de tick local pour éviter la désynchronisation
  }

  private stopLocalTick() {
    console.warn('⚠️ stopLocalTick DEPRECATED - synchronisation serveur uniquement');
    // Ne plus utiliser de tick local pour éviter la désynchronisation
  }

  private async syncWithServer() {
    try {
      const clientRequestTime = Date.now();
      const response = await fetch(`${this.apiUrl}/quiz-state`);
      const clientReceiveTime = Date.now();
      const gameState = await response.json();
      
      if (gameState) {
        // SOLUTION RADICALE: Alignement forcé sur les secondes entières
        const now = Date.now();
        const currentSecond = Math.floor(now / 1000) * 1000; // Aligner sur la seconde entière
        
        let finalTimeRemaining = 0;
        let finalCountdown = 0;
        
        if (gameState.countdownToStart > 0) {
          // Mode countdown - tous les clients s'alignent sur la même seconde
          const timeDiffMs = gameState.questionStartTime - currentSecond;
          finalCountdown = Math.max(0, Math.ceil(timeDiffMs / 1000));
          finalTimeRemaining = finalCountdown;
        } else if (gameState.isTimerActive) {
          // Mode timer actif - calcul basé sur la seconde entière courante
          const elapsedMs = currentSecond - gameState.questionStartTime;
          const elapsedSeconds = Math.floor(elapsedMs / 1000);
          finalTimeRemaining = Math.max(0, gameState.timerMax - elapsedSeconds);
          
          // ALIGNEMENT FORCÉ: Si on est proche d'une transition de seconde, forcer la valeur
          const msIntoSecond = now % 1000;
          if (msIntoSecond > 800) { // Si on est à plus de 800ms dans la seconde
            finalTimeRemaining = Math.max(0, finalTimeRemaining - 1); // Anticiper la seconde suivante
          }
        } else {
          finalTimeRemaining = gameState.timeRemaining;
        }
        
        this.currentState = {
          timeRemaining: finalTimeRemaining,
          timerMax: gameState.timerMax || 20,
          isActive: gameState.isTimerActive || false,
          questionStartTime: gameState.questionStartTime,
          countdownToStart: finalCountdown,
          syncTimestamp: currentSecond
        };
        
        // Diffuser immédiatement la valeur alignée
        this.countdown$.next({ ...this.currentState });
        
        if (finalCountdown > 0) {
          // ...existing code...
        } else {
          // ...existing code...
        }
      }
    } catch (error) {
      console.warn('Erreur synchronisation timer serveur:', error);
    }
  }

  start(seconds: number = 20) {
    this.currentState = {
      timeRemaining: seconds,
      timerMax: seconds,
      isActive: true,
      questionStartTime: Date.now()
    };
    this.countdown$.next({ ...this.currentState });
    this.startLocalTick();
  }

  /** Force la fin du timer (envoie 0 immédiatement) */
  forceEnd() {
    this.currentState.timeRemaining = 0;
    this.currentState.isActive = false;
    this.countdown$.next({ ...this.currentState });
    this.stopLocalTick();
  }

  getCountdown() {
    // Si WebSocket fonctionne, pas besoin de démarrer la sync HTTP
    if (this.useWebSocket) {
  // ...existing code...
      return this.countdown$.asObservable();
    }
    
    // Sinon, fallback vers HTTP comme avant
    if (!this.isSyncing) {
  // ...existing code...
      this.startServerSync();
    }
    return this.countdown$.asObservable();
  }

  getCurrentState(): TimerState {
    return { ...this.currentState };
  }

  // Force la diffusion de l'état actuel à tous les abonnés
  forceUpdate() {
    this.countdown$.next({ ...this.currentState });
  // ...existing code...
  }
}
