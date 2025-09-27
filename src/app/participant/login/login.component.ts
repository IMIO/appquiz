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
  isSubmitting = false;

  constructor(private quizService: QuizService, private router: Router) {}

  private generateUniqueId(): string {
    // Use crypto.randomUUID if available, otherwise fallback
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for older browsers
    return 'user-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
  }

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

  async join(event?: Event) {
    console.log('=== LOGIN JOIN START ===');
    
    // Prevent any default behavior
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      console.log('Event preventDefault and stopPropagation called');
    }
    
    // Prevent multiple submissions
    if (this.isSubmitting) {
      console.warn('Join already in progress, preventing duplicate submission');
      return;
    }
    
    // Check if user is already registered in this session
    const existingUserId = localStorage.getItem('userId');
    if (existingUserId) {
      console.log('User already registered in localStorage, verifying with server...');
      
      // Vérifier si l'userId existe encore sur le serveur
      try {
        const participants = await this.quizService.fetchParticipantsFromServer();
        const userExists = participants.some((participant: User) => participant.id === existingUserId);
        
        if (userExists) {
          console.log('User confirmed on server, navigating to waiting...');
          await this.router.navigate(['/waiting']);
          return;
        } else {
          console.log('User not found on server, clearing localStorage and allowing new registration...');
          localStorage.removeItem('userId');
          localStorage.removeItem('userName');
          // Continue with new registration
        }
      } catch (error) {
        console.warn('Error checking user on server, clearing localStorage:', error);
        localStorage.removeItem('userId');
        localStorage.removeItem('userName');
        // Continue with new registration
      }
    }
    
    this.isSubmitting = true;
    
    try {
      // Validation détaillée
      const nameValue = this.name?.trim() || '';
      const githubValue = this.github?.trim() || '';
      console.log('Form values:', { nameValue, githubValue, avatarUrl: this.avatarUrl });

      if (!nameValue && !githubValue) {
        console.error('No name or github provided');
        alert('Veuillez saisir un nom ou un nom d\'utilisateur GitHub');
        return;
      }

      if (githubValue && !this.avatarUrl) {
        console.error('GitHub username provided but no avatar fetched');
        alert('Veuillez récupérer l\'avatar GitHub avant de continuer');
        return;
      }

      // Create user object
      const userId = this.generateUniqueId();
      console.log('Generated user ID:', userId);

      const user: User = {
        id: userId,
        name: nameValue || githubValue,
        score: 0,
        answers: [],
        avatarUrl: this.avatarUrl || undefined
      };
      console.log('Created user object:', user);

      // Add participant to server
      console.log('Attempting to add participant to server...');
      await this.quizService.addParticipant(user);
      console.log('Add participant success');

      // Save to localStorage
      console.log('Saving user to localStorage...');
      localStorage.setItem('quiz-user', JSON.stringify(user));
      localStorage.setItem('userId', user.id);
      localStorage.setItem('userName', user.name);
      if (user.avatarUrl) {
        localStorage.setItem('avatarUrl', user.avatarUrl);
      }
      console.log('User saved to localStorage successfully');

      // Clear form
      this.name = '';
      this.github = '';
      this.avatarUrl = null;
      console.log('Form cleared');

      // Add small delay to ensure all async operations complete
      console.log('Adding small delay before navigation...');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Navigate with multiple approaches
      console.log('Attempting navigation to /waiting...');
      try {
        // Try navigateByUrl first
        console.log('Trying navigateByUrl...');
        const urlResult = await this.router.navigateByUrl('/waiting');
        console.log('NavigateByUrl result:', urlResult);
        
        if (!urlResult) {
          console.warn('NavigateByUrl failed, trying navigate...');
          const navResult = await this.router.navigate(['/waiting']);
          console.log('Navigate result:', navResult);
          
          if (!navResult) {
            console.error('Both navigation methods failed');
            // Force page navigation as last resort
            console.log('Forcing window location change...');
            window.location.href = '/waiting';
            return;
          }
        }
        
        console.log('Navigation successful');
      } catch (navError) {
        console.error('Navigation error:', navError);
        console.log('Forcing window location change due to error...');
        window.location.href = '/waiting';
      }

      console.log('=== LOGIN JOIN SUCCESS ===');
    } catch (error) {
      console.error('=== LOGIN JOIN ERROR ===', error);
      alert('Erreur lors de l\'inscription. Veuillez réessayer.');
    } finally {
      this.isSubmitting = false;
      console.log('isSubmitting reset to false');
    }
  }
}
