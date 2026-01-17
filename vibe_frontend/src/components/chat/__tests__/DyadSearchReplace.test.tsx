import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DyadSearchReplace } from '../DyadSearchReplace';

//Mock CodeHighlight (Theme dependency)
vi.mock('../CodeHighlight', () => ({
  CodeHighlight: ({ children }: { children: any }) => (
    <pre data-testid="code-highlight">{children}</pre>
  ),
}));

// Mock search/replace parser for deterministic tests
vi.mock('@/pro/shared/search_replace_parser', () => ({
  parseSearchReplaceBlocks: (content: string) => {
    if (content.includes('MULTI')) {
      return [
        {
          searchContent: 'const a = 1;',
          replaceContent: 'const a = 2;',
        },
        {
          searchContent: 'let x = 10;',
          replaceContent: 'let x = 20;',
        },
      ];
    }

    if (content.includes('SINGLE')) {
      return [
        {
          searchContent: 'foo',
          replaceContent: 'bar',
        },
      ];
    }

    return [];
  },
}));

describe('DyadSearchReplace Component', () => {
  it('should render without crashing', () => {
    render(<DyadSearchReplace />);
    expect(document.body).toBeTruthy();
  });

  it('should render raw code content when no search-replace blocks are present', () => {
    render(
      <DyadSearchReplace>
        {'const a = 1;'}
      </DyadSearchReplace>
    );

    expect(screen.queryByText('const a = 1;')).toBeTruthy();
  });

  it('should render parsed search and replace block when provided', () => {
    render(
      <DyadSearchReplace>
        {'SINGLE'}
      </DyadSearchReplace>
    );

    expect(screen.queryByText('Change 1')).toBeTruthy();
    expect(screen.queryByText(/Search/i)).toBeTruthy();
    expect(screen.queryByText(/Replace/i)).toBeTruthy();
  });

  it('should render multiple change blocks when multiple blocks are returned', () => {
    render(
      <DyadSearchReplace>
        {'MULTI'}
      </DyadSearchReplace>
    );

    expect(screen.queryByText('Change 1')).toBeTruthy();
    expect(screen.queryByText('Change 2')).toBeTruthy();
  });

  it('should not crash when children is empty', () => {
    render(<DyadSearchReplace>{''}</DyadSearchReplace>);
    expect(document.body).toBeTruthy();
  });
});
