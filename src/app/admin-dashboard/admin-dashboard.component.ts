import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AdminCrudService, Question, Participant, Answer, QuizState, AdminStats } from '../services/admin-crud.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  
  // État d'authentification
  adminPassword = '';
  isAuthenticated = false;
  loading = false;
  error = '';
  success = '';

  // Données
  stats: AdminStats | null = null;
  questions: Question[] = [];
  participants: Participant[] = [];
  answers: Answer[] = [];
  quizState: QuizState | null = null;

  // Vue active
  activeTab: 'dashboard' | 'questions' | 'participants' | 'answers' | 'quiz-state' = 'dashboard';

  // États d'édition
  editingQuestion: Question | null = null;
  editingParticipant: Participant | null = null;
  editingQuizState: boolean = false;

  constructor(
    private adminCrudService: AdminCrudService,
    private router: Router
  ) {}

  ngOnInit() {
    // Vérifier si on a déjà un mot de passe en session
    const savedPassword = sessionStorage.getItem('admin_password');
    if (savedPassword) {
      this.adminPassword = savedPassword;
      this.authenticate();
    }
  }

  authenticate() {
    this.loading = true;
    this.error = '';
    
    // Tester l'authentification en récupérant les stats
    this.adminCrudService.getStats(this.adminPassword).subscribe({
      next: (stats) => {
        this.isAuthenticated = true;
        sessionStorage.setItem('admin_password', this.adminPassword);
        this.stats = stats;
        // Charger toutes les données détaillées après l'authentification
        this.loadAllData();
        this.loading = false;
        this.success = 'Authentification réussie';
        
        // Debug: afficher les stats initiales
        console.log('Stats initiales:', this.stats);
      },
      error: (error) => {
        this.loading = false;
        this.error = error.error?.error || 'Erreur d\'authentification';
        this.isAuthenticated = false;
        sessionStorage.removeItem('admin_password');
      }
    });
  }

  loadAllData() {
    this.loadQuestions();
    this.loadParticipants();
    this.loadAnswers();
    this.loadQuizState();
    this.loadStats(); // Recharger les stats aussi pour synchroniser les compteurs
  }

  loadStats() {
    this.adminCrudService.getStats(this.adminPassword).subscribe({
      next: (stats) => this.stats = stats,
      error: (error) => this.error = error.error?.error || 'Erreur de chargement des stats'
    });
  }

  loadQuestions() {
    this.adminCrudService.getQuestions(this.adminPassword).subscribe({
      next: (questions) => {
        this.questions = questions;
        this.updateStatsFromData();
      },
      error: (error) => this.error = error.error?.error || 'Erreur de chargement des questions'
    });
  }

  loadParticipants() {
    this.adminCrudService.getParticipants(this.adminPassword).subscribe({
      next: (participants) => {
        this.participants = participants;
        // Mettre à jour les stats en temps réel
        this.updateStatsFromData();
      },
      error: (error) => this.error = error.error?.error || 'Erreur de chargement des participants'
    });
  }

  loadAnswers() {
    this.adminCrudService.getAnswers(this.adminPassword).subscribe({
      next: (answers) => {
        this.answers = answers;
        this.updateStatsFromData();
      },
      error: (error) => this.error = error.error?.error || 'Erreur de chargement des réponses'
    });
  }

  loadQuizState() {
    this.adminCrudService.getQuizState(this.adminPassword).subscribe({
      next: (state) => this.quizState = state,
      error: (error) => this.error = error.error?.error || 'Erreur de chargement de l\'état du quiz'
    });
  }

  // === ACTIONS QUESTIONS ===
  startEditQuestion(question: Question) {
    this.editingQuestion = JSON.parse(JSON.stringify(question));
    this.error = '';
  }

  cancelEditQuestion() {
    this.editingQuestion = null;
    this.error = '';
  }

  saveQuestion() {
    if (!this.editingQuestion || !this.validateQuestion(this.editingQuestion)) {
      this.error = 'Veuillez remplir tous les champs correctement';
      return;
    }

    this.loading = true;
    this.adminCrudService.updateQuestion(this.editingQuestion.id!, this.editingQuestion, this.adminPassword).subscribe({
      next: () => {
        this.success = 'Question modifiée avec succès';
        this.editingQuestion = null;
        this.loadQuestions();
        this.loadStats();
        this.loading = false;
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
    this.adminCrudService.deleteQuestion(question.id!, this.adminPassword).subscribe({
      next: () => {
        this.success = 'Question supprimée avec succès';
        this.loadQuestions();
        this.loadStats();
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.error = error.error?.error || 'Erreur lors de la suppression';
      }
    });
  }

  // === ACTIONS PARTICIPANTS ===
  startEditParticipant(participant: Participant) {
    this.editingParticipant = JSON.parse(JSON.stringify(participant));
    this.error = '';
  }

  cancelEditParticipant() {
    this.editingParticipant = null;
    this.error = '';
  }

  saveParticipant() {
    if (!this.editingParticipant || !this.editingParticipant.name.trim()) {
      this.error = 'Le nom est requis';
      return;
    }

    this.loading = true;
    this.adminCrudService.updateParticipant(
      this.editingParticipant.id, 
      this.editingParticipant, 
      this.adminPassword
    ).subscribe({
      next: () => {
        this.success = 'Participant modifié avec succès';
        this.editingParticipant = null;
        this.loadParticipants();
        this.loadStats();
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.error = error.error?.error || 'Erreur lors de la modification';
      }
    });
  }

  deleteParticipant(participant: Participant) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ce participant ?\n"${participant.name}" (${participant.id})`)) {
      return;
    }

    this.loading = true;
    this.adminCrudService.deleteParticipant(participant.id, this.adminPassword).subscribe({
      next: () => {
        this.success = 'Participant supprimé avec succès';
        this.loadParticipants();
        this.loadAnswers(); // Recharger car les réponses sont aussi supprimées
        this.loadStats();
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.error = error.error?.error || 'Erreur lors de la suppression';
      }
    });
  }

  // === ACTIONS RÉPONSES ===
  deleteAnswer(answer: Answer) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer cette réponse ?\nUtilisateur: ${answer.userName}\nQuestion: ${answer.questionIndex + 1}`)) {
      return;
    }

    this.loading = true;
    this.adminCrudService.deleteAnswer(answer.id, this.adminPassword).subscribe({
      next: () => {
        this.success = 'Réponse supprimée avec succès';
        this.loadAnswers();
        this.loadStats();
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.error = error.error?.error || 'Erreur lors de la suppression';
      }
    });
  }

  // === ACTIONS ÉTAT DU QUIZ ===
  startEditQuizState() {
    this.editingQuizState = true;
    this.error = '';
  }

  cancelEditQuizState() {
    this.editingQuizState = false;
    this.loadQuizState(); // Recharger les données originales
  }

  saveQuizState() {
    if (!this.quizState) return;

    this.loading = true;
    this.adminCrudService.forceUpdateQuizState(this.quizState, this.adminPassword).subscribe({
      next: () => {
        this.success = 'État du quiz modifié avec succès';
        this.editingQuizState = false;
        this.loadQuizState();
        this.loadStats();
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.error = error.error?.error || 'Erreur lors de la modification';
      }
    });
  }

  // === ACTIONS GLOBALES ===
  resetQuiz() {
    if (!confirm('Êtes-vous sûr de vouloir réinitialiser complètement le quiz ?\nCela supprimera tous les participants et leurs réponses !')) {
      return;
    }

    this.loading = true;
    this.adminCrudService.resetQuiz(this.adminPassword).subscribe({
      next: () => {
        this.success = 'Quiz réinitialisé avec succès';
        this.loadAllData();
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.error = error.error?.error || 'Erreur lors de la réinitialisation';
      }
    });
  }

  syncQuestions() {
    this.loading = true;
    this.adminCrudService.syncQuestions(this.adminPassword).subscribe({
      next: () => {
        this.success = 'Synchronisation des questions réussie';
        this.loadAllData();
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.error = error.error?.error || 'Erreur lors de la synchronisation';
      }
    });
  }

  // === UTILITAIRES ===
  private validateQuestion(question: Question): boolean {
    if (!question.text.trim()) return false;
    if (question.options.some(opt => !opt.text || !opt.text.trim())) return false;
    if (question.correctIndex < 0 || question.correctIndex >= question.options.length) return false;
    return true;
  }

  logout() {
    this.isAuthenticated = false;
    this.adminPassword = '';
    sessionStorage.removeItem('admin_password');
    this.router.navigate(['/admin-login']);
  }

  goToQuestionsManager() {
    this.router.navigate(['/admin-questions']);
  }

  setActiveTab(tab: 'dashboard' | 'questions' | 'participants' | 'answers' | 'quiz-state') {
    this.activeTab = tab;
    this.error = '';
    this.success = '';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('fr-FR');
  }

  formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleString('fr-FR');
  }

  // Méthode pour accéder à String dans le template
  getCharFromIndex(index: number): string {
    return String.fromCharCode(65 + index);
  }

  // Mettre à jour les statistiques à partir des données chargées localement
  updateStatsFromData() {
    if (this.stats) {
      const oldStats = {...this.stats};
      this.stats.participants = this.participants.length;
      this.stats.answers = this.answers.length;
      this.stats.questions = this.questions.length;
      
      // Debug: afficher les changements
      console.log('Mise à jour stats:', {
        avant: oldStats,
        après: this.stats,
        participants: this.participants.length,
        answers: this.answers.length,
        questions: this.questions.length
      });
    }
  }

  // Rechargement forcé de toutes les données avec remise à zéro
  forceReloadEverything() {
    this.loading = true;
    this.error = '';
    this.success = '';
    
    // Remettre à zéro les données locales
    this.participants = [];
    this.questions = [];
    this.answers = [];
    this.stats = null;
    
    // Recharger les stats depuis le serveur
    this.adminCrudService.getStats(this.adminPassword).subscribe({
      next: (stats) => {
        this.stats = stats;
        console.log('Stats rechargées depuis serveur:', stats);
        
        // Puis charger les données détaillées
        this.loadAllData();
        this.loading = false;
        this.success = 'Données rechargées avec succès';
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Erreur lors du rechargement: ' + (error.error?.error || error.message);
      }
    });
  }
}