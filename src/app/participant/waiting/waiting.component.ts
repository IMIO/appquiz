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
  private isDestroyed = false;

  constructor(private quizService: QuizService, private router: Router) {
    this.stepSubscription = this.quizService.getStep().subscribe(step => {
      if (this.isDestroyed) return;
      
      console.log('[WAITING] Changement d\'étape détecté:', step, 'initialStepReceived:', this.initialStepReceived);
      this.step = step;
      
      if (step === 'question') {
        console.log('[WAITING] Navigation vers /quiz');
        this.cleanup();
        this.router.navigate(['/quiz']);
      } else if (step === 'lobby' && this.initialStepReceived) {
        console.log('[WAITING] Reset détecté (retour à lobby), redirection vers login');
        localStorage.removeItem('userId');
        localStorage.removeItem('userName');
        localStorage.removeItem('avatarUrl');
        localStorage.removeItem('quiz-user');
        this.cleanup();
        this.router.navigate(['/login']);
      } else if (step === 'lobby' && !this.initialStepReceived) {
        console.log('[WAITING] État lobby initial normal, pas de redirection');
        this.initialStepReceived = true;
      } else if (step !== 'lobby') {
        this.initialStepReceived = true;
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
      console.log('[WAITING] Vérification participants:', {
        userId,
        participantsCount: participants.length,
        participantsIds: participants.map(u => u.id),
        elapsedTime,
        minWaitTime: this.minWaitTime,
        lastParticipantCount,
        hasSeenParticipants,
        consecutiveEmptyChecks
      });
      
      if (participants.length > 0) {
        hasSeenParticipants = true;
        consecutiveEmptyChecks = 0;
      } else {
        consecutiveEmptyChecks++;
      }
      
      if (hasSeenParticipants && lastParticipantCount > 0 && participants.length === 0 && elapsedTime > 5000) {
        console.log('[WAITING] 🔄 Reset complet détecté (participants: ' + lastParticipantCount + ' → 0), redirection vers login');
        localStorage.removeItem('userId');
        localStorage.removeItem('userName');
        localStorage.removeItem('avatarUrl');
        localStorage.removeItem('quiz-user');
        this.cleanup();
        this.router.navigate(['/login']);
        return;
      }
      
      if (userId && participants.length === 0 && consecutiveEmptyChecks >= 4 && elapsedTime > 12000) {
        console.log('[WAITING] ⚠️ Aucun participant trouvé après reset probable, redirection vers login');
        localStorage.removeItem('userId');
        localStorage.removeItem('userName');
        localStorage.removeItem('avatarUrl');
        localStorage.removeItem('quiz-user');
        this.cleanup();
        this.router.navigate(['/login']);
        return;
      }
      
      lastParticipantCount = participants.length;
      
      if (userId && participants.length > 0 && !participants.find(u => u.id === userId)) {
        noParticipantCount++;
        console.log('[WAITING] ⚠️ Participant non trouvé, compteur:', noParticipantCount, 'temps écoulé:', elapsedTime);
        
        if (noParticipantCount >= 3 && elapsedTime > this.minWaitTime) {
          console.log('[WAITING] ❌ Redirection vers login après confirmation');
          this.cleanup();
          this.router.navigate(['/login']);
        }
      } else if (userId && participants.find(u => u.id === userId)) {
        noParticipantCount = 0;
        consecutiveEmptyChecks = 0;
        console.log('[WAITING] ✅ Participant trouvé, reset compteurs');
      } else if (participants.length === 0 && !hasSeenParticipants) {
        console.log('[WAITING] ℹ️ Aucun participant encore, attente... (vérification ' + consecutiveEmptyChecks + ')');
      }
    });
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
  }

  ngOnDestroy(): void {
    console.log('[WAITING] Composant détruit, nettoyage des subscriptions');
    this.cleanup();
  }
}
