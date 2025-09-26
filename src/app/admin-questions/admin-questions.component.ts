import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

interface Question {
  id?: number;
  text: string;
  options: string[];
  correctIndex: number;
  createdAt?: string;
  imageUrl?: string;
  imageUrlResult?: string;
  imageUrlEnd?: string;
}

@Component({
  selector: 'app-admin-questions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-questions.component.html',
  styleUrls: ['./admin-questions.component.css']
})
export class AdminQuestionsComponent implements OnInit {
  questions: Question[] = [];
  loading = false;
  error = '';
  success = '';
  
  // Form pour nouvelle question
  newQuestion: Question = {
    text: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    imageUrl: '',
    imageUrlResult: '',
    imageUrlEnd: ''
  };
  
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
        this.newQuestion = {
          text: '',
          options: ['', '', '', ''],
          correctIndex: 0,
          imageUrl: '',
          imageUrlResult: '',
          imageUrlEnd: ''
        };
        this.loadQuestions();
      },
      error: (error) => {
        this.loading = false;
        this.error = error.error?.error || 'Erreur lors de l\'ajout';
      }
    });
  }

  startEdit(question: Question) {
    this.editingQuestion = { ...question };
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
    if (question.options.some(opt => !opt.trim())) return false;
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

  updateSimpleOption(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.newQuestion.options[index] = input.value;
  }
}