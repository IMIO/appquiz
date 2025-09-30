import { Injectable } from '@angular/core';
import { QuizStep } from './quiz-secure.service';
import { User } from '../models/user.model';
import { LeaderboardEntry } from '../models/leaderboard-entry.model';

export interface GameState {
  step: QuizStep;
  currentQuestionIndex: number;
  questionStartTime: number;
  participants: User[];
  leaderboard: LeaderboardEntry[];
  totalQuestions: number;
  gameStartTime: number;
  lastActivity: number;
  timerValue?: number;
  timerMax?: number;
  isTimerRunning?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class GamePersistenceService {
  private readonly STORAGE_KEY = 'quiz_game_state';
  private readonly AUTO_SAVE_INTERVAL = 2000; // 2 secondes
  private autoSaveTimer?: any;

  constructor() {
    this.startAutoSave();
  }

  /**
   * Sauvegarde automatique périodique
   */
  private startAutoSave(): void {
    this.autoSaveTimer = setInterval(() => {
      // La sauvegarde se fait via updateGameState() appelée par le service
      this.updateLastActivity();
    }, this.AUTO_SAVE_INTERVAL);
  }

  /**
   * Sauvegarder l'état complet du jeu
   */
  saveGameState(gameState: GameState): void {
    try {
      gameState.lastActivity = Date.now();
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(gameState));
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
    }
  }

  /**
   * Mettre à jour partiellement l'état du jeu
   */
  updateGameState(partialState: Partial<GameState>): void {
    try {
      const existingState = this.getSavedGameState();
      if (existingState) {
        const updatedState = {
          ...existingState,
          ...partialState,
          lastActivity: Date.now()
        };
        this.saveGameState(updatedState);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour:', error);
    }
  }

  /**
   * Récupérer l'état sauvegardé du jeu
   */
  getSavedGameState(): GameState | null {
    try {
      const savedData = localStorage.getItem(this.STORAGE_KEY);
      if (savedData) {
        const gameState = JSON.parse(savedData) as GameState;
        
        // Validation de base
        if (this.isStateValid(gameState)) {
          return gameState;
        } else {
          console.warn('⚠️ État sauvegardé invalide, suppression');
          this.clearSavedGameState();
          return null;
        }
      }
      return null;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération:', error);
      this.clearSavedGameState();
      return null;
    }
  }

  /**
   * Vérifier si on peut restaurer le jeu
   */
  canRestoreGame(): boolean {
    const savedState = this.getSavedGameState();
    if (!savedState) return false;

    // Vérifier que la sauvegarde n'est pas trop ancienne (30 minutes max)
    const maxAge = 30 * 60 * 1000; // 30 minutes
    const now = Date.now();
    const age = now - savedState.lastActivity;

    return age < maxAge && savedState.step !== 'lobby';
  }

  /**
   * Calculer le temps restant pour une question
   */
  calculateRemainingTime(): number {
    const savedState = this.getSavedGameState();
    if (!savedState || savedState.step !== 'question') return 0;

    const now = Date.now();
    const elapsed = now - savedState.questionStartTime;
    const maxTime = (savedState.timerMax || 20) * 1000; // 20 secondes par défaut

    return Math.max(0, maxTime - elapsed);
  }

  /**
   * Valider la structure d'un état sauvegardé
   */
  private isStateValid(state: GameState): boolean {
    return !!(
      state &&
      state.step &&
      typeof state.currentQuestionIndex === 'number' &&
      typeof state.lastActivity === 'number' &&
      Array.isArray(state.participants)
    );
  }

  /**
   * Mettre à jour le timestamp de dernière activité
   */
  private updateLastActivity(): void {
    const existingState = this.getSavedGameState();
    if (existingState) {
      existingState.lastActivity = Date.now();
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(existingState));
    }
  }

  /**
   * Effacer l'état sauvegardé
   */
  clearSavedGameState(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Obtenir des informations sur la sauvegarde
   */
  getSaveInfo(): { age: number; stepName: string; questionIndex: number } | null {
    const savedState = this.getSavedGameState();
    if (!savedState) return null;

    const stepNames: { [key: string]: string } = {
      'lobby': 'Salon d\'attente',
      'waiting': 'Attente des joueurs', 
      'question': 'Question en cours',
      'result': 'Résultats',
      'end': 'Fin du quiz'
    };

    return {
      age: Date.now() - savedState.lastActivity,
      stepName: stepNames[savedState.step] || savedState.step,
      questionIndex: savedState.currentQuestionIndex
    };
  }

  /**
   * Nettoyer les ressources
   */
  destroy(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
  }
}
