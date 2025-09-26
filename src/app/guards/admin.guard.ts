import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AdminAuthService } from '../services/admin-auth.service';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {

  constructor(
    private adminAuthService: AdminAuthService,
    private router: Router
  ) {}

  canActivate(): boolean {
    if (this.adminAuthService.isAuthenticated()) {
      return true;
    } else {
      // Rediriger vers la page de connexion admin
      this.router.navigate(['/admin-login']);
      return false;
    }
  }
}
