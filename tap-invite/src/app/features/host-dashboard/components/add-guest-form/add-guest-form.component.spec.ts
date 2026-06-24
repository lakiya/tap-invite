import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddGuestFormComponent } from './add-guest-form.component';
import { Supabase } from '../../../../core/services/supabase/supabase';

const mockSupabase = { addGuest: vi.fn().mockResolvedValue({}) };

describe('AddGuestFormComponent — validation', () => {
  let component: AddGuestFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddGuestFormComponent],
      providers: [{ provide: Supabase, useValue: mockSupabase }]
    }).compileComponents();
    const fixture = TestBed.createComponent(AddGuestFormComponent);
    component = fixture.componentInstance;
    component.eventId = 'test-event-id';
    fixture.detectChanges();
  });

  it('phoneError is null when phone is empty', () => {
    component.phone = '';
    component.validatePhone();
    expect(component.phoneError()).toBeNull();
  });

  it('phoneError is set when phone has invalid format', () => {
    component.phone = 'abc123';
    component.validatePhone();
    expect(component.phoneError()).toBeTruthy();
  });

  it('phoneError is null when phone has valid format', () => {
    component.phone = '+94 77 234 5678';
    component.validatePhone();
    expect(component.phoneError()).toBeNull();
  });

  it('emailError is null when email is empty', () => {
    component.email = '';
    component.validateEmail();
    expect(component.emailError()).toBeNull();
  });

  it('emailError is set when email format is invalid', () => {
    component.email = 'not-an-email';
    component.validateEmail();
    expect(component.emailError()).toBeTruthy();
  });

  it('emailError is null when email format is valid', () => {
    component.email = 'user@example.com';
    component.validateEmail();
    expect(component.emailError()).toBeNull();
  });

  it('canSubmit is true when name set, phone empty, email empty', () => {
    component.name = 'Priya';
    component.phone = '';
    component.email = '';
    expect(component.canSubmit()).toBe(true);
  });

  it('canSubmit is false when name set but phone has invalid format', () => {
    component.name = 'Priya';
    component.phone = 'bad';
    component.validatePhone();
    expect(component.canSubmit()).toBe(false);
  });
});
