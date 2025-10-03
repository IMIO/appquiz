import { Injectable } from '@angular/core';
import { User } from '../models/user.model';

/**
 * Service pour gérer l'état de l'utilisateur et la persistance des données
 * entre les rafraîchissements de page
 */
@Injectable({
  providedIn: 'root'
})
export class UserStateService {
  // Clés de stockage
  private readonly USER_ID_KEY = 'quiz_user_id';
  private readonly USER_NAME_KEY = 'quiz_user_name';
  private readonly USER_AVATAR_KEY = 'quiz_user_avatar';
  private readonly USER_DATA_KEY = 'quiz_user_data';
  private readonly SESSION_TIMESTAMP_KEY = 'quiz_session_timestamp';

  constructor() {
    console.log('[USER-STATE] Service initialisé');
    
    // À l'initialisation, vérifier que les données sont cohérentes
    this.validateStoredData();
  }

  /**
   * Sauvegarde les informations de l'utilisateur de manière robuste
   */
  saveUserInfo(user: User): void {
    try {
      // Sauvegarder dans les deux formats pour plus de robustesse
      // 1. Propriétés individuelles pour un accès facile
      localStorage.setItem(this.USER_ID_KEY, user.id);
      localStorage.setItem(this.USER_NAME_KEY, user.name);
      if (user.avatarUrl) {
        localStorage.setItem(this.USER_AVATAR_KEY, user.avatarUrl);
      }
      
      // 2. Objet complet pour la cohérence des données
      localStorage.setItem(this.USER_DATA_KEY, JSON.stringify(user));
      
      // Ajouter un timestamp pour vérifier la fraîcheur des données
      localStorage.setItem(this.SESSION_TIMESTAMP_KEY, Date.now().toString());
      
      // Maintenir la compatibilité avec le code existant
      localStorage.setItem('userId', user.id);
      localStorage.setItem('userName', user.name);
      if (user.avatarUrl) {
        localStorage.setItem('avatarUrl', user.avatarUrl);
      }
      
      console.log('[USER-STATE] Informations utilisateur sauvegardées:', user.id);
    } catch (error) {
      console.error('[USER-STATE] Erreur lors de la sauvegarde des informations utilisateur:', error);
    }
  }

  /**
   * Récupère les informations de l'utilisateur
   */
  getUserInfo(): User | null {
    try {
      // Essayer d'abord de récupérer l'objet complet
      const userDataStr = localStorage.getItem(this.USER_DATA_KEY);
      if (userDataStr) {
        const userData = JSON.parse(userDataStr) as User;
        console.log('[USER-STATE] Informations utilisateur récupérées depuis USER_DATA_KEY');
        return userData;
      }
      
      // Si l'objet complet n'est pas disponible, essayer de construire à partir des propriétés individuelles
      const userId = localStorage.getItem(this.USER_ID_KEY) || localStorage.getItem('userId');
      const userName = localStorage.getItem(this.USER_NAME_KEY) || localStorage.getItem('userName');
      const avatarUrl = localStorage.getItem(this.USER_AVATAR_KEY) || localStorage.getItem('avatarUrl');
      
      if (userId && userName) {
        console.log('[USER-STATE] Informations utilisateur reconstruites à partir des clés individuelles');
        return {
          id: userId,
          name: userName,
          score: 0,
          answers: [],
          avatarUrl: avatarUrl || undefined
        };
      }
      
      console.log('[USER-STATE] Aucune information utilisateur trouvée');
      return null;
    } catch (error) {
      console.error('[USER-STATE] Erreur lors de la récupération des informations utilisateur:', error);
      return null;
    }
  }

  /**
   * Vérifie si un utilisateur est actuellement connecté
   */
  isUserLoggedIn(): boolean {
    try {
      const userData = this.getUserInfo();
      return !!userData && !!userData.id && !!userData.name;
    } catch {
      return false;
    }
  }

  /**
   * Efface toutes les informations utilisateur (déconnexion)
   */
  clearUserInfo(): void {
    try {
      // Effacer nos clés
      localStorage.removeItem(this.USER_ID_KEY);
      localStorage.removeItem(this.USER_NAME_KEY);
      localStorage.removeItem(this.USER_AVATAR_KEY);
      localStorage.removeItem(this.USER_DATA_KEY);
      localStorage.removeItem(this.SESSION_TIMESTAMP_KEY);
      
      // Effacer aussi les clés utilisées par le code existant
      localStorage.removeItem('userId');
      localStorage.removeItem('userName');
      localStorage.removeItem('avatarUrl');
      localStorage.removeItem('quiz-user');
      localStorage.removeItem('quiz_player_state');
      
      console.log('[USER-STATE] Informations utilisateur effacées');
    } catch (error) {
      console.error('[USER-STATE] Erreur lors de l\'effacement des informations utilisateur:', error);
    }
  }

  /**
   * Vérifie la cohérence des données stockées
   */
  private validateStoredData(): void {
    try {
      // Vérifier si nous avons l'objet complet mais pas les propriétés individuelles
      const userDataStr = localStorage.getItem(this.USER_DATA_KEY);
      if (userDataStr) {
        const userData = JSON.parse(userDataStr) as User;
        
        // Reconstruire les propriétés individuelles si nécessaire
        if (!localStorage.getItem(this.USER_ID_KEY)) {
          localStorage.setItem(this.USER_ID_KEY, userData.id);
        }
        if (!localStorage.getItem(this.USER_NAME_KEY)) {
          localStorage.setItem(this.USER_NAME_KEY, userData.name);
        }
        if (userData.avatarUrl && !localStorage.getItem(this.USER_AVATAR_KEY)) {
          localStorage.setItem(this.USER_AVATAR_KEY, userData.avatarUrl);
        }
        
        // Maintenir la compatibilité avec le code existant
        if (!localStorage.getItem('userId')) {
          localStorage.setItem('userId', userData.id);
        }
        if (!localStorage.getItem('userName')) {
          localStorage.setItem('userName', userData.name);
        }
        if (userData.avatarUrl && !localStorage.getItem('avatarUrl')) {
          localStorage.setItem('avatarUrl', userData.avatarUrl);
        }
        
        console.log('[USER-STATE] Données reconstruites à partir de l\'objet complet');
      } 
      // Cas inverse : nous avons les propriétés individuelles mais pas l'objet complet
      else {
        const userId = localStorage.getItem(this.USER_ID_KEY) || localStorage.getItem('userId');
        const userName = localStorage.getItem(this.USER_NAME_KEY) || localStorage.getItem('userName');
        const avatarUrl = localStorage.getItem(this.USER_AVATAR_KEY) || localStorage.getItem('avatarUrl');
        
        if (userId && userName) {
          const userData: User = {
            id: userId,
            name: userName,
            score: 0,
            answers: [],
            avatarUrl: avatarUrl || undefined
          };
          
          localStorage.setItem(this.USER_DATA_KEY, JSON.stringify(userData));
          
          // Assurer que toutes les propriétés sont définies
          localStorage.setItem(this.USER_ID_KEY, userId);
          localStorage.setItem(this.USER_NAME_KEY, userName);
          if (avatarUrl) {
            localStorage.setItem(this.USER_AVATAR_KEY, avatarUrl);
          }
          
          // Maintenir la compatibilité
          localStorage.setItem('userId', userId);
          localStorage.setItem('userName', userName);
          if (avatarUrl) {
            localStorage.setItem('avatarUrl', avatarUrl);
          }
          
          console.log('[USER-STATE] Objet complet reconstruit à partir des propriétés');
        }
      }
    } catch (error) {
      console.error('[USER-STATE] Erreur lors de la validation des données:', error);
    }
  }
}