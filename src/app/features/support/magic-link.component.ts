import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './magic-link.component.html',
  styleUrls: ['./magic-link.component.css']
})
export class MagicLinkComponent {
  email = '';
  isLoading = false;
  loginError: string | null = null;
}