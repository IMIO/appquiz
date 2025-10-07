import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminCrudService } from '../services/admin-crud.service';

@Component({
  selector: 'app-admin-crud-test',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3>🧪 Test CRUD - Diagnostic</h3>
      
      <!-- Authentification simple -->
      <div *ngIf="!isAuthenticated" style="margin-bottom: 20px;">
        <input 
          type="password" 
          [(ngModel)]="password" 
          placeholder="Mot de passe admin"
          style="padding: 8px; margin-right: 10px;">
        <button (click)="testAuth()" [disabled]="loading">
          {{ loading ? 'Test...' : 'Tester Auth' }}
        </button>
      </div>

      <!-- Résultats -->
      <div *ngIf="isAuthenticated">
        <button (click)="loadStats()" [disabled]="loading">Charger Stats</button>
        <button (click)="loadParticipants()" [disabled]="loading">Charger Participants</button>
        <button (click)="loadQuizState()" [disabled]="loading">Charger État Quiz</button>
        <button (click)="logout()">Déconnexion</button>
      </div>

      <!-- Messages -->
      <div *ngIf="error" style="color: red; margin: 10px 0;">❌ {{ error }}</div>
      <div *ngIf="success" style="color: green; margin: 10px 0;">✅ {{ success }}</div>

      <!-- Données -->
      <div *ngIf="stats" style="margin-top: 20px;">
        <h4>📊 Statistiques :</h4>
        <pre style="background: white; padding: 10px; font-size: 12px;">{{ stats | json }}</pre>
      </div>

      <div *ngIf="participants.length > 0" style="margin-top: 20px;">
        <h4>👥 Participants ({{ participants.length }}) :</h4>
        <div *ngFor="let p of participants" style="background: white; padding: 8px; margin: 4px 0; border-radius: 4px;">
          {{ p.name }} - Score: {{ p.score }} (ID: {{ p.id }})
        </div>
      </div>

      <div *ngIf="quizState" style="margin-top: 20px;">
        <h4>⚙️ État du Quiz :</h4>
        <pre style="background: white; padding: 10px; font-size: 12px;">{{ quizState | json }}</pre>
      </div>
    </div>
  `
})
export class AdminCrudTestComponent implements OnInit {
  password = '';
  isAuthenticated = false;
  loading = false;
  error = '';
  success = '';
  
  stats: any = null;
  participants: any[] = [];
  quizState: any = null;

  constructor(private adminCrudService: AdminCrudService) {}

  ngOnInit() {
    // Vérifier s'il y a un mot de passe sauvegardé
    const savedPassword = sessionStorage.getItem('admin_password');
    if (savedPassword) {
      this.password = savedPassword;
      this.testAuth();
    }
  }

  testAuth() {
    if (!this.password) {
      this.error = 'Mot de passe requis';
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    this.adminCrudService.getStats(this.password).subscribe({
      next: (stats) => {
        this.isAuthenticated = true;
        this.stats = stats;
        sessionStorage.setItem('admin_password', this.password);
        this.success = 'Authentification réussie !';
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.isAuthenticated = false;
        this.error = error.error?.error || 'Erreur d\'authentification';
        console.error('Erreur API:', error);
      }
    });
  }

  loadStats() {
    this.loading = true;
    this.adminCrudService.getStats(this.password).subscribe({
      next: (stats) => {
        this.stats = stats;
        this.success = 'Stats chargées !';
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Erreur chargement stats: ' + (error.error?.error || error.message);
        console.error('Erreur stats:', error);
      }
    });
  }

  loadParticipants() {
    this.loading = true;
    this.adminCrudService.getParticipants(this.password).subscribe({
      next: (participants) => {
        this.participants = participants;
        this.success = `${participants.length} participants chargés !`;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Erreur chargement participants: ' + (error.error?.error || error.message);
        console.error('Erreur participants:', error);
      }
    });
  }

  loadQuizState() {
    this.loading = true;
    this.adminCrudService.getQuizState(this.password).subscribe({
      next: (state) => {
        this.quizState = state;
        this.success = 'État du quiz chargé !';
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Erreur chargement état: ' + (error.error?.error || error.message);
        console.error('Erreur quiz state:', error);
      }
    });
  }

  logout() {
    this.isAuthenticated = false;
    this.password = '';
    this.stats = null;
    this.participants = [];
    this.quizState = null;
    sessionStorage.removeItem('admin_password');
    this.success = 'Déconnecté';
  }
}