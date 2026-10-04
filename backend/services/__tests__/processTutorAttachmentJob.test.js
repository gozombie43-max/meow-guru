import { beforeEach, expect, it, vi } from 'vitest';
const { getObject, extractAttachmentContext, tutorChat } = vi.hoisted(() => ({ getObject: vi.fn(), extractAttachmentContext: vi.fn(), tutorChat: vi.fn() }));
vi.mock('../../infrastructure/objectStorage.js', () => ({ getObject }));
vi.mock('../tutorExtraction.js', () => ({ extractAttachmentContext }));
vi.mock('../tutorChatService.js', () => ({ tutorChat }));
import { processTutorAttachmentJob } from '../processTutorAttachmentJob.js';
beforeEach(() => { vi.resetAllMocks(); extractAttachmentContext.mockResolvedValue({ text: 'Extracted' }); tutorChat.mockResolvedValue({ reply: 'Done' }); });
it('downloads raw bytes for extraction while keeping input metadata in Mongo', async () => {
  const bytes = Buffer.from('raw attachment'); getObject.mockResolvedValue(bytes);
  const input = { context: 'Maths', message: 'Help' };
  expect(await processTutorAttachmentJob({ attachmentKey: 'tutor-jobs/job/attachment', input, attachment: { mimetype: 'image/webp', originalname: 'q.webp' } })).toEqual({ reply: 'Done' });
  expect(getObject).toHaveBeenCalledWith('tutor-jobs/job/attachment');
  expect(extractAttachmentContext).toHaveBeenCalledWith({ mimetype: 'image/webp', originalname: 'q.webp', buffer: bytes });
  expect(tutorChat).toHaveBeenCalledWith(input, { text: 'Extracted' });
});
it('drains existing Base64 jobs during rollout', async () => {
  getObject.mockResolvedValue(Buffer.from(JSON.stringify({ input: { message: 'Old' }, file: { mimetype: 'application/pdf', data: Buffer.from('legacy bytes').toString('base64') } })));
  await processTutorAttachmentJob({ inputKey: 'tutor-jobs/old/input.json' });
  expect(extractAttachmentContext.mock.calls[0][0].buffer).toEqual(Buffer.from('legacy bytes'));
});
it('fails without invoking AI when download or extraction fails', async () => {
  getObject.mockRejectedValue(new Error('Storage unavailable'));
  await expect(processTutorAttachmentJob({ attachmentKey: 'job' })).rejects.toThrow('Storage unavailable');
  expect(tutorChat).not.toHaveBeenCalled();
});
