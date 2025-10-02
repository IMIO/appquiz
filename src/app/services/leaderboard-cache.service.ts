import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { LeaderboardEntry } from '../models/leaderboard-entry.model';

@Injectable({
  providedIn: 'root'
})
export class LeaderboardCacheService {
  // Cache des scores pour éviter les régressions
  private scoreCache: { [userId: string]: {score: number, timestamp: number} } = {};
  private lastSuccessfulLeaderboardSource = new BehaviorSubject<LeaderboardEntry[]>([]);
  public lastSuccessfulLeaderboard$ = this.lastSuccessfulLeaderboardSource.asObservable();

  constructor() {
    this.loadFromLocalStorage();
  }

  /**
   * Charge le cache du leaderboard depuis le localStorage
   */
  private loadFromLocalStorage(): void {
    try {
      const cachedLeaderboardStr = localStorage.getItem('leaderboard_cache');
      if (cachedLeaderboardStr) {
        const parsedLeaderboard = JSON.parse(cachedLeaderboardStr);
        if (Array.isArray(parsedLeaderboard) && parsedLeaderboard.length > 0) {
          // Entrées restaurées depuis le cache local
          this.lastSuccessfulLeaderboardSource.next(parsedLeaderboard);
          
          // Reconstruire le cache des scores à partir du leaderboard restauré
          parsedLeaderboard.forEach(entry => {
            // Prendre en compte tous les scores, même ceux à 0
            this.scoreCache[entry.id] = {
              score: entry.score,
              timestamp: Date.now() // Utiliser l'horodatage actuel
            };
          });
        }
      }
    } catch (error) {
      // Erreur silencieuse lors de la restauration du cache
    }
  }

  /**
   * Met à jour le cache avec un nouveau leaderboard
   * @param leaderboard Le nouveau leaderboard à mettre en cache
   */
  updateCache(leaderboard: LeaderboardEntry[]): void {
    if (leaderboard.length > 0) { // Accepter tous les leaderboards même sans scores positifs
      // Sauvegarde du tableau de classement
      this.lastSuccessfulLeaderboardSource.next([...leaderboard]);
      
      // Mettre à jour le cache des scores - toujours utiliser les dernières données
      leaderboard.forEach(entry => {
        // Mettre à jour tous les scores, même 0, pour synchroniser l'état
        this.scoreCache[entry.id] = {
          score: entry.score,
          timestamp: Date.now()
        };
      });
      
      // Sauvegarder dans le localStorage pour persistance
      try {
        localStorage.setItem('leaderboard_cache', JSON.stringify(leaderboard));
        // Leaderboard sauvegardé dans le localStorage
      } catch (error) {
        // Erreur silencieuse lors de la sauvegarde du cache
      }
    }
  }

  /**
   * Récupère le score en cache pour un utilisateur
   * @param userId ID de l'utilisateur
   * @returns Score en cache ou 0 si non trouvé
   */
  getCachedScore(userId: string): number {
    // Vérifier d'abord dans le cache local
    const localScore = this.scoreCache[userId]?.score || 0;
    
    // Vérifier aussi dans le leaderboard en mémoire pour éviter les désynchronisations
    const leaderboardScore = this.lastSuccessfulLeaderboardSource.getValue()
      .find(entry => entry.id === userId)?.score || 0;
    
    // Retourner la valeur la plus élevée entre les deux sources
    return Math.max(localScore, leaderboardScore);
  }

  /**
   * Récupère le leaderboard en cache
   * @returns Le dernier leaderboard valide mis en cache
   */
  getCachedLeaderboard(): LeaderboardEntry[] {
    return this.lastSuccessfulLeaderboardSource.getValue();
  }

  /**
   * Vérifie si le cache contient des données
   * @returns true si le cache contient des données
   */
  hasCache(): boolean {
    return this.lastSuccessfulLeaderboardSource.getValue().length > 0;
  }
  
  /**
   * Nettoie complètement tous les caches
   * À utiliser lors d'un reset complet de l'application
   */
  clearAllCaches(): void {
    // Vider le cache en mémoire
    this.lastSuccessfulLeaderboardSource.next([]);
    this.scoreCache = {};
    
    // Supprimer le cache du localStorage
    try {
      localStorage.removeItem('leaderboard_cache');
      // Cache du leaderboard supprimé
    } catch (error) {
      // Erreur silencieuse lors de la suppression du cache
    }
  }
}