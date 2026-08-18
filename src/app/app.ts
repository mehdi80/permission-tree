import { Component, signal } from '@angular/core';
import { PermissionsPage } from "./features/permissions/permission-page";

@Component({
  selector: 'app-root',
  imports: [PermissionsPage],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('permition-tree');
}
