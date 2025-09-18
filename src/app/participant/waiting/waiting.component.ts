import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuizService, QuizStep } from '../../services/quiz-secure.service';
import { Router } from '@angular/router';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-waiting',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './waiting.component.html',
  styleUrls: ['./waiting.component.css']
})
export class WaitingComponent {
  step: QuizStep = 'lobby';

  constructor(private quizService: QuizService, private router: Router) {
    this.quizService.getStep().subscribe(step => {
      this.step = step;
      if (step === 'question') {
        this.router.navigate(['/quiz']);
      }
    });
    // Redirige vers /login si l'utilisateur n'est plus inscrit (clear)
    const userId = localStorage.getItem('userId');
    this.quizService.getParticipants$().subscribe((participants: User[]) => {
      console.log('[WAITING] userId localStorage =', userId, '| participants =', participants.map(u => u.id));
      if (userId && !participants.find(u => u.id === userId)) {
        this.router.navigate(['/login']);
      }
    });
  }
}
