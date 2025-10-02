import { Injectable } from '@angular/core';
import { QuizService } from '../services/quiz-secure.service';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StateRestoreService {
  // État de récupération actuel
  private isRestoringSubject = new BehaviorSubject<boolean>(false);
  public isRestoring$ = this.isRestoringSubject.asObservable();

  // Résultat de la dernière tentative de restauration
  private restorationResultSubject = new BehaviorSubject<{success: boolean, message: string} | null>(null);
  public restorationResult$ = this.restorationResultSubject.asObservable();

  constructor(private quizService: QuizService) {}

  /**
   * Vérifie si un état peut être restauré
   */
  canRestoreState(): boolean {
    return this.quizService.canRestoreGameState();
  }

  /**
   * Récupère les informations sur la sauvegarde
   */
  getSaveInfo() {
    return this.quizService.getSaveInfo();
  }

  /**
   * Tente de restaurer l'état complet du jeu après un rafraîchissement
   */
  async restoreState(): Promise<boolean> {
    try {
      this.isRestoringSubject.next(true);

      // Charger les questions d'abord
      await this.quizService.initQuestions();
      
      // Restaurer l'état sauvegardé
      const restored = await this.quizService.restoreGameState();
      
      if (restored) {
        console.log('✅ État restauré avec succès!');
        this.restorationResultSubject.next({ 
          success: true, 
          message: 'État restauré avec succès !' 
        });
        return true;
      } else {
        console.warn('⚠️ Échec de la restauration de l\'état');
        this.restorationResultSubject.next({ 
          success: false, 
          message: 'Échec de la restauration. L\'état sauvegardé pourrait être corrompu.' 
        });
        return false;
      }
    } catch (error) {
      console.error('❌ Erreur lors de la restauration:', error);
      this.restorationResultSubject.next({ 
        success: false, 
        message: `Erreur lors de la restauration: ${error}` 
      });
      return false;
    } finally {
      this.isRestoringSubject.next(false);
    }
  }

  /**
   * Force la suppression de l'état sauvegardé
   */
  clearSavedState(): void {
    this.quizService.clearSavedGameState();
    this.restorationResultSubject.next({ 
      success: true, 
      message: 'État sauvegardé supprimé avec succès.' 
    });
  }
}