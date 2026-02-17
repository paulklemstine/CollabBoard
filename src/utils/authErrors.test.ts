import { describe, it, expect } from 'vitest';
import { getAuthErrorMessage } from './authErrors';

describe('getAuthErrorMessage', () => {
  it('translates invalid-credential error', () => {
    const error = new Error('Firebase: Error (auth/invalid-credential).');
    expect(getAuthErrorMessage(error)).toBe(
      'Invalid email or password. Please check your credentials and try again.'
    );
  });

  it('translates email-already-in-use error', () => {
    const error = new Error('Firebase: Error (auth/email-already-in-use).');
    expect(getAuthErrorMessage(error)).toBe(
      'This email is already registered. Please sign in or use a different email.'
    );
  });

  it('translates invalid-email error', () => {
    const error = new Error('Firebase: Error (auth/invalid-email).');
    expect(getAuthErrorMessage(error)).toBe(
      'Please enter a valid email address.'
    );
  });

  it('translates weak-password error', () => {
    const error = new Error('Firebase: Error (auth/weak-password).');
    expect(getAuthErrorMessage(error)).toBe(
      'Password is too weak. Please use at least 6 characters.'
    );
  });

  it('translates operation-not-allowed error', () => {
    const error = new Error('Firebase: Error (auth/operation-not-allowed).');
    expect(getAuthErrorMessage(error)).toBe(
      'This sign-in method is not enabled. Please contact support.'
    );
  });

  it('translates wrong-password error', () => {
    const error = new Error('Firebase: Error (auth/wrong-password).');
    expect(getAuthErrorMessage(error)).toBe(
      'Incorrect password. Please try again.'
    );
  });

  it('translates user-not-found error', () => {
    const error = new Error('Firebase: Error (auth/user-not-found).');
    expect(getAuthErrorMessage(error)).toBe(
      'No account found with this email. Please sign up first.'
    );
  });

  it('translates popup-closed-by-user error', () => {
    const error = new Error('Firebase: Error (auth/popup-closed-by-user).');
    expect(getAuthErrorMessage(error)).toBe(
      'Sign-in was cancelled. Please try again.'
    );
  });

  it('translates network-request-failed error', () => {
    const error = new Error('Firebase: Error (auth/network-request-failed).');
    expect(getAuthErrorMessage(error)).toBe(
      'Network error. Please check your internet connection and try again.'
    );
  });

  it('translates too-many-requests error', () => {
    const error = new Error('Firebase: Error (auth/too-many-requests).');
    expect(getAuthErrorMessage(error)).toBe(
      'Too many failed attempts. Please wait a few minutes and try again.'
    );
  });

  it('returns generic message for unknown error code', () => {
    const error = new Error('Firebase: Error (auth/unknown-error-code).');
    expect(getAuthErrorMessage(error)).toBe(
      'Unable to complete sign-in. Please try again or contact support.'
    );
  });

  it('returns generic message for non-Error object', () => {
    const error = { message: 'Not an Error object' };
    expect(getAuthErrorMessage(error)).toBe(
      'An unexpected error occurred. Please try again.'
    );
  });

  it('returns generic message for Error without auth code', () => {
    const error = new Error('Some random error message');
    expect(getAuthErrorMessage(error)).toBe(
      'Unable to complete sign-in. Please try again or contact support.'
    );
  });
});
