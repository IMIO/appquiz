import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Question {
  id?: number;
  text: string;
  options: any[];
  correctIndex: number;
  createdAt?: string;
  imageUrl?: string;
  imageUrlResult?: string;
  imageUrlEnd?: string;
  order?: number;
}

export interface Participant {
  id: string;
  name: string;
  score: number;
  answers: any[];
  avatarUrl?: string;
  createdAt: string;
}

export interface Answer {
  id: number;
  questionIndex: number;
  userId: string;
  userName: string;
  answerIndex: number;
  timestamp: number;
  participantName?: string;
}

export interface QuizState {
  id: number;
  step: string;
  currentQuestionIndex: number;
  questionStartTime?: number;
  questionStartTimes: any;
  updatedAt: string;
}

export interface AdminStats {
  questions: number;
  participants: number;
  answers: number;
  currentStep: string;
  currentQuestionIndex: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminCrudService {

  constructor(private http: HttpClient) { }

  // === QUESTIONS ===
  getQuestions(password: string): Observable<Question[]> {
    return this.http.post<Question[]>(`${environment.apiUrl}/admin/questions`, { password });
  }

  addQuestion(question: Question, password: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/admin/questions/add`, {
      ...question,
      password
    });
  }

  updateQuestion(id: number, question: Question, password: string): Observable<any> {
    return this.http.put(`${environment.apiUrl}/admin/questions/${id}`, {
      ...question,
      password
    });
  }

  deleteQuestion(id: number, password: string): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/admin/questions/${id}`, {
      body: { password }
    });
  }

  reorderQuestions(order: number[], password: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/admin/questions/reorder`, {
      order,
      password
    });
  }

  // === PARTICIPANTS ===
  getParticipants(password: string): Observable<Participant[]> {
    return this.http.post<Participant[]>(`${environment.apiUrl}/admin/participants`, { password });
  }

  updateParticipant(id: string, participant: Partial<Participant>, password: string): Observable<any> {
    return this.http.put(`${environment.apiUrl}/admin/participants/${id}`, {
      ...participant,
      password
    });
  }

  deleteParticipant(id: string, password: string): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/admin/participants/${id}`, {
      body: { password }
    });
  }

  // === RÉPONSES ===
  getAnswers(password: string): Observable<Answer[]> {
    return this.http.post<Answer[]>(`${environment.apiUrl}/admin/answers`, { password });
  }

  deleteAnswer(id: number, password: string): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/admin/answers/${id}`, {
      body: { password }
    });
  }

  // === ÉTAT DU QUIZ ===
  getQuizState(password: string): Observable<QuizState> {
    return this.http.post<QuizState>(`${environment.apiUrl}/admin/quiz-state`, { password });
  }

  forceUpdateQuizState(state: Partial<QuizState>, password: string): Observable<any> {
    return this.http.put(`${environment.apiUrl}/admin/quiz-state/force`, {
      ...state,
      password
    });
  }

  // === STATISTIQUES ===
  getStats(password: string): Observable<AdminStats> {
    return this.http.post<AdminStats>(`${environment.apiUrl}/admin/stats`, { password });
  }

  // === UTILITAIRES ===
  resetQuiz(password: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/quiz/reset`, { password });
  }

  syncQuestions(password: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/quiz/sync-questions`, { password });
  }
}