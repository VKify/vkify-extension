// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { extractNoteAuthor } from './author.js';

describe('saved note sender', () => {
  it('saves the sender avatar and id without selecting an attached photo', () => {
    const block = document.createElement('div');
    block.innerHTML = '<img src="https://example.com/attachment.jpg"><a class="ConvoMessageHeader__authorLink" href="/id42">Alice</a><div class="ConvoMessage__avatar"><img src="https://example.com/avatar.jpg"></div>';
    expect(extractNoteAuthor(block)).toEqual({ authorId: 42, authorPhoto: 'https://example.com/avatar.jpg' });
  });
  it('keeps community ids negative and supports sender attributes', () => {
    const block = document.createElement('div');
    block.innerHTML = '<a class="ConvoMessageHeader__authorLink" href="/club42">Community</a>';
    expect(extractNoteAuthor(block).authorId).toBe(-42);
    block.innerHTML = '';
    block.setAttribute('data-from-id', '12');
    expect(extractNoteAuthor(block).authorId).toBe(12);
  });
  it('leaves absent avatars undefined for API recovery rather than saving attachment thumbnails', () => {
    const block = document.createElement('div');
    block.innerHTML = '<img src="https://example.com/attachment.jpg">';
    expect(extractNoteAuthor(block).authorPhoto).toBeUndefined();
  });
});
