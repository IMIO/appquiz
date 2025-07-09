import { Routes } from '@angular/router';
import { AdminComponent } from './admin/admin.component';
import { LoginComponent } from './participant/login/login.component';
import { WaitingComponent } from './participant/waiting/waiting.component';
import { QuizComponent } from './quiz.component';
import { ResultComponent } from './participant/result/result.component';
import { LeaderboardComponent } from './leaderboard/leaderboard.component';

export const routes: Routes = [
  { path: 'admin', component: AdminComponent },
  { path: 'join', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'waiting', component: WaitingComponent },
  { path: 'quiz', component: QuizComponent },
  { path: 'result', component: ResultComponent },
  { path: 'leaderboard', component: LeaderboardComponent },
  { path: 'presentation', loadComponent: () => import('./presentation/presentation.component').then(m => m.PresentationComponent) },
{ path: '', redirectTo: '/presentation', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' }
];
