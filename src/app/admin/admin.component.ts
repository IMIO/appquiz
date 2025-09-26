import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimerService } from '../services/timer.service';
import { QuizService } from '../services/quiz-secure.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit, OnDestroy {
  currentQuestionIndex = 0;
  totalQuestions = 0;
  private subscriptions: Subscription[] = [];

  constructor(
    private timerService: TimerService,
    private quizService: QuizService
  ) {}

  ngOnInit() {
    // Écouter l'index de la question courante
    this.subscriptions.push(
      this.quizService.getCurrentIndex().subscribe(index => {
        console.log('[ADMIN] Index reçu:', index);
        this.currentQuestionIndex = index;
      })
    );

    // Écouter le nombre total de questions
    this.subscriptions.push(
      this.quizService.questions$.subscribe(questions => {
        console.log('[ADMIN] Questions reçues:', questions.length);
        this.totalQuestions = questions.length;
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  forceEndTimer() {
    this.timerService.forceEnd();
  }

  async nextQuestion() {
    try {
      console.log('[ADMIN] Tentative passage question suivante:', {
        currentQuestionIndex: this.currentQuestionIndex,
        totalQuestions: this.totalQuestions,
        canProceed: this.currentQuestionIndex < this.totalQuestions - 1
      });
      
      await this.quizService.nextQuestion(this.currentQuestionIndex);
      console.log(`[ADMIN] Question suivante appelée`);
    } catch (error) {
      console.error('[ADMIN] Erreur lors du passage à la question suivante:', error);
    }
  }
}
