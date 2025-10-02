import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

interface Question {
  id?: number;
  text: string;
  options: any[];
  correctIndex: number;
  createdAt?: string;
  imageUrl?: string;
  imageUrlResult?: string;
}

@Component({
  selector: 'app-admin-questions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-questions.component.html',
  styleUrls: ['./admin-questions.component.css']
})
export class AdminQuestionsComponent implements OnInit {
  /**
   * Déplace une question dans la liste (vers le haut ou le bas)
   * @param index position actuelle
   * @param direction -1 pour haut, 1 pour bas
   */
  moveQuestion(index: number, direction: number) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= this.questions.length) return;
    // Échange les questions dans le tableau local
    const temp = this.questions[index];
    this.questions[index] = this.questions[newIndex];
    this.questions[newIndex] = temp;
    // Met à jour l'ordre côté backend (optionnel, à adapter si besoin)
    this.saveQuestionsOrder();
  }

  /**
   * Sauvegarde l'ordre actuel des questions côté backend
   */
  saveQuestionsOrder() {
    // On envoie l'ordre des IDs au backend
    const order = this.questions.map(q => q.id);
    this.http.post(`${environment.apiUrl}/admin/questions/reorder`, {
      order,
      password: this.adminPassword
    }).subscribe({
      next: () => {
        // Rafraîchir la liste après réordonnancement
        this.loadQuestions();
      },
      error: (error) => {
        this.error = error.error?.error || 'Erreur lors du changement d\'ordre';
        // Forcer le rechargement même en cas d'erreur pour garantir la cohérence visuelle
        this.loadQuestions();
      }
    });
  }

  questions: Question[] = [];
  loading = false;
  error = '';
  success = '';
  
  // Form pour nouvelle question
  newQuestion: Question = {
    text: '',
    options: [
      { text: '' },
      { text: '' },
      { text: '' },
      { text: '' }
    ],
    correctIndex: 0,
    imageUrl: '',
    imageUrlResult: ''
  };

  updateOptionText(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    // Si l'option est un objet, on met à jour .text, sinon on remplace la chaîne
    if (typeof this.newQuestion.options[index] === 'object' && this.newQuestion.options[index] !== null) {
      this.newQuestion.options[index].text = input.value;
    } else {
      this.newQuestion.options[index] = input.value;
    }
  }

  // Les fonctions d'upload ont été supprimées pour être remplacées par une saisie directe de chemin
  
  // Form pour modification
  editingQuestion: Question | null = null;
  
  // Authentification
  adminPassword = '';
  isAuthenticated = false;

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit() {
    // Vérifier si on a déjà un mot de passe en session
    const savedPassword = sessionStorage.getItem('admin_password');
    if (savedPassword) {
      this.adminPassword = savedPassword;
      this.loadQuestions();
    }
  }

  authenticate() {
    this.loading = true;
    this.error = '';
    
    this.http.post<Question[]>(`${environment.apiUrl}/admin/questions`, {
      password: this.adminPassword
    }).subscribe({
      next: (questions) => {
        this.isAuthenticated = true;
        sessionStorage.setItem('admin_password', this.adminPassword);
        this.questions = questions;
        this.loading = false;
        this.success = 'Authentification réussie';
      },
      error: (error) => {
        this.loading = false;
        this.error = error.error?.error || 'Erreur d\'authentification';
        this.isAuthenticated = false;
      }
    });
  }

  loadQuestions() {
    if (!this.adminPassword) return;
    
    this.loading = true;
    this.error = '';
    
    this.http.post<Question[]>(`${environment.apiUrl}/admin/questions`, {
      password: this.adminPassword
    }).subscribe({
      next: (questions) => {
        this.questions = questions;
        this.loading = false;
        this.isAuthenticated = true;
      },
      error: (error) => {
        this.loading = false;
        this.error = error.error?.error || 'Erreur de chargement';
        if (error.status === 401) {
          this.isAuthenticated = false;
          sessionStorage.removeItem('admin_password');
        }
      }
    });
  }

  addQuestion() {
    if (!this.validateQuestion(this.newQuestion)) {
      this.error = 'Veuillez remplir tous les champs correctement';
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    this.http.post(`${environment.apiUrl}/admin/questions/add`, {
      ...this.newQuestion,
      password: this.adminPassword
    }).subscribe({
      next: (response: any) => {
        this.success = response.message;
        // Toujours réinitialiser avec des objets, jamais des chaînes !
        this.newQuestion = {
          text: '',
          options: [
            { text: '' },
            { text: '' },
            { text: '' },
            { text: '' }
          ],
          correctIndex: 0,
          imageUrl: '',
          imageUrlResult: ''
        };
        this.loadQuestions();
      },
      error: (error) => {
        this.loading = false;
        this.error = error.error?.error || 'Erreur lors de l\'ajout';
      }
    });
  }

  /** Ajoute une option de réponse à la question en cours d'ajout */
  addNewOption() {
    if (this.newQuestion.options.length < 6) {
      this.newQuestion.options.push({ text: '' });
    }
  }

  startEdit(question: Question) {
    // Copie profonde pour éviter de modifier l'objet original avant sauvegarde
    this.editingQuestion = JSON.parse(JSON.stringify(question));
    this.error = '';
    this.success = '';
  }

  cancelEdit() {
    this.editingQuestion = null;
    this.error = '';
  }

  saveEdit() {
    if (!this.editingQuestion || !this.validateQuestion(this.editingQuestion)) {
      this.error = 'Veuillez remplir tous les champs correctement';
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    this.http.put(`${environment.apiUrl}/admin/questions/${this.editingQuestion.id}`, {
      ...this.editingQuestion,
      password: this.adminPassword
    }).subscribe({
      next: (response: any) => {
        this.success = response.message;
        this.editingQuestion = null;
        this.loadQuestions();
      },
      error: (error) => {
        this.loading = false;
        this.error = error.error?.error || 'Erreur lors de la modification';
      }
    });
  }

  deleteQuestion(question: Question) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer cette question ?\n"${question.text}"`)) {
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    this.http.delete(`${environment.apiUrl}/admin/questions/${question.id}`, {
      body: { password: this.adminPassword }
    }).subscribe({
      next: (response: any) => {
        this.success = response.message;
        this.loadQuestions();
      },
      error: (error) => {
        this.loading = false;
        this.error = error.error?.error || 'Erreur lors de la suppression';
      }
    });
  }

  private validateQuestion(question: Question): boolean {
    if (!question.text.trim()) return false;
    if (question.options.some(opt => !opt.text || !opt.text.trim())) return false;
    if (question.correctIndex < 0 || question.correctIndex >= question.options.length) return false;
    return true;
  }

  addOption(question: Question) {
    if (question.options.length < 6) { // Maximum 6 options
      question.options.push('');
    }
  }

  removeOption(question: Question, index: number) {
    if (question.options.length > 2) { // Minimum 2 options
      question.options.splice(index, 1);
      // Ajuster correctIndex si nécessaire
      if (question.correctIndex >= question.options.length) {
        question.correctIndex = question.options.length - 1;
      }
    }
  }

  logout() {
    this.isAuthenticated = false;
    this.adminPassword = '';
    sessionStorage.removeItem('admin_password');
    this.questions = [];
  }

  goBack() {
    this.router.navigate(['/admin']);
  }

  getOptionLabel(index: number): string {
    return String.fromCharCode(65 + index);
  }

  setCorrectOption(index: number): void {
    this.newQuestion.correctIndex = index;
  }

  /**
   * Vérifie et formatte le chemin d'une image
   * @param path Chemin saisi par l'utilisateur
   * @returns Le chemin formaté correctement
   */
  validateImagePath(path: string): string {
    if (!path) return '';
    
    // Si le chemin est déjà formaté correctement, le retourner tel quel
    if (path.startsWith('/assets/img/')) return path;
    
    // Si l'utilisateur a saisi un nom de fichier sans le chemin complet
    if (!path.includes('/')) {
      return `/assets/img/${path}`;
    }
    
    // Note sur le fonctionnement des chemins:
    // - En développement: les images sont servies depuis public/assets/img/
    // - En production: le serveur est configuré pour servir les images depuis le même chemin virtuel
    // Dans tous les cas, le chemin d'accès utilisé dans l'application est toujours /assets/img/
    
    return path;
  }
}