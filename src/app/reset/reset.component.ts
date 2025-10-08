import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuizService } from '../services/quiz-secure.service';
import { AdminCrudService } from '../services/admin-crud.service';

@Component({
  selector: 'app-reset',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="reset-container">
      
      <!-- Interface d'authentification admin -->
      <div *ngIf="!isAuthenticated" class="auth-section">
        <div class="auth-card">
          <div class="icon">🔐</div>
          <h2>Réinitialisation du Quiz</h2>
          <p class="warning">⚠️ Cette action supprimera définitivement tous les participants et leurs données !</p>
          
          <form (ngSubmit)="authenticate()" class="auth-form">
            <div class="form-group">
              <label for="password">Mot de passe administrateur :</label>
              <input 
                type="password" 
                id="password"
                [(ngModel)]="adminPassword" 
                name="password"
                required
                [disabled]="loading"
                placeholder="Entrez le mot de passe admin">
            </div>
            <button type="submit" class="btn-primary" [disabled]="loading || !adminPassword">
              {{ loading ? 'Vérification...' : 'Vérifier l\\'accès' }}
            </button>
          </form>
          
          <div *ngIf="error" class="error">{{ error }}</div>
          
          <div class="navigation">
            <button (click)="goBack()" class="btn-secondary">
              ← Retour à l'administration
            </button>
          </div>
        </div>
      </div>

      <!-- Interface de confirmation du reset -->
      <div *ngIf="isAuthenticated && !isResetting" class="confirm-section">
        <div class="confirm-card">
          <div class="icon danger">🚨</div>
          <h2>Confirmation de Réinitialisation</h2>
          <div class="danger-zone">
            <h3>⚠️ ATTENTION - Action Irréversible</h3>
            <p>Cette action va :</p>
            <ul>
              <li>🗑️ Supprimer tous les participants inscrits</li>
              <li>🗑️ Effacer toutes les réponses données</li>
              <li>🔄 Remettre le quiz à l'étape "lobby"</li>
              <li>📡 Notifier tous les clients connectés</li>
            </ul>
            <p class="final-warning">
              <strong>Cette action ne peut pas être annulée !</strong>
            </p>
          </div>
          
          <div class="confirmation-checkbox">
            <label>
              <input type="checkbox" [(ngModel)]="confirmReset">
              Je comprends que cette action est irréversible
            </label>
          </div>
          
          <div class="action-buttons">
            <button (click)="performReset()" 
                    class="btn-danger" 
                    [disabled]="!confirmReset || loading">
              {{ loading ? 'Réinitialisation...' : '🔄 RÉINITIALISER LE QUIZ' }}
            </button>
            <button (click)="goBack()" class="btn-secondary">
              ❌ Annuler
            </button>
          </div>
        </div>
      </div>

      <!-- Interface de progression du reset -->
      <div *ngIf="isResetting" class="progress-section">
        <div class="progress-card">
          <div class="icon">🔄</div>
          <h2>Réinitialisation en cours...</h2>
          <p>Remise à zéro complète du quiz</p>
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
          <p class="progress-text">{{ progressText }}</p>
        </div>
      </div>

    </div>

    <style>
      .reset-container {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        padding: 20px;
      }

      .auth-section, .confirm-section, .progress-section {
        width: 100%;
        max-width: 500px;
      }

      .auth-card, .confirm-card, .progress-card {
        text-align: center;
        padding: 2rem;
        border-radius: 12px;
        background: rgba(255,255,255,0.1);
        backdrop-filter: blur(10px);
        box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        border: 1px solid rgba(255,255,255,0.2);
      }

      .icon {
        font-size: 3rem;
        margin-bottom: 1rem;
      }

      .icon.danger {
        animation: pulse 2s infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }

      h2 {
        margin-bottom: 1rem;
        font-size: 1.5rem;
      }

      .warning {
        background: rgba(255, 193, 7, 0.2);
        border: 1px solid rgba(255, 193, 7, 0.5);
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 20px;
        color: #ffc107;
      }

      .auth-form {
        display: flex;
        flex-direction: column;
        gap: 15px;
        text-align: left;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .form-group label {
        font-weight: 600;
        color: #e8e8e8;
      }

      .form-group input {
        padding: 12px;
        border: 2px solid rgba(255,255,255,0.3);
        border-radius: 8px;
        background: rgba(255,255,255,0.1);
        color: white;
        font-size: 16px;
      }

      .form-group input:focus {
        outline: none;
        border-color: rgba(255,255,255,0.8);
        background: rgba(255,255,255,0.2);
      }

      .form-group input::placeholder {
        color: rgba(255,255,255,0.6);
      }

      .danger-zone {
        background: rgba(220, 53, 69, 0.2);
        border: 1px solid rgba(220, 53, 69, 0.5);
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
        text-align: left;
      }

      .danger-zone h3 {
        margin-top: 0;
        color: #ff6b6b;
      }

      .danger-zone ul {
        margin: 15px 0;
        padding-left: 20px;
      }

      .danger-zone li {
        margin-bottom: 8px;
      }

      .final-warning {
        background: rgba(220, 53, 69, 0.3);
        padding: 10px;
        border-radius: 4px;
        margin-top: 15px;
        text-align: center;
      }

      .confirmation-checkbox {
        margin: 20px 0;
      }

      .confirmation-checkbox label {
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        font-size: 14px;
      }

      .confirmation-checkbox input[type="checkbox"] {
        width: 18px;
        height: 18px;
      }

      .action-buttons {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 25px;
      }

      .btn-primary, .btn-secondary, .btn-danger {
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 600;
        transition: all 0.3s ease;
        text-decoration: none;
      }

      .btn-primary {
        background: #28a745;
        color: white;
      }

      .btn-primary:hover:not(:disabled) {
        background: #218838;
      }

      .btn-secondary {
        background: rgba(255,255,255,0.2);
        color: white;
        border: 1px solid rgba(255,255,255,0.3);
      }

      .btn-secondary:hover {
        background: rgba(255,255,255,0.3);
      }

      .btn-danger {
        background: #dc3545;
        color: white;
        font-size: 18px;
        padding: 15px 30px;
      }

      .btn-danger:hover:not(:disabled) {
        background: #c82333;
      }

      .btn-primary:disabled, .btn-danger:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .error {
        background: rgba(220, 53, 69, 0.3);
        border: 1px solid rgba(220, 53, 69, 0.5);
        color: #ff6b6b;
        padding: 12px;
        border-radius: 8px;
        margin-top: 15px;
      }

      .navigation {
        margin-top: 25px;
      }

      .progress-bar {
        margin: 20px 0;
        width: 100%;
        height: 8px;
        background: rgba(255,255,255,0.2);
        border-radius: 4px;
        overflow: hidden;
      }

      .progress-fill {
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, #ff6b6b, #4ecdc4, #45b7d1);
        animation: loading 2s ease-in-out infinite;
      }

      @keyframes loading {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(200%); }
      }

      .progress-text {
        margin: 10px 0;
        opacity: 0.8;
        font-style: italic;
      }

      @media (max-width: 768px) {
        .reset-container {
          padding: 10px;
        }
        
        .auth-card, .confirm-card, .progress-card {
          padding: 1.5rem;
        }
        
        .action-buttons {
          flex-direction: column;
        }
      }
    </style>
  `
})
export class ResetComponent implements OnInit {

  // État d'authentification
  adminPassword = '';
  isAuthenticated = false;
  loading = false;
  error = '';

  // État de réinitialisation
  confirmReset = false;
  isResetting = false;
  progressText = '';

  constructor(
    private quizService: QuizService,
    private adminCrudService: AdminCrudService,
    private router: Router
  ) {}

  ngOnInit() {
    console.log('� Accès à la page de réinitialisation sécurisée');
    
    // Vérifier s'il y a déjà une session admin active
    const savedPassword = sessionStorage.getItem('admin_password');
    if (savedPassword) {
      this.adminPassword = savedPassword;
      this.authenticate();
    }
  }

  authenticate() {
    if (!this.adminPassword.trim()) {
      this.error = 'Mot de passe requis';
      return;
    }

    this.loading = true;
    this.error = '';

    // Vérifier l'authentification admin via l'API
    this.adminCrudService.getStats(this.adminPassword).subscribe({
      next: (stats) => {
        this.isAuthenticated = true;
        sessionStorage.setItem('admin_password', this.adminPassword);
        this.loading = false;
        console.log('✅ Authentification admin réussie pour reset');
      },
      error: (error) => {
        this.loading = false;
        this.isAuthenticated = false;
        this.error = error.error?.error || 'Mot de passe administrateur incorrect';
        console.warn('❌ Échec authentification admin pour reset');
      }
    });
  }

  performReset() {
    if (!this.isAuthenticated || !this.confirmReset) {
      this.error = 'Authentification et confirmation requises';
      return;
    }

    this.isResetting = true;
    this.loading = true;
    this.error = '';
    this.progressText = 'Suppression des participants...';

    // Utiliser l'API sécurisée de reset
    this.adminCrudService.resetQuiz(this.adminPassword).subscribe({
      next: (response) => {
        console.log('✅ Reset quiz réussi:', response);
        this.progressText = 'Réinitialisation terminée avec succès !';
        
        // Attendre un peu pour montrer le succès
        setTimeout(() => {
          this.progressText = 'Redirection...';
          
          // Rediriger vers l'admin ou présentation
          setTimeout(() => {
            this.router.navigate(['/presentation']);
          }, 1000);
        }, 2000);
      },
      error: (error) => {
        console.error('❌ Erreur lors du reset:', error);
        this.isResetting = false;
        this.loading = false;
        this.error = error.error?.error || 'Erreur lors de la réinitialisation';
      }
    });
  }

  goBack() {
    // Rediriger vers l'interface admin principale
    this.router.navigate(['/admin']);
  }
}