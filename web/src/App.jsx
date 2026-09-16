import { useState, useCallback } from 'react';
import { useAuth } from './auth.jsx';
import { TopBar } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import SignOut from './pages/SignOut.jsx';
import MyTools from './pages/MyTools.jsx';
import ReturnTool from './pages/ReturnTool.jsx';
import FindTool from './pages/FindTool.jsx';
import ToolHistory from './pages/ToolHistory.jsx';
import Admin from './pages/Admin.jsx';
import Notifications from './pages/Notifications.jsx';

const PAGES = {
  home: { title: 'Tool Tracker', Comp: Home },
  signout: { title: 'Sign out tools', Comp: SignOut },
  mytools: { title: 'My tools', Comp: MyTools },
  return: { title: 'Return tool', Comp: ReturnTool },
  find: { title: 'Find a tool', Comp: FindTool },
  history: { title: 'Tool history', Comp: ToolHistory },
  admin: { title: 'Admin', Comp: Admin },
  notifications: { title: 'Notifications', Comp: Notifications },
};

export default function App() {
  const { user, loading, logout } = useAuth();
  const [stack, setStack] = useState([{ name: 'home', params: {} }]);

  const navigate = useCallback((name, params = {}) => {
    setStack((s) => [...s, { name, params }]);
  }, []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const reset = useCallback(() => setStack([{ name: 'home', params: {} }]), []);

  if (loading) return <div className="center">Loading…</div>;
  if (!user) return <Login />;

  const current = stack[stack.length - 1];
  const page = PAGES[current.name] || PAGES.home;
  const { Comp, title } = page;
  const overrideTitle = current.params.title || title;

  return (
    <div className="app">
      <TopBar
        title={overrideTitle}
        onBack={stack.length > 1 ? back : null}
        user={user}
        onLogout={logout}
      />
      <main className="content">
        <Comp params={current.params} navigate={navigate} back={back} reset={reset} user={user} />
      </main>
    </div>
  );
}
