import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { StateRestoreDialogComponent } from './presentation/state-restore-dialog.component';
import { QuizService } from './services/quiz-secure.service';
import { NotificationComponent } from './shared/notification.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NotificationComponent, StateRestoreDialogComponent],
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
