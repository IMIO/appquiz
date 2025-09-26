import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface SessionInfo {
  isAuthenticated: boolean;
  loginTime: number;
  expirationTime: number;
  remainingTime: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminAuthService {
  private readonly ADMIN_PIN = '2025';
  private readonly SESSION_DURATION = 4 * 60 * 60 * 1000; // 4 heures en millisecondes
  private readonly STORAGE_KEY = 'admin_session';
  
  private sessionSubject = new BehaviorSubject<SessionInfo>({
    isAuthenticated: false,
    loginTime: 0,
    expirationTime: 0,
    remainingTime: 0
  });

  constructor() {
    this.checkExistingSession();
    this.startSessionTimer();
  }

  /**
   * Authentifier avec le PIN
   */
  authenticate(pin: string): boolean {
    if (pin === this.ADMIN_PIN) {
      const now = Date.now();
      const sessionData = {
        loginTime: now,
        expirationTime: now + this.SESSION_DURATION
      };
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessionData));
      this.updateSessionInfo();
      return true;
    }
    return false;
  }

  /**
   * Vérifier si l'utilisateur est authentifié
   */
  isAuthenticated(): boolean {
    return this.sessionSubject.value.isAuthenticated;
  }

  /**
   * Obtenir les informations de session
   */
  getSessionInfo(): SessionInfo {
    return this.sessionSubject.value;
  }

  /**
   * Prolonger la session de 4 heures
   */
  extendSession(): void {
    if (this.isAuthenticated()) {
      const sessionData = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
      sessionData.expirationTime = Date.now() + this.SESSION_DURATION;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessionData));
      this.updateSessionInfo();
    }
  }

  /**
   * Se déconnecter
   */
  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.sessionSubject.next({
      isAuthenticated: false,
      loginTime: 0,
      expirationTime: 0,
      remainingTime: 0
    });
  }

  /**
   * Obtenir le temps restant formaté
   */
  getFormattedRemainingTime(): string {
    const remainingMs = this.sessionSubject.value.remainingTime;
    const remainingMinutes = Math.floor(remainingMs / (1000 * 60));
    const remainingHours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;

    if (remainingHours > 0) {
      return `${remainingHours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Vérifier une session existante au démarrage
   */
  private checkExistingSession(): void {
    const sessionData = localStorage.getItem(this.STORAGE_KEY);
    if (sessionData) {
      try {
        const session = JSON.parse(sessionData);
        if (session.expirationTime > Date.now()) {
          this.updateSessionInfo();
        } else {
          // Session expirée
          this.logout();
        }
      } catch {
        // Données corrompues
        this.logout();
      }
    }
  }

  /**
   * Mettre à jour les informations de session
   */
  private updateSessionInfo(): void {
    const sessionData = localStorage.getItem(this.STORAGE_KEY);
    if (sessionData) {
      try {
        const session = JSON.parse(sessionData);
        const now = Date.now();
        const remainingTime = Math.max(0, session.expirationTime - now);
        
        if (remainingTime > 0) {
          this.sessionSubject.next({
            isAuthenticated: true,
            loginTime: session.loginTime,
            expirationTime: session.expirationTime,
            remainingTime: remainingTime
          });
        } else {
          // Session expirée
          this.logout();
        }
      } catch {
        this.logout();
      }
    }
  }

  /**
   * Timer pour mettre à jour les informations de session
   */
  private startSessionTimer(): void {
    setInterval(() => {
      if (this.isAuthenticated()) {
        this.updateSessionInfo();
      }
    }, 30000); // Mise à jour toutes les 30 secondes
  }
}
