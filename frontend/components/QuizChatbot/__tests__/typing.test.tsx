import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import QuizChatbot from '../index';

const probes = vi.hoisted(() => ({ markdown: vi.fn(), generate: vi.fn() }));
vi.mock('@/features/tutor/api/tutorGateway', () => ({ generateTutorReply: probes.generate }));
vi.mock('react-markdown', () => ({ default: ({ children }: { children: string }) => {
  probes.markdown(children);
  return <div>{children}</div>;
} }));

function ControlledTutor() {
  const [open, setOpen] = useState(true);
  return <>
    <button type="button" onClick={() => setOpen(true)}>Open tutor</button>
    <QuizChatbot isVisible questionNumber={1} topicTitle="Algebra" question={{ question: 'Solve $x+1=3$' }}
      open={open} onOpenChange={setOpen} renderTrigger={() => null} />
  </>;
}

describe('embedded tutor typing and reopen', () => {
  it('keeps parsed replies stable while typing and retains draft/history on close', async () => {
    probes.generate.mockResolvedValue('Tutor reply: $x=2$');
    render(<ControlledTutor />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Explain' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await screen.findByText('Tutor reply: $x=2$');
    const parsed = probes.markdown.mock.calls.length;
    for (const value of ['W', 'Wh', 'Why', 'Why?']) fireEvent.change(screen.getByRole('textbox'), { target: { value } });
    expect(probes.markdown).toHaveBeenCalledTimes(parsed);
    fireEvent.click(screen.getByRole('button', { name: 'Back to quiz' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open tutor' }));
    expect(screen.getByRole('textbox')).toHaveValue('Why?');
    expect(screen.getByText('Tutor reply: $x=2$')).toBeInTheDocument();
    expect(probes.generate).toHaveBeenCalledTimes(1);
  });
});
