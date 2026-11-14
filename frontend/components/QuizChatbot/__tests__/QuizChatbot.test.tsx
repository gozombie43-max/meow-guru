import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import QuizChatbot from '../index';
import api from '@/lib/axios';
import type { QuizChatbotQuestion } from '../utils';
import { meowAIModel } from '@/lib/firebase/ai';
import { GEMINI_TUTOR_MODEL, GEMINI_FALLBACK_MODEL } from '../gemini';
import { ensureFirebaseTutorAuth } from '@/lib/firebase/auth';

vi.mock('@/lib/firebase/auth', () => ({ ensureFirebaseTutorAuth: vi.fn() }));

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
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('routes Gemini through Firebase with quiz context, language and successful follow-up history', async () => {
    vi.mocked(meowAIModel.generateContent).mockResolvedValue({
      response: { text: () => 'Gemini tutor reply' },
    } as Awaited<ReturnType<typeof meowAIModel.generateContent>>);
    render(<QuizChatbot isVisible questionNumber={1} topicTitle="General Awareness" question={mockQuestion} activeLang="hi" />);
    fireEvent.click(screen.getByRole('button', { name: /Ask AI Tutor/i }));
    expect(screen.getByRole('button', { name: 'Selected model: o4-mini' })).toHaveTextContent('o4-mini');
    fireEvent.click(screen.getByRole('button', { name: 'Selected model: o4-mini' }));
    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(GEMINI_TUTOR_MODEL, 'i') }).find((btn) => btn.className.includes('tutor-menu-item'))!);
    expect(screen.getByRole('button', { name: `Selected model: ${GEMINI_TUTOR_MODEL}` })).toHaveTextContent(GEMINI_TUTOR_MODEL);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Explain this' } });
    fireEvent.click(screen.getByRole('button', { name: /Send message/i }));
    await screen.findByText('Gemini tutor reply');
    expect(ensureFirebaseTutorAuth).toHaveBeenCalledOnce();
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
    fireEvent.click(screen.getByRole('button', { name: 'Selected model: o4-mini' }));
    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(GEMINI_TUTOR_MODEL, 'i') }).find((btn) => btn.className.includes('tutor-menu-item'))!);
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
    expect(screen.getByText('AI Solution')).toBeInTheDocument();

    // Verify textarea placeholder "Ask anything"
    const textarea = screen.getByPlaceholderText('Ask anything');
    expect(textarea).toBeInTheDocument();

    // Verify Plus button
    const plusBtn = screen.getByRole('button', { name: /Quick prompts/i });
    expect(plusBtn).toBeInTheDocument();

    // Verify Model pill button defaults to o4-mini
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
      data: { success: true, reply: 'Here is the step-by-step solution.' },
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

    await screen.findByText('Here is the step-by-step solution.');
    expect(api.post).toHaveBeenCalled();
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

    // Verify active model option inside the menu
    const o4Option = screen.getAllByRole('button', { name: /o4-mini/i });
    const o4MenuItem = o4Option.find((btn) => btn.className.includes('tutor-menu-item'));
    expect(o4MenuItem).toBeDefined();
    expect(o4MenuItem?.className).toContain('active');

    // Switch to fallback model
    const fallbackOption = screen.getAllByRole('button', { name: new RegExp(GEMINI_FALLBACK_MODEL, 'i') });
    const fallbackMenuItem = fallbackOption.find((btn) => btn.className.includes('tutor-menu-item'));
    expect(fallbackMenuItem).toBeDefined();
    fireEvent.click(fallbackMenuItem!);

    // Verify model pill is updated
    expect(screen.getByRole('button', { name: new RegExp(`Selected model: ${GEMINI_FALLBACK_MODEL}`, 'i') })).toBeInTheDocument();
  });

  it('types a custom question and submits with send button with default o4-mini', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { success: true, reply: 'Detailed concept explanation.' },
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
          model: 'o4-mini',
        }),
        expect.any(Object)
      );
    });

    expect(textarea).toHaveValue('');
  });

  it('auto-syncs with activeLang="bn" without rendering a header language toggle', async () => {
    vi.mocked(meowAIModel.generateContent).mockResolvedValue({
      response: { text: () => 'বাংলায় সম্পূর্ণ সমাধান।' },
    } as Awaited<ReturnType<typeof meowAIModel.generateContent>>);

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

    // Verify header language toggle buttons are removed
    expect(screen.queryByRole('button', { name: 'Response language' })).not.toBeInTheDocument();

    // Verify Bengali localized placeholder
    const textarea = screen.getByPlaceholderText('যেকোনো প্রশ্ন জিজ্ঞাসা করুন');
    expect(textarea).toBeInTheDocument();

    // Switch to Gemini and submit question
    fireEvent.click(screen.getByRole('button', { name: 'Selected model: o4-mini' }));
    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(GEMINI_TUTOR_MODEL, 'i') }).find((btn) => btn.className.includes('tutor-menu-item'))!);
    fireEvent.change(textarea, { target: { value: 'কীভাবে করব?' } });
    const sendBtn = screen.getByRole('button', { name: /Send message/i });
    fireEvent.click(sendBtn);

    await screen.findByText('বাংলায় সম্পূর্ণ সমাধান।');
    expect(meowAIModel.generateContent).toHaveBeenCalledWith(expect.objectContaining({
      systemInstruction: expect.stringContaining('Bengali (বাংলা)'),
    }));
  });

  it('auto-syncs with activeLang="hi" when quiz language changes', async () => {
    vi.mocked(meowAIModel.generateContent).mockResolvedValue({
      response: { text: () => 'हिंदी में समाधान।' },
    } as Awaited<ReturnType<typeof meowAIModel.generateContent>>);

    render(
      <QuizChatbot
        isVisible={true}
        questionNumber={1}
        topicTitle="General Awareness"
        question={mockQuestion}
        activeLang="hi"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Ask AI Tutor/i }));

    // Verify Hindi localized placeholder
    const textarea = screen.getByPlaceholderText('कुछ भी पूछें');
    expect(textarea).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Selected model: o4-mini' }));
    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(GEMINI_TUTOR_MODEL, 'i') }).find((btn) => btn.className.includes('tutor-menu-item'))!);
    fireEvent.change(textarea, { target: { value: 'शॉर्टकट बताएं' } });
    const sendBtn = screen.getByRole('button', { name: /Send message/i });
    fireEvent.click(sendBtn);

    await screen.findByText('हिंदी में समाधान।');
    expect(meowAIModel.generateContent).toHaveBeenCalledWith(expect.objectContaining({
      systemInstruction: expect.stringContaining('Hindi (हिंदी)'),
    }));
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

  it('does not render theme toggle or back arrow in header and closes when clicking the backdrop', () => {
    render(<QuizChatbot isVisible questionNumber={1} topicTitle="General Awareness" question={mockQuestion} />);
    const trigger = screen.getByRole('button', { name: /Ask AI Tutor/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Toggle dark mode' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back to quiz' })).not.toBeInTheDocument();
    const backdrop = screen.getByRole('button', { name: 'Dismiss AI tutor' });
    fireEvent.click(backdrop);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders a corner close button in the header that closes the modal when clicked', () => {
    render(<QuizChatbot isVisible questionNumber={1} topicTitle="General Awareness" question={mockQuestion} />);
    const trigger = screen.getByRole('button', { name: /Ask AI Tutor/i });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    const closeBtn = screen.getByRole('button', { name: 'Close AI tutor' });
    expect(closeBtn.closest('header')).toBeInTheDocument();
    expect(dialog).toContainElement(closeBtn);
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders numbered solution steps and only the latest follow-up group', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, reply: '## Method\n\n1. Read the question.\n2. Choose New Delhi.' },
    });
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
