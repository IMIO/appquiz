import { Component, OnDestroy, isDevMode, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { QuizService, QuizStep } from '../../services/quiz-secure.service';
import { CommonModule } from '@angular/common';
import { User } from '../../models/user.model';
import { Subscription } from 'rxjs';
import { NotificationService } from '../../services/notification.service';
import { UserStateService } from '../../services/user-state.service';

@Component({
  selector: 'app-waiting',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './waiting.component.html',
  styleUrls: ['./waiting.component.css']
})
export class WaitingComponent implements OnDestroy {
  step: QuizStep = 'lobby';
  private checkStartTime: number = Date.now();
  private minWaitTime: number = 8000;
  private initialStepReceived = false;
  
  private stepSubscription?: Subscription;
  private participantsSubscription?: Subscription;
  private questionsSyncSubscription?: Subscription;
  private websocketTimerSub?: Subscription;
  private resetDetectionInterval?: any;
  private websocketReconnectSubscription?: Subscription;
  private isDestroyed = false;
  private lastKnownStep: QuizStep = 'lobby';

  constructor(
    private quizService: QuizService, 
    private router: Router,
    private notificationService: NotificationService,
    private ngZone: NgZone,
    private userStateService: UserStateService
  ) {
    // On évite la vérification immédiate pour ne pas déclencher de fausses réinitialisations
    // lorsque l'utilisateur vient de s'inscrire
    if (isDevMode()) {
      const userId = localStorage.getItem('userId');
      console.log('[WAITING] Démarrage composant avec userId:', userId);
    }
    
    // Vérification initiale de l'utilisateur
    this.verifyUserOnStart();
    
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
          console.error('[WAITING][WS] Erreur lors du rechargement des questions:', e);
        }
      }
    });
    this.stepSubscription = this.quizService.getStep().subscribe(async step => {
      if (this.isDestroyed) return;
      this.step = step;
      console.log('[WAITING][STEP] step reçu :', step);
      // Forcer un refresh de l'état du quiz si on reste bloqué
      if (step !== 'lobby' && step !== 'question') {
        try {
          const forcedStep = await this.quizService.forceCheckState();
          console.log('[WAITING][STEP] forceCheckState() =>', forcedStep);
          if (forcedStep === 'lobby' && this.initialStepReceived) {
            this.clearUserSession();
            this.cleanup();
            this.router.navigate(['/login']);
            return;
          }
        } catch (e) {
          console.warn('[WAITING][STEP] Erreur forceCheckState:', e);
        }
      }
      if (step === 'question') {
        this.cleanup();
        this.router.navigate(['/quiz']);
      } else if (step === 'lobby') {
        if (this.initialStepReceived) {
          this.clearUserSession();
          this.cleanup();
          this.router.navigate(['/login']);
        } else {
          this.initialStepReceived = true;
        }
      }
    });
    
    const userId = localStorage.getItem('userId');
    let noParticipantCount = 0;
    let lastParticipantCount = 0;
    let hasSeenParticipants = false;
    let consecutiveEmptyChecks = 0;
    
    console.log('[WAITING] Démarrage du composant, userId:', userId);
    
    this.participantsSubscription = this.quizService.getParticipants$().subscribe((participants: User[]) => {
      if (this.isDestroyed) return;
      const elapsedTime = Date.now() - this.checkStartTime;
      if (participants.length > 0) {
        hasSeenParticipants = true;
        consecutiveEmptyChecks = 0;
      } else {
        consecutiveEmptyChecks++;
      }
      if (hasSeenParticipants && lastParticipantCount > 0 && participants.length === 0 && elapsedTime > 5000) {
        this.clearUserSession();
        this.cleanup();
        this.router.navigate(['/login']);
        return;
      }
      if (userId && participants.length === 0 && consecutiveEmptyChecks >= 5 && elapsedTime > 5000) {
        // Vérification asynchrone avec le serveur
        this.verifyUserExistsOnServer(userId).then(userExists => {
          if (!userExists) {
            // Tentative de réinscription automatique
            this.quizService.forceCheckState().then((currentState) => {
              if (currentState === 'lobby') {
                try {
                  const userData = this.userStateService.getUserInfo();
                  if (userData && userData.id && userData.name) {
                    this.quizService.addParticipant({
                      id: userData.id,
                      name: userData.name,
                      avatarUrl: userData.avatarUrl || '',
                      score: 0,
                      answers: []
                    }).then(() => {
                      console.log('[WAITING] Réinscription automatique réussie!');
                      consecutiveEmptyChecks = 0;
                    }).catch(err => {
                      console.warn('[WAITING] Échec réinscription automatique:', err);
                      this.clearUserSession();
                      this.cleanup();
                      localStorage.setItem('quiz_reset_notification', 'true');
                      this.router.navigate(['/login']);
                    });
                  } else {
                    this.clearUserSession();
                    this.cleanup();
                    localStorage.setItem('quiz_reset_notification', 'true');
                    this.router.navigate(['/login']);
                  }
                } catch (err) {
                  console.warn('[WAITING] Échec réinscription automatique:', err);
                  this.clearUserSession();
                  this.cleanup();
                  localStorage.setItem('quiz_reset_notification', 'true');
                  this.router.navigate(['/login']);
                }
              } else {
                this.clearUserSession();
                this.cleanup();
                localStorage.setItem('quiz_reset_notification', 'true');
                this.router.navigate(['/login']);
              }
            });
          } else {
            consecutiveEmptyChecks = 0;
          }
        });
        return; // Sortir de cette vérification en attendant le résultat async
      }
      lastParticipantCount = participants.length;
      if (userId && participants.length > 0 && !participants.find(u => u.id === userId)) {
        noParticipantCount++;
        
        if (noParticipantCount >= 4 && elapsedTime > this.minWaitTime) {
          // Tentative de réinscription avant déconnexion
          const userData = this.userStateService.getUserInfo();
          if (userData && userData.id && userData.name) {
            this.quizService.forceCheckState().then((currentState) => {
              if (currentState === 'lobby') {
                try {
                  this.quizService.addParticipant({
                    id: userData.id,
                    name: userData.name,
                    avatarUrl: userData.avatarUrl || '',
                    score: 0,
                    answers: []
                  }).then(() => {
                    console.log('[WAITING] Réinscription automatique réussie (utilisateur non trouvé dans liste)!');
                    noParticipantCount = 0;
                  }).catch(err => {
                    console.warn('[WAITING] Échec réinscription automatique:', err);
                    this.clearUserSession();
                    this.cleanup();
                    localStorage.setItem('quiz_reset_notification', 'true');
                    this.router.navigate(['/login']);
                  });
                } catch (err) {
                  console.warn('[WAITING] Échec réinscription automatique:', err);
                  this.clearUserSession();
                  this.cleanup();
                  localStorage.setItem('quiz_reset_notification', 'true');
                  this.router.navigate(['/login']);
                }
              } else {
                this.clearUserSession();
                this.cleanup();
                localStorage.setItem('quiz_reset_notification', 'true');
                this.router.navigate(['/login']);
              }
            });
          } else {
            this.clearUserSession();
            this.cleanup();
            localStorage.setItem('quiz_reset_notification', 'true');
            this.router.navigate(['/login']);
          }
        }
      } else if (userId && participants.find(u => u.id === userId)) {
        noParticipantCount = 0;
        consecutiveEmptyChecks = 0;
      }
    });
  }

  private async verifyUserExistsOnServer(userId: string): Promise<boolean> {
    try {
      if (isDevMode()) console.log('[WAITING] Vérification utilisateur sur le serveur');
      const serverParticipants = await this.quizService.fetchParticipantsFromServer();
      
      // Si la liste est vide mais nous avons un ID, ne pas considérer immédiatement 
      // que l'utilisateur n'existe pas (peut être un problème temporaire)
      if (serverParticipants.length === 0) {
        console.log('[WAITING] Liste des participants vide, cela peut être temporaire');
        
        // Stratégie améliorée : si la liste est vide, considérer que l'utilisateur existe toujours
        // pour éviter de déconnecter les utilisateurs lors de problèmes temporaires du serveur
        if (localStorage.getItem('userId') === userId) {
          console.log('[WAITING] Liste vide mais utilisateur en localStorage, considéré comme présent');
          return true;
        }
      }
      
      const exists = serverParticipants.some(p => p.id === userId);
      
      if (exists) {
        console.log('[WAITING] ✅ Utilisateur trouvé sur le serveur');
      } else if (serverParticipants.length > 0) {
        // Seulement si la liste n'est pas vide, on peut être sûr que l'utilisateur n'existe vraiment pas
        console.log(`[WAITING] ❌ Utilisateur non trouvé parmi ${serverParticipants.length} participants`);
      }
      
      return exists;
    } catch (error) {
      console.error('[WAITING] Erreur vérification utilisateur:', error);
      
      // Même en cas d'erreur, on ne considère pas automatiquement que l'utilisateur n'existe pas
      // Car cela peut être une erreur temporaire de connexion
      // On préfère considérer que l'utilisateur existe toujours en cas d'erreur
      return true;
    }
  }

  /**
   * Vérifie l'état de l'utilisateur au démarrage du composant
   */
  private async verifyUserOnStart(): Promise<void> {
    try {
      // Utiliser le service UserState pour récupérer les informations utilisateur
      const userData = this.userStateService.getUserInfo();
      
      if (!userData || !userData.id || !userData.name) {
        console.warn('[WAITING] Informations utilisateur insuffisantes au démarrage, redirection vers login');
        this.router.navigate(['/login']);
        return;
      }
      
      const userId = userData.id;
      const userName = userData.name;
      const avatarUrl = userData.avatarUrl || '';
      
      console.log('[WAITING] Vérification de l\'utilisateur au démarrage - ID:', userId, 'Nom:', userName);
      
      // Tenter plusieurs fois de vérifier si l'utilisateur existe sur le serveur
      // (pour gérer les cas de rafraîchissement où la liste peut être temporairement vide)
      let exists = false;
      const maxAttempts = 10; // Augmenté à 10 tentatives
      
      for (let i = 0; i < maxAttempts; i++) {
        exists = await this.verifyUserExistsOnServer(userId);
        
        if (exists) {
          break;
        }
        
        if (i < maxAttempts - 1) {
          console.log(`[WAITING] Utilisateur non trouvé au démarrage, tentative ${i + 1}/${maxAttempts}...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Attendre 1000ms entre les tentatives
        }
      }
      
      // Si l'utilisateur n'existe toujours pas après plusieurs tentatives
      if (!exists) {
        console.log('[WAITING] Utilisateur non trouvé après plusieurs tentatives, essai de réinscription...');
        
        // Vérifier d'abord l'étape actuelle du quiz
        const currentState = await this.quizService.forceCheckState();
        
        // Si nous sommes dans l'étape lobby, tenter de réinscrire l'utilisateur
        if (currentState === 'lobby') {
          try {
            // Tenter de réinscrire l'utilisateur
            await this.quizService.addParticipant({
              id: userId,
              name: userName,
              avatarUrl: avatarUrl || '',
              score: 0,
              answers: []
            });
            
            console.log('[WAITING] Tentative de réinscription de l\'utilisateur...');
            
            // Vérifier si la réinscription a fonctionné
            exists = await this.verifyUserExistsOnServer(userId);
            
            if (exists) {
              console.log('[WAITING] ✅ Réinscription réussie!');
              
              // Sauvegarder à nouveau pour garantir la persistance
              this.userStateService.saveUserInfo({
                id: userId,
                name: userName,
                avatarUrl: avatarUrl || '',
                score: 0,
                answers: []
              });
            } else {
              console.warn('[WAITING] ❌ Réinscription échouée');
              
              // Nettoyer les données et rediriger
              this.userStateService.clearUserInfo();
              localStorage.setItem('quiz_reset_notification', 'true');
              this.router.navigate(['/login']);
              return;
            }
          } catch (error) {
            console.error('[WAITING] Erreur lors de la tentative de réinscription:', error);
            
            // Nettoyer les données et rediriger
            this.userStateService.clearUserInfo();
            localStorage.setItem('quiz_reset_notification', 'true');
            this.router.navigate(['/login']);
            return;
          }
        } else {
          // Si nous ne sommes pas dans l'étape lobby, on ne peut pas réinscrire l'utilisateur
          console.warn('[WAITING] Utilisateur non trouvé au démarrage et étape non lobby:', currentState);
          
          // Nettoyer les données et rediriger
          this.userStateService.clearUserInfo();
          localStorage.setItem('quiz_reset_notification', 'true');
          this.router.navigate(['/login']);
          return;
        }
      }
      
      // Vérifier l'état du quiz
      const currentState = await this.quizService.forceCheckState();
      this.lastKnownStep = currentState;
      
      console.log('[WAITING] Vérification initiale OK - userId:', userId, 'étape:', currentState);
    } catch (error) {
      console.error('[WAITING] Erreur lors de la vérification initiale:', error);
    }
  }

  private cleanup(): void {
    this.isDestroyed = true;
    if (this.stepSubscription) {
      this.stepSubscription.unsubscribe();
      this.stepSubscription = undefined;
    }
    if (this.participantsSubscription) {
      this.participantsSubscription.unsubscribe();
      this.participantsSubscription = undefined;
    }
    if (this.questionsSyncSubscription) {
      this.questionsSyncSubscription.unsubscribe();
      this.questionsSyncSubscription = undefined;
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private clearUserSession(): void {
    // Utiliser le service pour nettoyer toutes les informations utilisateur
    this.userStateService.clearUserInfo();
  }
}
