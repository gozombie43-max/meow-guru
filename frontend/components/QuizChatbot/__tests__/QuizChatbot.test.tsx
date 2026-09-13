import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import QuizChatbot from '../index';
import api from '@/lib/axios';
import type { QuizChatbotQuestion } from '../utils';

vi.mock('@/lib/axios', () => ({
  default: {
    post: vi.fn(),
  },
  isAxiosError: vi.fn(() => false),
}));

const mockQuestion: QuizChatbotQuestion = {
  id: 'q1',
  question: 'What is the capital of India?',
  options: ['Mumbai', 'New Delhi', 'Kolkata', 'Chennai'],
  answer: 'New Delhi',
  solution: 'New Delhi is the capital.',
  concept: 'General Awareness',
};

describe('QuizChatbot Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders FAB trigger when closed', () => {
    render(
      <QuizChatbot
        isVisible={true}
        questionNumber={1}
        topicTitle="General Awareness"
        question={mockQuestion}
      />
    );

    const fab = screen.getByRole('button', { name: /Ask AI Tutor/i });
    expect(fab).toBeInTheDocument();
  });

  it('opens modal and renders new input card layout matching the new design', () => {
    render(
      <QuizChatbot
        isVisible={true}
        questionNumber={1}
        topicTitle="General Awareness"
        question={mockQuestion}
      />
    );

    // Open modal
    const fab = screen.getByRole('button', { name: /Ask AI Tutor/i });
    fireEvent.click(fab);

    // Verify modal title
    expect(screen.getByText('AI Tutor')).toBeInTheDocument();

    // Verify textarea placeholder "Ask anything"
    const textarea = screen.getByPlaceholderText('Ask anything');
    expect(textarea).toBeInTheDocument();

    // Verify Plus button
    const plusBtn = screen.getByRole('button', { name: /Quick prompts/i });
    expect(plusBtn).toBeInTheDocument();

    // Verify Chat and Cowork mode toggle
    const chatBtn = screen.getByRole('button', { name: /^Chat$/i });
    const coworkBtn = screen.getByRole('button', { name: /^Cowork$/i });
    expect(chatBtn).toBeInTheDocument();
    expect(coworkBtn).toBeInTheDocument();

    // Verify default active mode is Chat
    expect(chatBtn.className).toContain('active');
    expect(coworkBtn.className).not.toContain('active');

    // Toggle to Cowork mode
    fireEvent.click(coworkBtn);
    expect(coworkBtn.className).toContain('active');

    // Verify Model pill button "o4-mini"
    const modelPill = screen.getByRole('button', { name: /Selected model: o4-mini/i });
    expect(modelPill).toBeInTheDocument();
    expect(screen.getByText('o4-mini')).toBeInTheDocument();
    expect(screen.getByText('Azure AI')).toBeInTheDocument();

    // Verify Send button (terracotta up-arrow)
    const sendBtn = screen.getByRole('button', { name: /Send message/i });
    expect(sendBtn).toBeInTheDocument();
  });

  it('opens quick prompts menu on plus click and sends selected prompt', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { reply: 'Here is the step-by-step solution.' },
    });

    render(
      <QuizChatbot
        isVisible={true}
        questionNumber={1}
        topicTitle="General Awareness"
        question={mockQuestion}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Ask AI Tutor/i }));

    const plusBtn = screen.getByRole('button', { name: /Quick prompts/i });
    fireEvent.click(plusBtn);

    // Quick prompts popover header
    expect(screen.getByText('Quick Prompts')).toBeInTheDocument();

    // Click "Explain the step-by-step solution" from menu
    const stepByStepButtons = screen.getAllByRole('button', { name: /Explain the step-by-step solution/i });
    fireEvent.click(stepByStepButtons[stepByStepButtons.length - 1]);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/ai/tutor-chat',
        expect.objectContaining({
          message: 'Explain the step-by-step solution',
        }),
        expect.any(Object)
      );
    });
  });

  it('opens model selection menu and shows actual active model', () => {
    render(
      <QuizChatbot
        isVisible={true}
        questionNumber={1}
        topicTitle="General Awareness"
        question={mockQuestion}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Ask AI Tutor/i }));

    const modelPill = screen.getByRole('button', { name: /Selected model: o4-mini/i });
    fireEvent.click(modelPill);

    const menuHeader = screen.getByText('Active AI Model');
    expect(menuHeader).toBeInTheDocument();

    const modelMenu = menuHeader.closest('.tutor-model-menu') as HTMLElement;
    expect(modelMenu).toBeInTheDocument();

    // Verify actual model option inside the menu
    const modelOptions = screen.getAllByRole('button', { name: /o4-mini/i });
    const modelMenuItem = modelOptions.find((btn) => btn.className.includes('tutor-menu-item'));
    expect(modelMenuItem).toBeDefined();
    expect(modelMenuItem?.className).toContain('active');
    fireEvent.click(modelMenuItem!);

    // Verify model pill remains o4-mini
    expect(screen.getByRole('button', { name: /Selected model: o4-mini/i })).toBeInTheDocument();
  });

  it('types a custom question and submits with send button', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { reply: 'Detailed concept explanation.' },
    });

    render(
      <QuizChatbot
        isVisible={true}
        questionNumber={1}
        topicTitle="General Awareness"
        question={mockQuestion}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Ask AI Tutor/i }));

    const textarea = screen.getByPlaceholderText('Ask anything');
    fireEvent.change(textarea, { target: { value: 'Can you explain the history?' } });

    const sendBtn = screen.getByRole('button', { name: /Send message/i });
    expect(sendBtn).not.toBeDisabled();

    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/ai/tutor-chat',
        expect.objectContaining({
          message: 'Can you explain the history?',
          mode: 'chat',
        }),
        expect.any(Object)
      );
    });

    expect(textarea).toHaveValue('');
  });

  it('renders language toggle on header left and auto-syncs with activeLang="bn"', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { reply: 'বাংলায় সম্পূর্ণ সমাধান।' },
    });

    render(
      <QuizChatbot
        isVisible={true}
        questionNumber={1}
        topicTitle="সাধারণ জ্ঞান"
        question={mockQuestion}
        activeLang="bn"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Ask AI Tutor/i }));

    // Verify language toggle buttons exist
    const enBtn = screen.getByRole('button', { name: 'English' });
    const hiBtn = screen.getByRole('button', { name: 'हिंदी' });
    const bnBtn = screen.getByRole('button', { name: 'বাংলা' });
    expect(enBtn).toBeInTheDocument();
    expect(hiBtn).toBeInTheDocument();
    expect(bnBtn).toBeInTheDocument();

    // Verify active language is Bengali
    expect(bnBtn.className).toContain('active');
    expect(enBtn.className).not.toContain('active');

    // Verify Bengali localized placeholder
    const textarea = screen.getByPlaceholderText('যেকোনো প্রশ্ন জিজ্ঞাসা করুন');
    expect(textarea).toBeInTheDocument();

    // Submit question and verify lang: 'bn' sent in payload
    fireEvent.change(textarea, { target: { value: 'কীভাবে করব?' } });
    const sendBtn = screen.getByRole('button', { name: /Send message/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/ai/tutor-chat',
        expect.objectContaining({
          message: 'কীভাবে করব?',
          lang: 'bn',
        }),
        expect.any(Object)
      );
    });
  });

  it('allows user to switch language to Hindi interactively', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { reply: 'हिंदी में समाधान।' },
    });

    render(
      <QuizChatbot
        isVisible={true}
        questionNumber={1}
        topicTitle="General Awareness"
        question={mockQuestion}
        activeLang="en"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Ask AI Tutor/i }));

    const hiBtn = screen.getByRole('button', { name: 'हिंदी' });
    fireEvent.click(hiBtn);

    expect(hiBtn.className).toContain('active');

    // Verify Hindi localized placeholder
    const textarea = screen.getByPlaceholderText('कुछ भी पूछें');
    expect(textarea).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: 'शॉर्टकट बताएं' } });
    const sendBtn = screen.getByRole('button', { name: /Send message/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/ai/tutor-chat',
        expect.objectContaining({
          message: 'शॉर्टकट बताएं',
          lang: 'hi',
        }),
        expect.any(Object)
      );
    });
  });

  it('closes modal when holding down on header drag zone', async () => {
    vi.useFakeTimers();

    render(
      <QuizChatbot
        isVisible={true}
        questionNumber={1}
        topicTitle="General Awareness"
        question={mockQuestion}
      />
    );

    // Open modal
    fireEvent.click(screen.getByRole('button', { name: /Ask AI Tutor/i }));
    expect(screen.getByRole('dialog', { name: /AI Tutor/i })).toBeInTheDocument();

    const dragZone = screen.getByTitle('Hold or drag down to close');
    expect(dragZone).toBeInTheDocument();

    // Trigger pointer down (hold)
    fireEvent.pointerDown(dragZone, { clientY: 100, button: 0 });

    // Fast-forward hold timer (450ms) + close animation (220ms)
    act(() => {
      vi.advanceTimersByTime(750);
    });

    // Verify modal closes
    expect(screen.queryByRole('dialog', { name: /AI Tutor/i })).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('closes modal when dragging down on header past threshold', async () => {
    vi.useFakeTimers();

    render(
      <QuizChatbot
        isVisible={true}
        questionNumber={1}
        topicTitle="General Awareness"
        question={mockQuestion}
      />
    );

    // Open modal
    fireEvent.click(screen.getByRole('button', { name: /Ask AI Tutor/i }));
    const dialog = screen.getByRole('dialog', { name: /AI Tutor/i });
    expect(dialog).toBeInTheDocument();

    const dragZone = screen.getByTitle('Hold or drag down to close');

    // Pointer down at y=100
    fireEvent.pointerDown(dragZone, { clientY: 100, button: 0 });

    // Drag down to y=220 (deltaY = 120 > 70 threshold)
    fireEvent.pointerMove(dragZone, { clientY: 220 });

    // Pointer up
    fireEvent.pointerUp(dragZone, { clientY: 220 });

    // Fast-forward closing animation timer (220ms)
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByRole('dialog', { name: /AI Tutor/i })).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});
