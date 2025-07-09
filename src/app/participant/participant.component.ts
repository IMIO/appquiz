
import { Component, OnInit } from '@angular/core';
import { QuizService, QuizStep } from '../services/quiz.service';
import { User } from '../models/user.model';
import { Subscription } from 'rxjs';


import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-participant',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './participant.html',
  styleUrls: ['./participant.css']
})
export class Participant implements OnInit {
  userId: string = '';
  userName: string = '';
  avatarUrl: string | null = null;
  totalScore: number = 0;
  totalQuestions: number = 0;
  step: QuizStep = 'lobby';
  leaderboard: User[] = [];
  personalScore: { good: number, bad: number, none: number } = { good: 0, bad: 0, none: 0 };
  questionResults: { good: number, bad: number, none: number }[] = [];
  currentIndex: number = 0;
  answersSub?: Subscription;

  constructor(private quizService: QuizService) {}

  ngOnInit(): void {
    this.userId = localStorage.getItem('userId') || '';
    this.userName = localStorage.getItem('userName') || '';
    this.avatarUrl = localStorage.getItem('avatarUrl');
    this.totalQuestions = this.quizService.getQuestions().length;

    this.quizService.getStep().subscribe((step: QuizStep) => {
      this.step = step;
    });
    this.quizService.getCurrentIndex().subscribe(idx => {
      this.currentIndex = idx;
    });
    if (this.answersSub) this.answersSub.unsubscribe();
    this.answersSub = this.quizService.getAllAnswersForUser$(this.userId).subscribe(allAnswers => {
      if (!this.quizService['questions'] || this.quizService['questions'].length === 0) {
        return;
      }
      this.questionResults = allAnswers.map((entry, i) => {
        const currentQ = this.quizService.getCurrentQuestion(i);
        const myAnswer = entry.answer;
        let result = { good: 0, bad: 0, none: 0 };
        if (myAnswer && currentQ) {
          if (Number(myAnswer.answerIndex) === Number(currentQ.correctIndex)) {
            result = { good: 1, bad: 0, none: 0 };
          } else if (Number(myAnswer.answerIndex) === -1) {
            result = { good: 0, bad: 0, none: 1 };
          } else {
            result = { good: 0, bad: 1, none: 0 };
          }
        } else {
          result = { good: 0, bad: 0, none: 1 };
        }
        return result;
      });
      this.totalScore = this.questionResults.reduce((sum, r) => sum + (r?.good || 0), 0);
      this.personalScore = this.questionResults[this.currentIndex] || { good: 0, bad: 0, none: 0 };
    });
  }
}
