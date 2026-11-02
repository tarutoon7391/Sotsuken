// Issue #29：先生画面の確認エリアと生徒タイルに、確認の反応状況（反応済み／未反応）を出す
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../classes/ClassDetailPage.jsx', () => ({
  MaterialButton: () => null,
  fileKindLabel: () => '',
  useArmed: () => [null, vi.fn()],
}));

const { AttentionBadge, AttentionPanel } = await import('./TeachPanels.jsx');

const RESULT = {
  responded: [{ id: 11, name: '青木' }],
  pending: [
    { id: 12, name: '井上' },
    { id: 13, name: '上田' },
  ],
};

function renderPanel({ check, result }) {
  return render(
    <AttentionPanel isLive check={check} result={result} onIssue={vi.fn()} autoInterval={0} onAutoChange={vi.fn()} busy={false} />
  );
}

function runningCheck(id = 1) {
  const now = Date.now();
  return { check_id: id, issued_at: new Date(now).toISOString(), deadline_at: new Date(now + 60_000).toISOString(), auto: false };
}

describe('AttentionPanel：反応状況', () => {
  afterEach(() => cleanup());

  it('確認中に「反応済み ◯人 / 未反応 ◯人」を出し、「未反応」を押すと名前一覧が出る', () => {
    renderPanel({ check: runningCheck(), result: RESULT });
    expect(screen.getByText(/反応済み/).textContent.replace(/\s/g, '')).toBe('反応済み1人');
    const btn = screen.getByRole('button', { name: /未反応\s*2\s*人/ });
    expect(screen.queryByText('井上')).not.toBeInTheDocument(); // 確認中は既定で閉じている
    fireEvent.click(btn);
    expect(screen.getByText('井上')).toBeInTheDocument();
    expect(screen.getByText('上田')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByText('井上')).not.toBeInTheDocument();
  });

  it('次の確認が来たら、その回の状況に切り替わる（一覧も閉じた状態に戻る）', () => {
    const { rerender } = renderPanel({ check: runningCheck(1), result: RESULT });
    fireEvent.click(screen.getByRole('button', { name: /未反応/ }));
    expect(screen.getByText('井上')).toBeInTheDocument();

    const next = { responded: [], pending: [{ id: 14, name: '江藤' }] };
    rerender(
      <AttentionPanel isLive check={runningCheck(2)} result={next} onIssue={vi.fn()} autoInterval={0} onAutoChange={vi.fn()} busy={false} />
    );
    expect(screen.getByText(/反応済み/).textContent.replace(/\s/g, '')).toBe('反応済み0人');
    expect(screen.getByRole('button', { name: /未反応\s*1\s*人/ })).toBeInTheDocument();
    expect(screen.queryByText('井上')).not.toBeInTheDocument();
    expect(screen.queryByText('江藤')).not.toBeInTheDocument();
  });
});

describe('AttentionBadge：生徒タイルのバッジ', () => {
  afterEach(() => cleanup());

  it('未反応の生徒には「未反応」、反応済みの生徒にはチェックを出す', () => {
    render(<AttentionBadge userId={12} result={RESULT} />);
    expect(screen.getByText('未反応')).toBeInTheDocument();
    cleanup();
    render(<AttentionBadge userId={11} result={RESULT} />);
    expect(screen.getByLabelText('反応済み')).toHaveTextContent('✓');
  });

  it('確認を送っていない・対象外の生徒には何も出さない', () => {
    const { container, rerender } = render(<AttentionBadge userId={11} result={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<AttentionBadge userId={99} result={RESULT} />);
    expect(container).toBeEmptyDOMElement();
  });
});
