import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { NotificationService, Notification } from '../services/notification.service';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="notification" 
         [@notificationAnimation]
         class="notification-container" 
         [ngClass]="'notification-' + notification.type">
      <div class="notification-content">
        <span *ngIf="notification.icon" class="notification-icon">{{ notification.icon }}</span>
        <span class="notification-message">{{ notification.message }}</span>
      </div>
      <button class="notification-close" (click)="clearNotification()">✕</button>
    </div>
  `,
  styles: [`
    .notification-container {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-width: 300px;
      max-width: 500px;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      font-family: 'Roboto', sans-serif;
    }

    .notification-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .notification-icon {
      font-size: 1.2em;
    }

    .notification-message {
      font-size: 1em;
      line-height: 1.4;
      font-weight: 500;
    }

    .notification-close {
      background: none;
      border: none;
      font-size: 1em;
      cursor: pointer;
      opacity: 0.6;
      transition: opacity 0.2s;
      padding: 0 0 0 15px;
      color: inherit;
    }

    .notification-close:hover {
      opacity: 1;
    }

    /* Types de notifications */
    .notification-success {
      background-color: #d4edda;
      border-color: #c3e6cb;
      color: #155724;
    }

    .notification-info {
      background-color: #cce5ff;
      border-color: #b8daff;
      color: #004085;
    }

    .notification-warning {
      background-color: #fff3cd;
      border-color: #ffeeba;
      color: #856404;
    }

    .notification-error {
      background-color: #f8d7da;
      border-color: #f5c6cb;
      color: #721c24;
    }
  `],
  animations: [
    trigger('notificationAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-50%) translateY(-20px)' }),
        animate('300ms cubic-bezier(0.4, 0.0, 0.2, 1)', 
          style({ opacity: 1, transform: 'translateX(-50%) translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms cubic-bezier(0.4, 0.0, 0.2, 1)', 
          style({ opacity: 0, transform: 'translateX(-50%) translateY(-20px)' }))
      ])
    ])
  ]
})
export class NotificationComponent implements OnInit, OnDestroy {
  notification: Notification | null = null;
  private subscription: Subscription | null = null;

  constructor(private notificationService: NotificationService) { }

  ngOnInit(): void {
    this.subscription = this.notificationService.notification$.subscribe(
      notification => {
        this.notification = notification;
      }
    );
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  clearNotification(): void {
    this.notificationService.clearNotification();
  }
}