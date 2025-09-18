import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { QuizService } from '../../services/quiz-secure.service';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  name: string = '';
  github: string = '';
  avatarUrl: string | null = null;
  loadingAvatar = false;

  constructor(private quizService: QuizService, private router: Router) {}

  async fetchGithubAvatar() {
    if (!this.github.trim()) return;
    this.loadingAvatar = true;
    try {
      const res = await fetch(`https://api.github.com/users/${this.github.trim()}`);
      if (!res.ok) throw new Error('Utilisateur GitHub introuvable');
      const data = await res.json();
      this.avatarUrl = data.avatar_url;
    } catch (e) {
      this.avatarUrl = null;
    } finally {
      this.loadingAvatar = false;
    }
  }

  async join() {
    let userName = this.name.trim();
    let avatar = this.avatarUrl;
    if (this.github.trim()) {
      userName = this.github.trim();
      avatar = this.avatarUrl;
    } else if (!avatar && userName) {
      // Génère un avatar DiceBear si pseudo uniquement
      avatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(userName)}`;
    }
    if (!userName) return;
    const user: User = {
      id: crypto.randomUUID(),
      name: userName,
      score: 0,
      answers: []
    };
    if (avatar) user.avatarUrl = avatar;
    try {
      await this.quizService.addParticipant(user);
      localStorage.setItem('userId', user.id);
      localStorage.setItem('userName', user.name);
      if (avatar) localStorage.setItem('avatarUrl', avatar);
      this.router.navigate(['/waiting']);
    } catch (e) {
      alert('Erreur lors de l\'inscription, veuillez réessayer.');
      console.error('[LOGIN] Erreur ajout participant', e);
    }
  }
}
