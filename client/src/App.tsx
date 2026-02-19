import { useEffect } from 'react';
import { useGatewayStore } from './stores/gateway';
import { ServerList } from './components/ServerList';
import { ChannelList } from './components/ChannelList';
import { ChatView } from './components/ChatView';
import { LoginView } from './components/LoginView';

function App() {
  const { connect, connected } = useGatewayStore();

  useEffect(() => {
    connect();
  }, [connect]);

  if (!connected) {
    return <LoginView />;
  }

  return (
    <div className="flex h-screen w-screen bg-void text-starlight select-none overflow-hidden">
      {/* Title Bar (Mac-style inset) */}
      <div data-tauri-drag-region className="absolute top-0 left-0 w-full h-8 z-50" />

      {/* Main Layout */}
      <div className="flex w-full h-full pt-8">
        <ServerList />
        <ChannelList />
        <ChatView />
      </div>
    </div>
  );
}

export default App;
