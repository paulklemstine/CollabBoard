import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ZoomControls } from './ZoomControls';

describe('ZoomControls', () => {
  it('renders zoom in, zoom out, and reset buttons', () => {
    render(
      <ZoomControls scale={1} onZoomIn={vi.fn()} onZoomOut={vi.fn()} onResetZoom={vi.fn()} />
    );

    expect(screen.getByTitle('Zoom in')).toBeInTheDocument();
    expect(screen.getByTitle('Zoom out')).toBeInTheDocument();
    expect(screen.getByTitle('Reset zoom')).toBeInTheDocument();
  });

  it('displays the current zoom percentage', () => {
    render(
      <ZoomControls scale={1.5} onZoomIn={vi.fn()} onZoomOut={vi.fn()} onResetZoom={vi.fn()} />
    );

    expect(screen.getByText('150%')).toBeInTheDocument();
  });

  it('calls onZoomIn when + button is clicked', () => {
    const onZoomIn = vi.fn();
    render(
      <ZoomControls scale={1} onZoomIn={onZoomIn} onZoomOut={vi.fn()} onResetZoom={vi.fn()} />
    );

    fireEvent.click(screen.getByTitle('Zoom in'));
    expect(onZoomIn).toHaveBeenCalledOnce();
  });

  it('calls onZoomOut when - button is clicked', () => {
    const onZoomOut = vi.fn();
    render(
      <ZoomControls scale={1} onZoomIn={vi.fn()} onZoomOut={onZoomOut} onResetZoom={vi.fn()} />
    );

    fireEvent.click(screen.getByTitle('Zoom out'));
    expect(onZoomOut).toHaveBeenCalledOnce();
  });

  it('calls onResetZoom when percentage is clicked', () => {
    const onResetZoom = vi.fn();
    render(
      <ZoomControls scale={2} onZoomIn={vi.fn()} onZoomOut={vi.fn()} onResetZoom={onResetZoom} />
    );

    fireEvent.click(screen.getByTitle('Reset zoom'));
    expect(onResetZoom).toHaveBeenCalledOnce();
  });

  it('rounds percentage to nearest integer', () => {
    render(
      <ZoomControls scale={0.333} onZoomIn={vi.fn()} onZoomOut={vi.fn()} onResetZoom={vi.fn()} />
    );

    expect(screen.getByText('33%')).toBeInTheDocument();
  });
});
