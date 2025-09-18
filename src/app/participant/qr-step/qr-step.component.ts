import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, UpperCasePipe, JsonPipe } from '@angular/common';
import { QRCodeComponent } from 'angularx-qrcode';
import { Router } from '@angular/router';
import { QuizService, QuizStep } from '../../services/quiz-secure.service';
import { Subscription } from 'rxjs';
import { User } from '../../models/user.model';
import { Question } from '../../models/question.model';

@Component({
  selector: 'app-qr-step',
  standalone: true,
  imports: [CommonModule, QRCodeComponent, UpperCasePipe, JsonPipe],
  templateUrl: './qr-step.component.html',
  styleUrls: ['./qr-step.component.css']
})
export class QrStepComponent implements OnInit, OnDestroy {
  step: QuizStep = 'lobby';
  participants: User[] = [];
  currentQuestion: Question | null = null;
  currentIndex: number = 0;
  windowLocation = window.location.origin;
  stats = { good: 0, bad: 0, none: 0 };
  
  private subscriptions: Subscription[] = [];

  constructor(
    public quizService: QuizService,
    private router: Router
  ) {}

  ngOnInit() {
    // Écoute de l'état du quiz
    const stepSub = this.quizService.getStep().subscribe(step => {
      this.step = step;
    });
    this.subscriptions.push(stepSub);

    // Écoute des participants
    const participantsSub = this.quizService.getParticipants$().subscribe(participants => {
      this.participants = participants;
    });
    this.subscriptions.push(participantsSub);

    // Écoute de l'index de question courante
    const indexSub = this.quizService.getCurrentIndex().subscribe(index => {
      this.currentIndex = index;
      this.currentQuestion = this.quizService.getCurrentQuestion(index);
    });
    this.subscriptions.push(indexSub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  launchGame() {
    this.quizService.setStep('waiting');
  }

  confirmLaunchGame() {
    if (confirm('Clôturer les inscriptions et passer à la phase d\'attente ?')) {
      this.launchGame();
    }
  }

  async resetParticipants() {
    if (!confirm('Êtes-vous sûr de vouloir réinitialiser tous les participants ?')) {
      return;
    }
    
    try {
      await this.quizService.resetParticipants();
      alert('Participants réinitialisés.');
    } catch (error) {
      console.error('Erreur lors de la réinitialisation:', error);
      alert('Erreur lors de la réinitialisation.');
    }
  }

  async restartGame() {
    if (!confirm('Êtes-vous sûr de vouloir réinitialiser complètement le quiz ?')) {
      return;
    }
    
    try {
      await this.quizService.resetParticipants();
      await this.quizService.setStep('lobby');
      alert('Quiz réinitialisé.');
    } catch (error) {
      console.error('Erreur lors de la réinitialisation:', error);
      alert('Erreur lors de la réinitialisation.');
    }
  }
}