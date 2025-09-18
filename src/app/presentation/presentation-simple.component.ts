import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuizService } from '../services/quiz-secure.service';

@Component({
  selector: 'app-presentation',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="presentation-container">
      <h2>Résultats du Quiz</h2>
      <p>Cette version simplifiée affiche les résultats sans accès direct à SQLite.</p>
      <div *ngFor="let participant of participants">
        <p>{{ participant.name }} - Score: {{ participant.score || 0 }}</p>
      </div>
    </div>
  `,
  styles: [`
    .presentation-container {
      padding: 20px;
      text-align: center;
    }
  `]
})
export class PresentationComponent {
  participants: any[] = [];

  constructor(private quizService: QuizService) {
    this.loadParticipants();
  }

  async loadParticipants() {
    try {
      this.quizService.getParticipants$().subscribe(participants => {
        this.participants = participants;
      });
    } catch (error) {
      console.error('Erreur lors du chargement des participants:', error);
    }
  }
}