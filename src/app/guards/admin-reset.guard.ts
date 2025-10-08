import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AdminAuthService } from '../services/admin-auth.service';

@Injectable({
  providedIn: 'root'
})
export class AdminResetGuard implements CanActivate {

  constructor(
    private adminAuthService: AdminAuthService,
    private router: Router
  ) {}

  canActivate(): boolean {
    // Vérifier si l'utilisateur est authentifié comme admin
    if (this.adminAuthService.isAuthenticated()) {
      return true;
    }

    // Si pas authentifié, rediriger vers la page d'authentification admin
    console.warn('🚫 Tentative d\'accès à /reset sans authentification admin');
    this.router.navigate(['/admin-login']);
    return false;
  }
}