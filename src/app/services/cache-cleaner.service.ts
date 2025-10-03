import { Injectable } from '@angular/core';

/**
 * Service dédié au nettoyage de tous les caches liés aux participants
 * pour résoudre le problème des "participants fantômes"
 */
@Injectable({
  providedIn: 'root'
})
export class CacheCleanerService {
  // Liste des utilisateurs autorisés connus
  private authorizedUsers: Set<string> = new Set();
  // Liste des utilisateurs non autorisés à bloquer
  private blockedUsers: Set<string> = new Set(['voo']);
  
  constructor() {
    // Charger la liste des utilisateurs autorisés depuis localStorage si disponible
    this.loadAuthorizedUsers();
    // Charger la liste des utilisateurs bloqués depuis localStorage si disponible
    this.loadBlockedUsers();
  }

  /**
   * Charge la liste des utilisateurs autorisés depuis localStorage
   */
  private loadAuthorizedUsers(): void {
    try {
      const savedUsers = localStorage.getItem('authorized_users');
      if (savedUsers) {
        const usersList = JSON.parse(savedUsers);
        if (Array.isArray(usersList)) {
          this.authorizedUsers = new Set(usersList);
          console.log(`📋 Liste d'utilisateurs autorisés chargée: ${usersList.length} utilisateurs`);
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des utilisateurs autorisés:', error);
    }
  }
  
  /**
   * Charge la liste des utilisateurs bloqués depuis localStorage
   */
  private loadBlockedUsers(): void {
    try {
      const savedBlockedUsers = localStorage.getItem('blocked_users');
      if (savedBlockedUsers) {
        const blockedList = JSON.parse(savedBlockedUsers);
        if (Array.isArray(blockedList)) {
          // Toujours s'assurer que "voo" est dans la liste des bloqués
          blockedList.push('voo');
          this.blockedUsers = new Set(blockedList);
          console.log(`🚫 Liste d'utilisateurs bloqués chargée: ${blockedList.length} utilisateurs`);
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des utilisateurs bloqués:', error);
    }
  }
  
  /**
   * Sauvegarde la liste des utilisateurs autorisés dans localStorage
   */
  private saveAuthorizedUsers(): void {
    try {
      const usersList = Array.from(this.authorizedUsers);
      localStorage.setItem('authorized_users', JSON.stringify(usersList));
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde des utilisateurs autorisés:', error);
    }
  }
  
  /**
   * Sauvegarde la liste des utilisateurs bloqués dans localStorage
   */
  private saveBlockedUsers(): void {
    try {
      const blockedList = Array.from(this.blockedUsers);
      localStorage.setItem('blocked_users', JSON.stringify(blockedList));
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde des utilisateurs bloqués:', error);
    }
  }
  
  /**
   * Réinitialise la liste des utilisateurs bloqués
   * Utile si un utilisateur légitime a été incorrectement bloqué
   * @param keepDefaultBlocked Si true, conserve les utilisateurs bloqués par défaut comme "voo"
   */
  resetBlockedUsers(keepDefaultBlocked: boolean = true): void {
    try {
      console.log('🔄 Réinitialisation de la liste des utilisateurs bloqués');
      
      if (keepDefaultBlocked) {
        // Conserver uniquement les bloqués par défaut
        this.blockedUsers = new Set(['voo']);
        console.log('✅ Liste des utilisateurs bloqués réinitialisée (utilisateurs par défaut conservés)');
      } else {
        // Vider complètement la liste
        this.blockedUsers.clear();
        console.log('✅ Liste des utilisateurs bloqués entièrement vidée');
      }
      
      // Sauvegarder les changements
      this.saveBlockedUsers();
      
      // Notifier l'utilisateur
      alert('La liste des utilisateurs bloqués a été réinitialisée avec succès.');
    } catch (error) {
      console.error('❌ Erreur lors de la réinitialisation des utilisateurs bloqués:', error);
      alert('Une erreur est survenue lors de la réinitialisation des utilisateurs bloqués.');
    }
  }

  /**
   * Ajoute un utilisateur à la liste des utilisateurs autorisés
   * @param userId ID de l'utilisateur à autoriser
   * @param userName Nom de l'utilisateur (optionnel)
   */
  addAuthorizedUser(userId: string, userName?: string): void {
    if (!userId) return;
    
    // Ne jamais autoriser un utilisateur bloqué
    if (this.blockedUsers.has(userId) || (userName && this.blockedUsers.has(userName))) {
      console.warn(`🚫 Tentative d'ajout d'un utilisateur bloqué rejetée: ${userId}`);
      return;
    }
    
    this.authorizedUsers.add(userId);
    if (userName) {
      this.authorizedUsers.add(userName);
    }
    
    console.log(`✅ Utilisateur autorisé ajouté: ${userId}`);
    this.saveAuthorizedUsers();
  }

  /**
   * Vérifie si un utilisateur est autorisé
   * @param userId ID ou nom de l'utilisateur à vérifier
   * @returns true si l'utilisateur est autorisé ou si la liste est vide (démarrage initial)
   */
  isAuthorizedUser(userId: string): boolean {
    // Vérifier d'abord les utilisateurs bloqués (toujours refusés)
    if (this.blockedUsers.has(userId)) {
      console.warn(`🚫 Utilisateur bloqué détecté: ${userId}`);
      return false;
    }
    
    // Si la liste des autorisés est vide, autoriser tout le monde (phase d'initialisation)
    if (this.authorizedUsers.size === 0) {
      return true;
    }
    
    // Sinon, vérifier si l'utilisateur est dans la liste des autorisés
    return this.authorizedUsers.has(userId);
  }

  /**
   * Nettoie tous les caches liés aux participants et au quiz
   * @param silent Si true, n'affiche pas d'alerte (utile pour les nettoyages silencieux)
   */
  cleanAllParticipantCaches(silent: boolean = false): void {
    try {
      console.log('🧹 Nettoyage de tous les caches en cours...');
      // Liste exhaustive de tous les caches potentiels
      const cachesToClear = [
        'presentation_participants_cache',
        'leaderboard_cache',
        'presentation_leaderboard_cache',
        'quiz_state',
        'quiz_player_state',
        'participants_cache',
        'quiz_current_participants',
        'cached_participants'
      ];
      
      // Nettoyer chaque cache
      let clearedCount = 0;
      cachesToClear.forEach(cacheKey => {
        if (localStorage.getItem(cacheKey) !== null) {
          localStorage.removeItem(cacheKey);
          clearedCount++;
          console.log(`✅ Cache nettoyé: ${cacheKey}`);
        }
      });
      
      // Faire la même chose pour sessionStorage
      cachesToClear.forEach(cacheKey => {
        if (sessionStorage.getItem(cacheKey) !== null) {
          sessionStorage.removeItem(cacheKey);
          clearedCount++;
          console.log(`✅ SessionStorage nettoyé: ${cacheKey}`);
        }
      });
      
      console.log(`🧹 Nettoyage des caches terminé: ${clearedCount} éléments supprimés`);
      
      // Afficher une alerte si demandé
      if (!silent && clearedCount > 0) {
        alert(`✅ Cache nettoyé ! ${clearedCount} éléments ont été supprimés. Le jeu est maintenant rafraîchi.`);
      }
    } catch (error) {
      console.error('❌ Erreur lors du nettoyage des caches:', error);
      
      // Afficher une alerte d'erreur si non silencieux
      if (!silent) {
        alert('Une erreur est survenue lors du nettoyage des caches. Voir la console pour plus de détails.');
      }
    }
  }
  
  /**
   * Supprime un participant spécifique de tous les caches
   * @param userId ID du participant à supprimer
   * @param userName Nom du participant (optionnel)
   */
  /**
   * Supprime un participant spécifique de tous les caches
   * @param userId ID du participant à supprimer
   * @param userName Nom du participant (optionnel)
   * @param addToBlocked Si true, ajoute également l'utilisateur à la liste des bloqués
   */
  removeParticipantFromCaches(userId: string, userName?: string, addToBlocked: boolean = true): void {
    try {
      console.log(`🗑️ Suppression du participant ${userId} de tous les caches...`);
      
      // Tableau des clés de cache à vérifier
      const cacheKeys = [
        'presentation_participants_cache',
        'leaderboard_cache',
        'presentation_leaderboard_cache',
        'quiz_current_participants',
        'cached_participants',
        'participants_cache'
      ];
      
      // Parcourir chaque clé de cache
      cacheKeys.forEach(key => {
        const cachedDataStr = localStorage.getItem(key);
        if (cachedDataStr) {
          try {
            const cachedData = JSON.parse(cachedDataStr);
            
            // Si c'est un tableau (participants), filtrer le participant spécifique
            if (Array.isArray(cachedData)) {
              const filteredData = cachedData.filter(item => {
                // Vérifier toutes les propriétés possibles pour l'identifiant
                const itemId = item.id || item.userId;
                const itemName = item.name || item.userName;
                
                // Conserver tous les éléments sauf celui qui correspond à l'utilisateur à supprimer
                return itemId !== userId && 
                       (userName ? itemName !== userName : true);
              });
              
              // Si des éléments ont été supprimés, mettre à jour le cache
              if (filteredData.length !== cachedData.length) {
                localStorage.setItem(key, JSON.stringify(filteredData));
                console.log(`✅ Participant supprimé du cache: ${key}`);
              }
            }
          } catch (e) {
            console.warn(`⚠️ Erreur lors du traitement du cache ${key}:`, e);
          }
        }
      });
      
      // Faire la même chose pour sessionStorage
      cacheKeys.forEach(key => {
        const cachedDataStr = sessionStorage.getItem(key);
        if (cachedDataStr) {
          try {
            const cachedData = JSON.parse(cachedDataStr);
            if (Array.isArray(cachedData)) {
              const filteredData = cachedData.filter(item => {
                const itemId = item.id || item.userId;
                const itemName = item.name || item.userName;
                return itemId !== userId && 
                       (userName ? itemName !== userName : true);
              });
              
              if (filteredData.length !== cachedData.length) {
                sessionStorage.setItem(key, JSON.stringify(filteredData));
                console.log(`✅ Participant supprimé du sessionStorage: ${key}`);
              }
            }
          } catch (e) {
            console.warn(`⚠️ Erreur lors du traitement du sessionStorage ${key}:`, e);
          }
        }
      });
      
      console.log(`✅ Suppression du participant ${userId} terminée`);
      
      // Ajouter à la liste des utilisateurs bloqués si demandé
      if (addToBlocked) {
        // Ne pas bloquer les utilisateurs déjà autorisés
        if (!this.isAuthorizedUser(userId)) {
          this.blockedUsers.add(userId);
          if (userName) this.blockedUsers.add(userName);
          this.saveBlockedUsers();
          console.log(`🚫 Utilisateur ajouté à la liste des bloqués: ${userId}`);
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors de la suppression du participant des caches:', error);
    }
  }
  
  /**
   * Vérification agressive des caches - supprime TOUT le localStorage et sessionStorage
   * À n'utiliser qu'en cas de problèmes persistants
   */
  aggressiveCacheCleaning(): void {
    try {
      console.log('⚠️ NETTOYAGE AGRESSIF DES CACHES EN COURS...');
      
      // Sauvegarde temporaire de la liste des utilisateurs autorisés
      const authorizedUsersList = Array.from(this.authorizedUsers);
      const blockedUsersList = Array.from(this.blockedUsers);
      
      // Comptage des éléments avant nettoyage
      const localStorageCount = localStorage.length;
      const sessionStorageCount = sessionStorage.length;
      
      // Vider complètement localStorage et sessionStorage
      localStorage.clear();
      sessionStorage.clear();
      
      // Restaurer la liste des utilisateurs autorisés
      this.authorizedUsers = new Set(authorizedUsersList);
      this.blockedUsers = new Set(blockedUsersList);
      this.saveAuthorizedUsers();
      
      console.log(`🔥 Nettoyage agressif terminé: ${localStorageCount} éléments de localStorage et ${sessionStorageCount} éléments de sessionStorage supprimés`);
      
      // Notification
      alert(`Nettoyage agressif terminé: ${localStorageCount + sessionStorageCount} éléments de cache supprimés.\n\nL'application va maintenant être rechargée pour appliquer les changements.`);
      
      // Recharger la page pour appliquer les changements
      window.location.reload();
    } catch (error) {
      console.error('❌ Erreur lors du nettoyage agressif des caches:', error);
      alert('Une erreur est survenue lors du nettoyage agressif des caches. Voir la console pour plus de détails.');
    }
  }
}