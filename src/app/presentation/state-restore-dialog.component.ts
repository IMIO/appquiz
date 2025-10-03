import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateRestoreService } from './state-restore.service';

@Component({
  selector: 'app-state-restore-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="restore-overlay" *ngIf="showDialog">
      <div class="restore-dialog">
        <div class="restore-header">
          <h2>🔄 Restauration d'état</h2>
        </div>
        <div class="restore-body">
          <p>Il semble que vous avez rafraîchi la page pendant le quiz.</p>
          <p>Un état précédent est disponible et peut être restauré.</p>
          
          <div *ngIf="saveInfo" class="save-info">
            <p><strong>État sauvegardé :</strong> {{ saveInfo.stepName }}</p>
            <p><strong>Question :</strong> {{ saveInfo.questionIndex + 1 }}</p>
            <p><strong>Âge :</strong> {{ formatAge(saveInfo.age) }}</p>
          </div>
          
          <div *ngIf="restoreResult" class="restore-result"
               [ngClass]="{'success': restoreResult.success, 'error': !restoreResult.success}">
            {{ restoreResult.message }}
          </div>
          
          <div class="restore-actions">
            <button class="restore-btn primary" 
                    [disabled]="isRestoring" 
                    (click)="restoreState()">
              {{ isRestoring ? 'Restauration en cours...' : 'Restaurer l\'état' }}
            </button>
            <button class="restore-btn secondary" 
                    [disabled]="isRestoring" 
                    (click)="cancelRestore()">
              Ignorer et continuer
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .restore-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    }
    
    .restore-dialog {
      background: white;
      border-radius: 10px;
      width: 90%;
      max-width: 500px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }
    
    .restore-header {
      background: linear-gradient(135deg, #DAE72A, #08B0EC);
      color: white;
      padding: 1rem;
      text-align: center;
    }
    
    .restore-header h2 {
      margin: 0;
      font-size: 1.5rem;
    }
    
    .restore-body {
      padding: 1.5rem;
    }
    
    .save-info {
      background: #f8f9fa;
      padding: 1rem;
      border-radius: 8px;
      margin: 1rem 0;
    }
    
    .restore-result {
      padding: 1rem;
      border-radius: 8px;
      margin: 1rem 0;
      text-align: center;
      font-weight: bold;
    }
    
    .restore-result.success {
      background: #d4edda;
      color: #155724;
    }
    
    .restore-result.error {
      background: #f8d7da;
      color: #721c24;
    }
    
    .restore-actions {
      display: flex;
      gap: 1rem;
      margin-top: 1.5rem;
    }
    
    .restore-btn {
      flex: 1;
      padding: 0.75rem 1rem;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-weight: bold;
      transition: all 0.2s;
    }
    
    .restore-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
    
    .restore-btn.primary {
      background: #DAE72A;
      color: #000;
    }
    
    .restore-btn.primary:hover:not(:disabled) {
      background: #C5CB2F;
    }
    
    .restore-btn.secondary {
      background: #f1f1f1;
      color: #333;
    }
    
    .restore-btn.secondary:hover:not(:disabled) {
      background: #e0e0e0;
    }
  `]
})
export class StateRestoreDialogComponent implements OnInit {
  showDialog = false;
  saveInfo: any = null;
  isRestoring = false;
  restoreResult: {success: boolean, message: string} | null = null;
  
  constructor(private stateRestoreService: StateRestoreService) {}
  
  ngOnInit() {
    // Vérifier s'il y a un état à restaurer
    if (this.stateRestoreService.canRestoreState()) {
      this.saveInfo = this.stateRestoreService.getSaveInfo();
      this.showDialog = true;
    }
    
    // S'abonner au statut de restauration
    this.stateRestoreService.isRestoring$.subscribe(isRestoring => {
      this.isRestoring = isRestoring;
    });
    
    // S'abonner au résultat de restauration
    this.stateRestoreService.restorationResult$.subscribe(result => {
      this.restoreResult = result;
      
      // Fermer la boîte de dialogue après un succès
      if (result?.success) {
        setTimeout(() => {
          this.showDialog = false;
          window.location.reload(); // Recharger pour appliquer la restauration
        }, 2000);
      }
    });
  }
  
  /**
   * Tente de restaurer l'état sauvegardé
   */
  async restoreState() {
    await this.stateRestoreService.restoreState();
  }
  
  /**
   * Annule la restauration et continue sans restaurer
   */
  cancelRestore() {
    this.showDialog = false;
  }
  
  /**
   * Formate l'âge de la sauvegarde en texte lisible
   */
  formatAge(ageMs: number): string {
    const seconds = Math.floor(ageMs / 1000);
    
    if (seconds < 60) {
      return `${seconds} secondes`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)} minutes`;
    } else {
      return `${Math.floor(seconds / 3600)} heures`;
    }
  }
}