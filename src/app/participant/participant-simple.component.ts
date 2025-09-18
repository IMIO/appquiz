import { Component, ChangeDetectorRef } from '@angular/core';
import { QuizService, QuizStep } from '../services/quiz-secure.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { User } from '../models/user.model';

@Component({
  selector: 'app-participant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="participant-container">
      <div *ngIf="quizStep === 'lobby'">
        <h2>Rejoindre le Quiz</h2>
        <input 
          [(ngModel)]="nameInput" 
          placeholder="Votre nom"
          class="name-input"
        />
        <button (click)="submitName()" [disabled]="!nameInput.trim()">
          Rejoindre
        </button>
      </div>
      <div *ngIf="quizStep === 'waiting'">
        <h2>En attente du début du quiz...</h2>
      </div>
      <div *ngIf="quizStep === 'question'">
        <h2>Question en cours</h2>
        <p>Veuillez utiliser l'interface complète du quiz.</p>
      </div>
    </div>
  `,
  styles: [`
    .participant-container {
      padding: 20px;
      text-align: center;
    }
    .name-input {
      padding: 10px;
      margin: 10px;
      border: 1px solid #ccc;
      border-radius: 4px;
    }
    button {
      padding: 10px 20px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
  `]
})
export class Participant {
  nameInput: string = '';
  userId: string = '';
  quizStep: QuizStep = 'lobby';

  constructor(
    public quizService: QuizService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {
    this.userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    this.checkQuizState();
  }

  private checkQuizState() {
    // Architecture HTTP : utiliser les observables du service
    this.quizService.getStep().subscribe(step => {
      if (step) {
        this.quizStep = step as QuizStep;
        this.cdr.markForCheck();
      }
    });
  }

  async submitName() {
    if (this.nameInput.trim() && this.nameInput.trim().length > 0) {
      // Via l'API HTTP sécurisée
      const user: User = {
        id: this.userId,
        name: this.nameInput.trim(),
        score: 0,
        answers: []
      };
      
      await this.quizService.addParticipant(user);
      this.router.navigate(['/participant/quiz']);
    }
  }
}