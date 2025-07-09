import { Injectable } from '@angular/core';
import { Subject, interval } from 'rxjs';
import { take } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class TimerService {
  private countdown$ = new Subject<number>();

  start(seconds: number = 15) {
    interval(1000).pipe(take(seconds + 1)).subscribe(i => {
      this.countdown$.next(seconds - i);
    });
  }

  getCountdown() {
    return this.countdown$.asObservable();
  }
}
