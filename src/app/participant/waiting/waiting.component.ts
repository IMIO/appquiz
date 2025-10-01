import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { QuizService, QuizStep } from '../../services/quiz-secure.service';
import { CommonModule } from '@angular/common';
import { User } from '../../models/user.model';
import { Subscription } from 'rxjs';

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
  private isDestroyed = false;

  constructor(private quizService: QuizService, private router: Router) {
    // Souscription à la synchronisation des questions via WebSocket
    this.questionsSyncSubscription = this.quizService['websocketTimerService'].getQuestionsSync().subscribe(async syncData => {
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
      if (userId && participants.length === 0 && consecutiveEmptyChecks >= 4 && elapsedTime > 12000) {
        // Vérification asynchrone avec le serveur
        this.verifyUserExistsOnServer(userId).then(userExists => {
          if (!userExists) {
            this.clearUserSession();
            this.cleanup();
            this.router.navigate(['/login']);
          } else {
            consecutiveEmptyChecks = 0;
          }
        });
        return; // Sortir de cette vérification en attendant le résultat async
      }
      lastParticipantCount = participants.length;
      if (userId && participants.length > 0 && !participants.find(u => u.id === userId)) {
        noParticipantCount++;
        if (noParticipantCount >= 3 && elapsedTime > this.minWaitTime) {
          this.clearUserSession();
          this.cleanup();
          this.router.navigate(['/login']);
        }
      } else if (userId && participants.find(u => u.id === userId)) {
        noParticipantCount = 0;
        consecutiveEmptyChecks = 0;
      }
    });
  }

  private async verifyUserExistsOnServer(userId: string): Promise<boolean> {
    try {
      const serverParticipants = await this.quizService.fetchParticipantsFromServer();
      return serverParticipants.some(p => p.id === userId);
    } catch (error) {
      return false; // En cas d'erreur, considérer que l'utilisateur n'existe pas
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
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('avatarUrl');
    localStorage.removeItem('quiz-user');
  }
}
