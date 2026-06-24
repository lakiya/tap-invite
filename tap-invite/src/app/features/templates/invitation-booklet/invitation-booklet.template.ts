import { Component, input, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RsvpButtonsComponent } from '../../guest-view/components/rsvp-buttons/rsvp-buttons.component';
import { TemplateContext, TemplateComponent } from '../template.types';

export type BookState = 'cover' | 'spread' | 'back';

@Component({
  selector: 'app-invitation-booklet-template',
  standalone: true,
  imports: [CommonModule, DatePipe, RsvpButtonsComponent],
  template: `<div class="ib-scene"><!-- pages added in Task 3 --></div>`,
  styleUrl: './invitation-booklet.template.css'
})
export class InvitationBookletTemplateComponent implements TemplateComponent {
  context = input.required<TemplateContext>();
  state = signal<BookState>('cover');

  private dragStartX = 0;
  private dragStartY = 0;

  navigate(direction: 'forward' | 'backward'): void {
    const s = this.state();
    if (direction === 'forward') {
      if (s === 'cover')  this.state.set('spread');
      if (s === 'spread') this.state.set('back');
    } else {
      if (s === 'back')   this.state.set('spread');
      if (s === 'spread') this.state.set('cover');
    }
  }

  onDragStart(e: TouchEvent | MouseEvent): void {
    this.dragStartX = e instanceof TouchEvent ? e.touches[0].clientX : e.clientX;
    this.dragStartY = e instanceof TouchEvent ? e.touches[0].clientY : e.clientY;
  }

  onDragEnd(e: TouchEvent | MouseEvent): void {
    const endX = e instanceof TouchEvent ? e.changedTouches[0].clientX : e.clientX;
    const endY = e instanceof TouchEvent ? e.changedTouches[0].clientY : e.clientY;
    const deltaX = endX - this.dragStartX;
    const deltaY = endY - this.dragStartY;
    if (Math.abs(deltaX) < 50 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    this.navigate(deltaX < 0 ? 'forward' : 'backward');
  }
}
