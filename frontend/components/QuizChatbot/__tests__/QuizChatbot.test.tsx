import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import QuizChatbot from '../index';
import api from '@/lib/axios';
import type { QuizChatbotQuestion } from '../utils';
import { meowAIModel } from '@/lib/firebase/ai';

vi.mock('@/lib/firebase/ai', () => ({
  meowAIModel: { generateContent: vi.fn() },
  fallbackAIModel: { generateContent: vi.fn() },
}));

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
  it('routes Gemini through Firebase with quiz context, language and successful follow-up history', async () => {
    vi.mocked(meowAIModel.generateContent).mockResolvedValue({
      response: { text: () => 'Gemini tutor reply' },
    } as Awaited<ReturnType<typeof meowAIModel.generateContent>>);
    render(<QuizChatbot isVisible questionNumber={1} topicTitle="General Awareness" question={mockQuestion} />);
    fireEvent.click(screen.getByRole('button', { name: /Ask AI Tutor/i }));
    fireEvent.click(screen.getByRole('button', { name: /Selected model: o4-mini/i }));
    fireEvent.click(screen.getByRole('button', { name: /gemini-3.8-flash/i }));
    expect(screen.getByRole('button', { name: 'Selected model: gemini-3.8-flash' })).toHaveTextContent('gemini-3.8-flash');
    fireEvent.click(screen.getByRole('button', { name: 'हिंदी' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Explain this' } });
    fireEvent.click(screen.getByRole('button', { name: /Send message/i }));
    await screen.findByText('Gemini tutor reply');
    expect(api.post).not.toHaveBeenCalled();
    expect(meowAIModel.generateContent).toHaveBeenLastCalledWith(expect.objectContaining({
      systemInstruction: expect.stringContaining('Respond in Hindi'),
      contents: expect.arrayContaining([
        { role: 'user', parts: [{ text: expect.stringContaining('Correct answer: New Delhi') }] },
        { role: 'user', parts: [{ text: 'Explain this' }] },
      ]),
    }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Why?' } });
    fireEvent.click(screen.getByRole('button', { name: /Send message/i }));
    await waitFor(() => expect(meowAIModel.generateContent).toHaveBeenCalledTimes(2));
    expect(meowAIModel.generateContent).toHaveBeenLastCalledWith(expect.objectContaining({
      contents: expect.arrayContaining([
        { role: 'user', parts: [{ text: 'Explain this' }] },
        { role: 'model', parts: [{ text: 'Gemini tutor reply' }] },
        { role: 'user', parts: [{ text: 'Why?' }] },
      ]),
    }));
    await waitFor(() => expect(screen.getByRole('textbox')).not.toBeDisabled());
  });

  it('shows Firebase failures without silently switching to Azure', async () => {
    vi.mocked(meowAIModel.generateContent).mockRejectedValue(new Error('Gemini unavailable'));
    render(<QuizChatbot isVisible questionNumber={1} topicTitle="General Awareness" question={mockQuestion} />);
    fireEvent.click(screen.getByRole('button', { name: /Ask AI Tutor/i }));
    fireEvent.click(screen.getByRole('button', { name: /Selected model: o4-mini/i }));
    fireEvent.click(screen.getByRole('button', { name: /gemini-3.8-flash/i }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Explain this' } });
    fireEvent.click(screen.getByRole('button', { name: /Send message/i }));
    await screen.findByText('Gemini could not complete this request. Please try again, or select o4-mini to continue.');
    expect(screen.getByRole('alert')).toHaveTextContent('Gemini could not complete');
    expect(screen.getByText('Unable to respond')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).not.toBeDisabled();
    vi.mocked(meowAIModel.generateContent).mockResolvedValue({ response: { text: () => 'Recovered reply' } } as Awaited<ReturnType<typeof meowAIModel.generateContent>>);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Recovered reply');
    const payload = vi.mocked(meowAIModel.generateContent).mock.calls[1][0];
    expect(JSON.stringify(payload)).toContain('Explain this');
    expect(JSON.stringify(payload)).not.toContain('Gemini could not complete');
  });

  beforeEach(() => {
    vi.resetAllMocks();
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

    // Verify Model pill button "o4-mini"
    const modelPill = screen.getByRole('button', { name: /Selected model: o4-mini/i });
    expect(modelPill).toBeInTheDocument();
    expect(screen.getByText('o4-mini')).toBeInTheDocument();
    expect(modelPill).toHaveAttribute('aria-expanded', 'false');

    // Verify Send button (blue up-arrow)
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

  it('closes with Escape and restores focus and page scrolling', () => {
    render(<QuizChatbot isVisible questionNumber={1} topicTitle="General Awareness" question={mockQuestion} />);
    const trigger = screen.getByRole('button', { name: /Ask AI Tutor/i });
    trigger.focus();
    fireEvent.click(trigger);
    expect(document.body.style.overflow).toBe('hidden');
    expect(screen.getByRole('dialog')).toHaveFocus();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).not.toBe('hidden');
    expect(trigger).toHaveFocus();
  });

  it('renders numbered solution steps and only the latest follow-up group', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { reply: '## Method\n\n1. Read the question.\n2. Choose New Delhi.' } });
    render(<QuizChatbot isVisible questionNumber={1} topicTitle="General Awareness" question={mockQuestion} />);
    fireEvent.click(screen.getByRole('button', { name: /Ask AI Tutor/i }));
    fireEvent.click(screen.getByRole('button', { name: /Explain the step-by-step solution/i }));
    await screen.findByRole('heading', { name: 'Method' });
    expect(screen.getByText('Read the question.').closest('ol')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Explain again' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(screen.getAllByRole('heading', { name: 'Method' })).toHaveLength(2));
    expect(screen.getAllByText('Continue exploring')).toHaveLength(1);
    expect(screen.getByText('Q1 · General Awareness')).toBeInTheDocument();
  });
});
