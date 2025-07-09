import { Component } from '@angular/core';
import { TimerService } from '../services/timer.service';

@Component({
  selector: 'app-admin',
  imports: [],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent {
  constructor(private timerService: TimerService) {}

  forceEndTimer() {
    this.timerService.forceEnd();
  }
}
