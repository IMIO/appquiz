import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { QuizService } from './services/quiz-secure.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'QuizApp';

  constructor(private quizService: QuizService) {}

  ngOnInit() {
    // Initialiser les questions depuis SQLite
    this.quizService.initQuestions();
  }
}
