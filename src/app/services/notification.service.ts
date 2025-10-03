import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Notification {
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  duration?: number; // durée en millisecondes
  icon?: string; // emoji ou classe d'icône
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationSubject = new BehaviorSubject<Notification | null>(null);
  public notification$ = this.notificationSubject.asObservable();

  constructor() { }

  /**
   * Affiche une notification
   * @param message Le message à afficher
   * @param type Le type de notification (success, info, warning, error)
   * @param duration La durée d'affichage en ms (par défaut 5000ms)
   * @param icon L'icône à afficher (emoji ou classe d'icône)
   */
  showNotification(message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info', duration: number = 5000, icon?: string): void {
    this.notificationSubject.next({ message, type, duration, icon });

    // Effacer la notification après la durée spécifiée
    if (duration > 0) {
      setTimeout(() => {
        this.clearNotification();
      }, duration);
    }
  }

  /**
   * Raccourci pour afficher une notification de succès
   */
  success(message: string, duration: number = 5000, icon: string = '✅'): void {
    this.showNotification(message, 'success', duration, icon);
  }

  /**
   * Raccourci pour afficher une notification d'information
   */
  info(message: string, duration: number = 5000, icon: string = 'ℹ️'): void {
    this.showNotification(message, 'info', duration, icon);
  }

  /**
   * Raccourci pour afficher une notification d'avertissement
   */
  warning(message: string, duration: number = 5000, icon: string = '⚠️'): void {
    this.showNotification(message, 'warning', duration, icon);
  }

  /**
   * Raccourci pour afficher une notification d'erreur
   */
  error(message: string, duration: number = 5000, icon: string = '❌'): void {
    this.showNotification(message, 'error', duration, icon);
  }

  /**
   * Efface la notification actuelle
   */
  clearNotification(): void {
    this.notificationSubject.next(null);
  }
}