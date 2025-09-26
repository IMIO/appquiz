import { Injectable } from '@angular/core';
import { Subject, interval } from 'rxjs';
import { take } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class TimerService {
  private countdown$ = new Subject<number>();
  private lastValue = 20;

  start(seconds: number = 20) {
    this.lastValue = seconds;
    interval(1000).pipe(take(seconds + 1)).subscribe(i => {
      const value = seconds - i;
      this.lastValue = value;
      this.countdown$.next(value);
    });
  }

  /** Force la fin du timer (envoie 0 immédiatement) */
  forceEnd() {
    this.lastValue = 0;
    this.countdown$.next(0);
  }

  getCountdown() {
    return this.countdown$.asObservable();
  }
}
