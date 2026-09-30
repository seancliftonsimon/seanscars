import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ updateDoc: vi.fn().mockResolvedValue(undefined), ref: { withConverter: vi.fn() } }));
vi.mock('../services/firebase', () => ({ auth: { currentUser: null }, db: {} }));
vi.mock('firebase/firestore', async (original) => ({
  ...await original<typeof import('firebase/firestore')>(),
  doc: vi.fn(() => mocks.ref),
  updateDoc: mocks.updateDoc,
  serverTimestamp: vi.fn(() => 'server-time'),
}));
import { savePieceTemplate } from './firestore';

describe('template persistence', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.ref.withConverter.mockReturnValue(mocks.ref); });
  it('updates just one production type and stamps metadata without overwriting season fields', async () => {
    const tasks = [{ key: 'lyrics', label: 'Draft lyrics' }];
    await savePieceTemplate('2027', 'song', tasks);
    expect(mocks.updateDoc).toHaveBeenCalledWith(mocks.ref, {
      'pieceTemplates.song': tasks, updatedAt: 'server-time', updatedBy: 'planner',
    });
  });
  it('propagates write failures so the editor can retain the draft and show an error', async () => {
    mocks.updateDoc.mockRejectedValueOnce(new Error('Offline'));
    await expect(savePieceTemplate('2027', 'song', [{ key: 'lyrics', label: 'Lyrics' }])).rejects.toThrow('Offline');
  });
});
