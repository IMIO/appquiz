import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminAuthService } from '../services/admin-auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-login.component.html',
  styleUrls: ['./admin-login.component.css']
})
export class AdminLoginComponent {
  pin: string = '';
  errorMessage: string = '';
  isLoading: boolean = false;

  constructor(
    private adminAuthService: AdminAuthService,
    private router: Router
  ) {
    // Si déjà authentifié, rediriger vers presentation
    if (this.adminAuthService.isAuthenticated()) {
      this.router.navigate(['/presentation']);
    }
  }

  onSubmit(): void {
    if (!this.pin.trim()) {
      this.errorMessage = 'Veuillez saisir le code PIN';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    // Simuler un petit délai pour l'UX
    setTimeout(() => {
      if (this.adminAuthService.authenticate(this.pin)) {
        // Authentification réussie
        this.router.navigate(['/presentation']);
      } else {
        // Échec de l'authentification
        this.errorMessage = 'Code PIN incorrect';
        this.pin = '';
      }
      this.isLoading = false;
    }, 500);
  }

  onPinInput(): void {
    // Effacer le message d'erreur quand l'utilisateur tape
    if (this.errorMessage) {
      this.errorMessage = '';
    }
  }
}
