import { Component, OnInit, OnDestroy, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuizService, QuizStep } from '../services/quiz-secure.service';
import { Subscription } from 'rxjs';

/**
 * Composant invisible qui surveille les changements d'étape du quiz
 * et déclenche une mise à jour du leaderboard au moment approprié.
 * Ce composant est conçu pour être intégré dans le composant de présentation
 * et résoudre les problèmes de synchronisation du classement.
 */
@Component({
  selector: 'app-leaderboard-sync',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Composant invisible qui surveille les étapes et déclenche les mises à jour -->
    <div style="display: none;">Synchroniseur de classement actif</div>
  `,
})
export class LeaderboardSyncComponent implements OnInit, OnDestroy {
  @Output() updateLeaderboard = new EventEmitter<string>();
  @Input() autoRefresh: boolean = true;
  
  private subscriptions: Subscription[] = [];
  private lastStep: QuizStep | null = null;
  
  constructor(private quizService: QuizService) {}
  
  ngOnInit(): void {
    if (this.autoRefresh) {
      this.initializeStepWatcher();
    }
  }
  
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  private initializeStepWatcher(): void {
    // S'abonner aux changements d'étape
    const stepSub = this.quizService.getStep().subscribe(step => {
      if (step === this.lastStep) return;
      
      console.log(`[LEADERBOARD-SYNC] Changement d'étape détecté: ${this.lastStep || 'aucune'} -> ${step}`);
      this.lastStep = step;
      
      // Déclencher une mise à jour du leaderboard à des moments spécifiques
      if (step === 'result' || step === 'end') {
        console.log(`[LEADERBOARD-SYNC] Étape ${step} détectée, déclenchement mise à jour du leaderboard`);
        
        // Attendre un peu pour laisser le temps aux données de se mettre à jour
        setTimeout(() => {
          this.updateLeaderboard.emit(step);
        }, 500);
      }
    });
    
    this.subscriptions.push(stepSub);
    
    // S'abonner aux changements d'index de question pour mettre à jour après chaque question
    const indexSub = this.quizService.getCurrentIndex().subscribe(index => {
      console.log(`[LEADERBOARD-SYNC] Changement d'index question: ${index}`);
      
      if (this.lastStep === 'result' || this.lastStep === 'end') {
        // Attendre un peu pour laisser le temps aux données de se mettre à jour
        setTimeout(() => {
          this.updateLeaderboard.emit('index-change');
        }, 500);
      }
    });
    
    this.subscriptions.push(indexSub);
  }
  
  // Méthode publique pour forcer une mise à jour
  public forceUpdate(): void {
    console.log('[LEADERBOARD-SYNC] Mise à jour forcée du leaderboard');
    this.updateLeaderboard.emit('force-update');
  }
}