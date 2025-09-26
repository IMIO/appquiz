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

  constructor(private quizService: QuizService, private router: Router) {
    // Écouter les changements d'étape pour détecter un reset
    this.quizService.getStep().subscribe(step => {
      console.log('[RESULT] Changement d\'étape détecté:', step);
      
      if (step === 'lobby') {
        // Si l'étape revient à lobby (reset), rediriger vers login
        console.log('[RESULT] Reset détecté, redirection vers login');
        localStorage.removeItem('userId');
        localStorage.removeItem('userName');
        localStorage.removeItem('avatarUrl');
        this.router.navigate(['/login']);
      }
    });
  }
}
