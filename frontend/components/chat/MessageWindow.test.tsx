import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MessageWindow } from './MessageWindow';

const messages = Array.from({ length: 55 }, (_, index) => `Message ${index + 1}`);
const renderMessage = (message: string, index: number) => <p key={index} data-testid="message">{index}: {message}</p>;

describe('long conversation navigation', () => {
  it('bounds mounted messages while keeping every older message and global index available', () => {
    render(<MessageWindow messages={messages}>{renderMessage}</MessageWindow>);
    expect(screen.getAllByTestId('message')).toHaveLength(20);
    expect(screen.getAllByTestId('message')[0]).toHaveTextContent('35: Message 36');
    fireEvent.click(screen.getByRole('button', { name: 'Earlier messages' }));
    expect(screen.getAllByTestId('message')[0]).toHaveTextContent('15: Message 16');
    fireEvent.click(screen.getByRole('button', { name: 'Earlier messages' }));
    expect(screen.getAllByTestId('message')).toHaveLength(15);
    expect(screen.getAllByTestId('message')[0]).toHaveTextContent('0: Message 1');
    expect(screen.getByRole('button', { name: 'Earlier messages' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Newer messages' }));
    expect(screen.getAllByTestId('message')[0]).toHaveTextContent('15: Message 16');
    fireEvent.click(screen.getByRole('button', { name: 'Latest messages' }));
    expect(screen.getAllByTestId('message')[19]).toHaveTextContent('54: Message 55');
  });

  it('shows a new reply even when an earlier window was open', () => {
    const { rerender } = render(<MessageWindow messages={messages}>{renderMessage}</MessageWindow>);
    fireEvent.click(screen.getByRole('button', { name: 'Earlier messages' }));
    rerender(<MessageWindow messages={[...messages, 'New reply']}>{renderMessage}</MessageWindow>);
    expect(screen.getAllByTestId('message')).toHaveLength(20);
    expect(screen.getAllByTestId('message')[19]).toHaveTextContent('55: New reply');
  });
});
