import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { User } from '../models/user.model';
import { QuizService } from '../services/quiz-secure.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-debug-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="debug-panel">
      <div class="debug-header">
        <h3>Panneau de débogage</h3>
        <button (click)="toggleExpanded()">{{ expanded ? '−' : '+' }}</button>
      </div>
      <div class="debug-content" *ngIf="expanded">
        <div class="debug-section">
          <h4>État actuel</h4>
          <p><strong>Étape:</strong> {{ step }}</p>
          <p><strong>Participants:</strong> {{ participants.length }}</p>
        </div>
        
        <div class="debug-section">
          <h4>Participants</h4>
          <button (click)="refreshParticipants()" class="debug-btn">Rafraîchir</button>
          <ul class="debug-participants">
            <li *ngFor="let p of participants">{{ p.name }} ({{ p.id }})</li>
            <li *ngIf="participants.length === 0" class="no-data">Aucun participant</li>
          </ul>
        </div>
        
        <div class="debug-section">
          <h4>Test API</h4>
          <div class="debug-api-tests">
            <button (click)="testAPI('participants')" class="debug-btn">GET participants</button>
            <button (click)="testAPI('quiz-state')" class="debug-btn">GET quiz-state</button>
            <button (click)="addTestParticipant()" class="debug-btn">ADD test participant</button>
          </div>
          <div *ngIf="apiResult" class="debug-api-result">
            <pre>{{ apiResult | json }}</pre>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .debug-panel {
      position: fixed;
      bottom: 0;
      right: 10px;
      width: 300px;
      background-color: rgba(0,0,0,0.8);
      border-top-left-radius: 8px;
      border-top-right-radius: 8px;
      color: #fff;
      font-family: monospace;
      font-size: 12px;
      z-index: 9999;
    }
    .debug-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px 10px;
      background-color: #444;
      border-top-left-radius: 8px;
      border-top-right-radius: 8px;
    }
    .debug-header h3 {
      margin: 0;
      font-size: 14px;
    }
    .debug-header button {
      background: none;
      border: none;
      color: #fff;
      font-size: 18px;
      cursor: pointer;
    }
    .debug-content {
      padding: 10px;
      max-height: 400px;
      overflow-y: auto;
    }
    .debug-section {
      margin-bottom: 15px;
    }
    .debug-section h4 {
      margin: 0 0 5px 0;
      font-size: 13px;
      color: #aaffaa;
    }
    .debug-participants {
      margin: 0;
      padding: 5px;
      list-style: none;
      background: rgba(255,255,255,0.1);
      border-radius: 4px;
      max-height: 100px;
      overflow-y: auto;
    }
    .debug-participants li {
      padding: 2px 0;
    }
    .no-data {
      color: #ff6666;
    }
    .debug-btn {
      background: #666;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 3px 8px;
      margin: 3px;
      cursor: pointer;
      font-size: 11px;
    }
    .debug-btn:hover {
      background: #888;
    }
    .debug-api-tests {
      display: flex;
      flex-wrap: wrap;
      margin-bottom: 5px;
    }
    .debug-api-result {
      background: rgba(0,0,0,0.3);
      border-radius: 4px;
      padding: 5px;
      max-height: 100px;
      overflow-y: auto;
      font-size: 10px;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
    }
  `]
})
export class DebugPanelComponent implements OnInit, OnChanges {
  @Input() step: string = '';
  @Input() participants: User[] = [];
  
  expanded: boolean = true;
  apiResult: any = null;
  private readonly apiUrl = environment.apiUrl;

  constructor(
    private quizService: QuizService,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    console.log('[DEBUG-PANEL] Initialisé avec', this.participants.length, 'participants');
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['participants']) {
      console.log('[DEBUG-PANEL] Mise à jour des participants:', this.participants.length);
    }
    if (changes['step']) {
      console.log('[DEBUG-PANEL] Changement d\'étape:', this.step);
    }
  }

  toggleExpanded(): void {
    this.expanded = !this.expanded;
  }
  
  async refreshParticipants(): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/participants`);
      const data = await response.json();
      console.log('[DEBUG-PANEL] Participants récupérés:', data);
      this.apiResult = {
        type: 'GET /participants',
        count: Array.isArray(data) ? data.length : 0,
        data: data
      };
      
      // Si en mode présentation, mettre à jour directement les participants
      if (this.participants) {
        if (Array.isArray(data) && data.length > 0) {
          // Mise à jour via le service pour propager les changements
          this.quizService['participants'] = data;
          this.participants = data;
        }
      }
    } catch (error) {
      console.error('[DEBUG-PANEL] Erreur lors du rafraîchissement des participants:', error);
      this.apiResult = {
        type: 'ERROR',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  async testAPI(endpoint: string): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/${endpoint}`);
      const data = await response.json();
      console.log(`[DEBUG-PANEL] API ${endpoint}:`, data);
      this.apiResult = {
        type: `GET /${endpoint}`,
        data
      };
    } catch (error) {
      console.error(`[DEBUG-PANEL] Erreur API ${endpoint}:`, error);
      this.apiResult = {
        type: 'ERROR',
        endpoint,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  async addTestParticipant(): Promise<void> {
    try {
      const testUser = {
        id: 'debug-' + Date.now(),
        name: 'Debug User ' + Math.floor(Math.random() * 1000),
        avatarUrl: null
      };
      
      const response = await fetch(`${this.apiUrl}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testUser)
      });
      
      const data = await response.json();
      console.log('[DEBUG-PANEL] Participant de test ajouté:', data);
      this.apiResult = {
        type: 'POST /participants',
        user: testUser,
        response: data
      };
      
      // Rafraîchir les participants
      this.refreshParticipants();
      
    } catch (error) {
      console.error('[DEBUG-PANEL] Erreur lors de l\'ajout du participant de test:', error);
      this.apiResult = {
        type: 'ERROR',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}