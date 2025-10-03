import { Component, OnInit, isDevMode } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { QuizService } from '../../services/quiz-secure.service';
import { User } from '../../models/user.model';
import { NotificationService } from '../../services/notification.service';
import { UserStateService } from '../../services/user-state.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  private questionsSyncSubscription?: any;
  resetAvatar() {
    this.avatarUrl = null;
  }
  name: string = '';
  github: string = '';
  avatarUrl: string | null = null;
  loadingAvatar = false;
  isSubmitting = false;

  constructor(
    private quizService: QuizService, 
    private router: Router,
    private notificationService: NotificationService,
    private userStateService: UserStateService
  ) {
    // Souscription à la synchronisation des questions via WebSocket
    this.questionsSyncSubscription = this.quizService.getWebSocketTimerService().getQuestionsSync().subscribe(async (syncData: any) => {
      let actionValue = (syncData as any).action;
      const rawData = syncData as any;
      if (!actionValue && rawData.data && rawData.data.action) {
        actionValue = rawData.data.action;
      }
      if (actionValue === 'reload') {
        try {
          await this.quizService.reloadQuestions();
          // Pas besoin de forcer de navigation ici, la liste sera à jour pour la prochaine étape
        } catch (e) {
          console.error('[LOGIN][WS] Erreur lors du rechargement des questions:', e);
        }
      }
    });
  }
  ngOnInit(): void {
    // Vérifier si une notification de réinitialisation doit être affichée
    const hasResetNotification = localStorage.getItem('quiz_reset_notification');
    if (hasResetNotification === 'true') {
      // Afficher la notification
      this.notificationService.warning(
        'Le jeu a été réinitialisé par l\'animateur. Toutes vos informations (inscription, points, etc.) ont été effacées. Veuillez vous inscrire à nouveau.',
        10000, // 10 secondes
        '🔄'
      );
      // Supprimer le flag pour éviter d'afficher la notification plusieurs fois
      localStorage.removeItem('quiz_reset_notification');
    }
    
    // Rafraîchir l'état du quiz pour s'assurer que nous avons les données les plus récentes
    this.refreshQuizState();
  }
  
  /**
   * Rafraîchit l'état du quiz pour s'assurer que tout est à jour après un reset
   */
  private async refreshQuizState(): Promise<void> {
    try {
      // Vérifier l'état actuel du quiz
      await this.quizService.forceCheckState();
      
      // Rafraîchir la liste des participants
      await this.quizService.fetchParticipantsFromServer();
      
      if (isDevMode()) console.log('[LOGIN] État du quiz rafraîchi');
    } catch (error) {
      console.warn('[LOGIN] Erreur lors du rafraîchissement de l\'état du quiz:', error);
    }
  }

  ngOnDestroy(): void {
    if (this.questionsSyncSubscription) {
      this.questionsSyncSubscription.unsubscribe();
      this.questionsSyncSubscription = undefined;
    }
  }

  private generateUniqueId(): string {
    // Use crypto.randomUUID if available, otherwise fallback
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for older browsers
    return 'user-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
  }

  async fetchGithubAvatar() {
    if (!this.github.trim()) return;
    this.loadingAvatar = true;
    try {
      const res = await fetch(`https://api.github.com/users/${this.github.trim()}`);
      if (!res.ok) throw new Error('Utilisateur GitHub introuvable');
      const data = await res.json();
      this.avatarUrl = data.avatar_url;
    } catch (e) {
      this.avatarUrl = null;
    } finally {
      this.loadingAvatar = false;
    }
  }

  async join(event?: Event) {
    // Debug log uniquement en mode développement
    if (isDevMode()) console.log('[LOGIN] Début inscription...');
    
    // Prevent any default behavior
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Prevent multiple submissions
    if (this.isSubmitting) {
      console.warn('Join already in progress, preventing duplicate submission');
      return;
    }
    
    // Vérifier si l'utilisateur est déjà inscrit en utilisant notre service
    const userData = this.userStateService.getUserInfo();
    
    if (userData && userData.id && userData.name) {
      console.log('[LOGIN] Session utilisateur trouvée, vérification si encore valide...');
      const existingUserId = userData.id;
      const existingUserName = userData.name;
      const existingAvatarUrl = userData.avatarUrl || '';
      
      // Vérifier si l'userId existe encore sur le serveur
      try {
        // Faire plusieurs tentatives pour gérer les cas où la liste peut être temporairement vide
        let userExists = false;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!userExists && attempts < maxAttempts) {
          const participants = await this.quizService.fetchParticipantsFromServer();
          userExists = participants.some((participant: User) => participant.id === existingUserId);
          
          if (!userExists && attempts < maxAttempts - 1) {
            console.log(`[LOGIN] Utilisateur non trouvé, tentative ${attempts + 1}/${maxAttempts}...`);
            await new Promise(resolve => setTimeout(resolve, 500)); // Attendre 500ms entre les tentatives
            attempts++;
          } else {
            break;
          }
        }
        
        if (userExists) {
          console.log('[LOGIN] ✅ Session utilisateur valide, redirection vers waiting');
          
          // S'assurer que les données sont bien sauvegardées avant de continuer
          this.userStateService.saveUserInfo({
            id: existingUserId,
            name: existingUserName,
            avatarUrl: existingAvatarUrl,
            score: 0,
            answers: []
          });
          
          await this.router.navigate(['/waiting']);
          return;
        } else {
          // Si l'utilisateur n'existe plus mais que nous sommes à l'étape lobby,
          // essayer de le réinscrire avant de le forcer à s'inscrire à nouveau
          const currentState = await this.quizService.forceCheckState();
          
          if (currentState === 'lobby') {
            try {
              console.log('[LOGIN] Tentative de réinscription automatique de l\'utilisateur...');
              
              // Tenter de réinscrire l'utilisateur avec ses données sauvegardées
              await this.quizService.addParticipant({
                id: existingUserId,
                name: existingUserName,
                avatarUrl: existingAvatarUrl || '',
                score: 0,
                answers: []
              });
              
              // Vérifier si la réinscription a fonctionné
              const updatedParticipants = await this.quizService.fetchParticipantsFromServer();
              const nowExists = updatedParticipants.some(p => p.id === existingUserId);
              
              if (nowExists) {
                console.log('[LOGIN] ✅ Réinscription automatique réussie!');
                
                // Sauvegarder à nouveau avec notre service
                this.userStateService.saveUserInfo({
                  id: existingUserId,
                  name: existingUserName,
                  avatarUrl: existingAvatarUrl,
                  score: 0,
                  answers: []
                });
                
                this.notificationService.showNotification('Reconnexion automatique réussie!', 'success');
                await this.router.navigate(['/waiting']);
                return;
              } else {
                console.log('[LOGIN] ❌ Réinscription automatique échouée');
              }
            } catch (error) {
              console.warn('[LOGIN] Erreur lors de la tentative de réinscription:', error);
            }
          }
          
          // Si nous arrivons ici, l'utilisateur n'existe plus et la réinscription a échoué
          console.log('[LOGIN] Session utilisateur invalide, nettoyage des données');
          this.userStateService.clearUserInfo();
          // Continue with new registration
        }
      } catch (error) {
        console.warn('[LOGIN] Erreur lors de la vérification de l\'utilisateur:', error);
        // Ne pas effacer les données utilisateur immédiatement, donner une chance de réessayer
        // Continue with new registration
      }
    }
    
    this.isSubmitting = true;
    
    try {
      // Validation détaillée
      const nameValue = this.name?.trim() || '';
      const githubValue = this.github?.trim() || '';

      if (!nameValue && !githubValue) {
        console.error('No name or github provided');
        alert('Veuillez saisir un nom ou un nom d\'utilisateur GitHub');
        return;
      }

      if (githubValue && !this.avatarUrl) {
        console.error('GitHub username provided but no avatar fetched');
        alert('Veuillez récupérer l\'avatar GitHub avant de continuer');
        return;
      }

      // Create user object
      const userId = this.generateUniqueId();

      const user: User = {
        id: userId,
        name: nameValue || githubValue,
        score: 0,
        answers: [],
        avatarUrl: this.avatarUrl || undefined
      };

      // Rafraîchir une dernière fois l'état du quiz avant d'ajouter le participant
      try {
        await this.refreshQuizState();
      } catch (error) {
        console.warn('[LOGIN] Erreur lors du rafraîchissement final:', error);
        // On continue même en cas d'erreur
      }
      
      // Add participant to server
      await this.quizService.addParticipant(user);
      
      // Vérifier que l'utilisateur a bien été ajouté
      const participants = await this.quizService.fetchParticipantsFromServer();
      const userAdded = participants.some((p: User) => p.id === user.id);
      
      if (!userAdded) {
        throw new Error('L\'utilisateur n\'a pas pu être ajouté au serveur. Veuillez réessayer.');
      }

      // Sauvegarder les informations utilisateur avec notre service
      this.userStateService.saveUserInfo(user);
      
      // Ces lignes sont maintenant redondantes mais on les garde pour la compatibilité
      localStorage.setItem('quiz-user', JSON.stringify(user));
      localStorage.setItem('userId', user.id);
      localStorage.setItem('userName', user.name);
      if (user.avatarUrl) {
        localStorage.setItem('avatarUrl', user.avatarUrl);
      }

      // Clear form
      this.name = '';
      this.github = '';
      this.avatarUrl = null;
      
      if (isDevMode()) console.log('[LOGIN] Utilisateur ajouté avec succès:', user.id);

      // Add small delay to ensure all async operations complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Navigate with multiple approaches
      try {
        const urlResult = await this.router.navigateByUrl('/waiting');
        
        if (!urlResult) {
          const navResult = await this.router.navigate(['/waiting']);
          
          if (!navResult) {
            // Force page navigation as last resort
            window.location.href = '/waiting';
            return;
          }
        }
      } catch (navError) {
        console.error('Navigation error:', navError);
        console.log('Forcing window location change due to error...');
        window.location.href = '/waiting';
      }

    } catch (error) {
      console.error('[LOGIN] Erreur:', error);
      alert('Erreur lors de l\'inscription. Veuillez réessayer.');
    } finally {
      this.isSubmitting = false;
    }
  }
}
