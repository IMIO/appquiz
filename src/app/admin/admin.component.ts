import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimerService } from '../services/timer.service';
import { QuizService } from '../services/quiz-secure.service';
import { Subscription } from 'rxjs';
import { AdminCrudTestComponent } from '../admin-crud-test/admin-crud-test.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, AdminCrudTestComponent],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit, OnDestroy {
  currentQuestionIndex = 0;
  totalQuestions = 0;
  private subscriptions: Subscription[] = [];

  selectedImageFile: File | null = null;
  selectedImageUrl: string | null = null;

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

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedImageFile = input.files[0];
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.selectedImageUrl = e.target.result;
      };
      reader.readAsDataURL(this.selectedImageFile);

      // Upload immédiat dès sélection
      this.uploadImageToBackend(this.selectedImageFile);
    } else {
      this.selectedImageFile = null;
      this.selectedImageUrl = null;
    }
  }

  async uploadImageToBackend(file: File) {
    try {
      const url = await this.quizService.uploadQuestionImage(file);
      console.log('[ADMIN] Image uploadée, URL:', url);
        // Associer l’URL à la question courante
        this.selectedImageUrl = url;
        // Mettre à jour la question courante côté service (si possible)
        const question = this.quizService.getCurrentQuestion(this.currentQuestionIndex);
        if (question) {
          question.imageUrl = url;
        // Sauvegarder l’URL en base
        await this.quizService.updateQuestionImageUrl(question.id, url);
        }
    } catch (error) {
      console.error('[ADMIN] Erreur upload image:', error);
    }
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
