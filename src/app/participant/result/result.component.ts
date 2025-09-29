import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { QuizService, QuizStep } from '../../services/quiz-secure.service';

@Component({
  selector: 'app-result',
  standalone: true,
  templateUrl: './result.component.html',
  styleUrls: ['./result.component.css']
})
export class ResultComponent {
  private hasReceivedFirstStep = false;

  constructor(private quizService: QuizService, private router: Router) {
    // Écouter les changements d'étape pour détecter un reset
    this.quizService.getStep().subscribe(step => {
      console.log('[RESULT] Changement d\'étape détecté:', step);
      
      // Si c'est le premier step et c'est lobby, c'est normal
      if (!this.hasReceivedFirstStep && step === 'lobby') {
        this.hasReceivedFirstStep = true;
        console.log('[RESULT] État initial lobby, pas de reset');
        return;
      }
      
      // Si on a déjà reçu un step et qu'on revient à lobby, c'est un reset
      if (step === 'lobby' && this.hasReceivedFirstStep) {
        console.log('[RESULT] Reset détecté, redirection vers login');
        localStorage.removeItem('userId');
        localStorage.removeItem('userName');
        localStorage.removeItem('avatarUrl');
        localStorage.removeItem('quiz-user');
        this.router.navigate(['/login']);
      } else {
        this.hasReceivedFirstStep = true;
      }
    });
  }
}
