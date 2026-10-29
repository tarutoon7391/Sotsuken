// React コンポーネントの描画テスト（jsdom + testing-library の動作確認を兼ねる）
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RoleBadge from '../components/shared/RoleBadge';
import { ROLES } from '@sotsuken/shared/constants';

describe('RoleBadge', () => {
  it('先生はアクセント色', () => {
    render(<RoleBadge role={ROLES.TEACHER} />);
    const el = screen.getByText('先生');
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass('tag-accent');
  });
  it('生徒は通常色', () => {
    render(<RoleBadge role={ROLES.STUDENT} />);
    expect(screen.getByText('生徒')).toHaveClass('tag-neutral');
  });
});
