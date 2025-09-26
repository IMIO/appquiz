import { Routes } from '@angular/router';
import { AdminComponent } from './admin/admin.component';
import { LoginComponent } from './participant/login/login.component';
import { WaitingComponent } from './participant/waiting/waiting.component';
import { QuizComponent } from './quiz.component';
import { ResultComponent } from './participant/result/result.component';
import { LeaderboardComponent } from './leaderboard/leaderboard.component';
import { AdminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: 'admin', component: AdminComponent },
  { path: 'join', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'waiting', component: WaitingComponent },
  { path: 'quiz', component: QuizComponent },
  { path: 'result', component: ResultComponent },
  { path: 'leaderboard', component: LeaderboardComponent },
  { 
    path: 'admin-login', 
    loadComponent: () => import('./admin-login/admin-login.component').then(m => m.AdminLoginComponent) 
  },
  { 
    path: 'presentation', 
    loadComponent: () => import('./presentation/presentation.component').then(m => m.PresentationComponent),
    canActivate: [AdminGuard]
  },
  { 
    path: 'reset', 
    loadComponent: () => import('./reset/reset.component').then(m => m.ResetComponent)
  },
  { 
    path: 'gestion', 
    loadComponent: () => import('./admin-questions/admin-questions.component').then(m => m.AdminQuestionsComponent)
  },
  { path: '', redirectTo: '/admin-login', pathMatch: 'full' },
  { path: '**', redirectTo: '/admin-login' }
];
