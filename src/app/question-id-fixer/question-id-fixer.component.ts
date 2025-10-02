import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuizService } from '../services/quiz-secure.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { fetchAllAnswersDirectly } from '../direct-fetch-answers';

@Component({
  selector: 'app-question-id-fixer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="diagnostic-container">
      <h2>Diagnostic Questions/ID</h2>
      
      <div class="section">
        <h3>Questions chargées</h3>
        <button (click)="loadQuestions()" class="btn-primary">Analyser les questions</button>
        
        <div class="result-box" *ngIf="questions.length > 0">
          <p><strong>{{ questions.length }}</strong> questions chargées</p>
          
          <table>
            <thead>
              <tr>
                <th>Index</th>
                <th>ID</th>
                <th>Texte</th>
                <th>correctIndex</th>
                <th>État</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let question of questions; let i = index" [class.warning]="question.id !== i">
                <td>{{ i }}</td>
                <td>{{ question.id }}</td>
                <td>{{ question.text | slice:0:30 }}...</td>
                <td>{{ question.correctIndex }}</td>
                <td>
                  <span *ngIf="question.id === i" class="ok">✅ OK</span>
                  <span *ngIf="question.id !== i" class="warning">⚠️ ID/Index discordants</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <div class="section">
        <h3>Réponses par Question</h3>
        <button (click)="loadAnswers()" [disabled]="isLoadingAnswers" class="btn-primary">
          {{ isLoadingAnswers ? 'Chargement...' : 'Charger toutes les réponses' }}
        </button>
        
        <div class="result-box" *ngIf="answersDocs.length > 0">
          <p><strong>{{ answersDocs.length }}</strong> documents de réponses chargés</p>
          
          <table>
            <thead>
              <tr>
                <th>Question ID</th>
                <th>Index</th>
                <th>Source</th>
                <th>Nb réponses</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let doc of answersDocs">
                <td>{{ doc.questionId }}</td>
                <td>{{ doc.index }}</td>
                <td>{{ doc.source || '-' }}</td>
                <td>{{ doc.answers?.length || 0 }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <div class="section">
        <h3>Corriger les IDs des questions</h3>
        <button (click)="fixQuestionIds()" [disabled]="isFixing" class="btn-danger">
          {{ isFixing ? 'Correction en cours...' : 'Synchroniser les IDs avec les indices' }}
        </button>
        
        <div class="alert" *ngIf="fixResult">
          <p [class]="fixResult.success ? 'success' : 'error'">{{ fixResult.message }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .diagnostic-container {
      background-color: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      max-width: 1200px;
      margin: 20px auto;
    }
    
    h2 {
      color: #333;
      border-bottom: 2px solid #007bff;
      padding-bottom: 8px;
      margin-bottom: 20px;
    }
    
    .section {
      margin-bottom: 30px;
      background-color: white;
      border-radius: 6px;
      padding: 15px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    
    h3 {
      color: #555;
      font-size: 1.2em;
      margin-bottom: 15px;
    }
    
    .btn-primary, .btn-danger {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      margin-bottom: 10px;
    }
    
    .btn-primary {
      background-color: #007bff;
      color: white;
    }
    
    .btn-danger {
      background-color: #dc3545;
      color: white;
    }
    
    .btn-primary:disabled, .btn-danger:disabled {
      background-color: #6c757d;
      cursor: not-allowed;
    }
    
    .result-box {
      margin-top: 15px;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      padding: 15px;
      max-height: 400px;
      overflow-y: auto;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
    }
    
    th, td {
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid #dee2e6;
    }
    
    th {
      background-color: #f8f9fa;
      font-weight: bold;
    }
    
    tr:hover {
      background-color: #f1f1f1;
    }
    
    .warning {
      background-color: #fff3cd;
    }
    
    .ok {
      color: #28a745;
    }
    
    .warning {
      color: #ffc107;
    }
    
    .alert {
      padding: 12px;
      border-radius: 4px;
      margin-top: 15px;
    }
    
    .success {
      background-color: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    
    .error {
      background-color: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
  `]
})
export class QuestionIdFixerComponent implements OnInit {
  questions: any[] = [];
  answersDocs: any[] = [];
  isLoadingAnswers: boolean = false;
  isFixing: boolean = false;
  fixResult: { success: boolean, message: string } | null = null;
  
  private readonly apiUrl = environment.apiUrl;

  constructor(
    private quizService: QuizService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // Charger les questions au démarrage
    this.loadQuestions();
  }

  loadQuestions(): void {
    this.questions = this.quizService.getQuestions();
    
    // Si aucune question n'est chargée, les initialiser
    if (this.questions.length === 0) {
      this.quizService.initQuestions().then(() => {
        this.questions = this.quizService.getQuestions();
        console.log('Questions chargées:', this.questions.length);
      });
    }
  }

  async loadAnswers(): Promise<void> {
    this.isLoadingAnswers = true;
    try {
      // Utiliser notre fonction utilitaire pour récupérer toutes les réponses
      this.answersDocs = await fetchAllAnswersDirectly(this.apiUrl, this.questions);
      console.log('Réponses chargées:', this.answersDocs.length);
    } catch (error) {
      console.error('Erreur lors du chargement des réponses:', error);
      alert('Erreur lors du chargement des réponses. Voir la console pour plus de détails.');
    } finally {
      this.isLoadingAnswers = false;
    }
  }

  async fixQuestionIds(): Promise<void> {
    if (this.isFixing) return;
    
    if (!confirm('ATTENTION: Cette opération va modifier les IDs des questions pour qu\'ils correspondent aux indices. Cela peut affecter les réponses existantes. Voulez-vous continuer?')) {
      return;
    }
    
    this.isFixing = true;
    this.fixResult = null;
    
    try {
      // Créer les opérations de mise à jour pour chaque question
      const updateOperations = this.questions.map((question, index) => {
        return {
          id: question.id,
          newId: index,
          needsUpdate: question.id !== index
        };
      }).filter(op => op.needsUpdate);
      
      if (updateOperations.length === 0) {
        this.fixResult = {
          success: true,
          message: 'Toutes les questions ont déjà des IDs correspondant à leurs indices.'
        };
        return;
      }
      
      console.log('Opérations de mise à jour:', updateOperations);
      
      // Appeler l'API pour mettre à jour les IDs
      const response = await this.http.post(`${this.apiUrl}/admin/fix-question-ids`, {
        updates: updateOperations
      }).toPromise();
      
      console.log('Réponse API:', response);
      
      // Recharger les questions pour refléter les changements
      await this.quizService.reloadQuestions();
      this.questions = this.quizService.getQuestions();
      
      this.fixResult = {
        success: true,
        message: `Les IDs de ${updateOperations.length} questions ont été synchronisés avec leurs indices.`
      };
      
    } catch (error) {
      console.error('Erreur lors de la correction des IDs:', error);
      this.fixResult = {
        success: false,
        message: `Erreur lors de la correction des IDs: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      };
    } finally {
      this.isFixing = false;
    }
  }
}