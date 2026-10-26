/**
 * Renderer 入口（I1 空壳；I4 实现四视图 + ⌘K + Console dock）
 * Token 唯一源 = docs/design/design-system/design-tokens.css（Tailwind v4 @theme）
 */
import { createRoot } from 'react-dom/client';

function Shell(): React.JSX.Element {
  return (
    <main className="shell">
      <h1>Corral</h1>
      <p>Daemon is starting — run <code>corral status</code> in a terminal.</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Shell />);
