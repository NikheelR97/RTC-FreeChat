import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function LoginView() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Clear error when switching modes
    const toggleMode = () => {
        setIsSignUp(!isSignUp);
        setError(null);
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isSignUp) {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { username } // Store username in metadata
                    }
                });
                if (error) throw error;
                if (data.user) {
                    // Create Profile manually if trigger fails (safe fallback)
                    await supabase.from('profiles').insert({
                        id: data.user.id,
                        username: username,
                        avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
                        status: 'online'
                    });
                }
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });
                if (error) throw error;
            }
            // Store will detect session change via listener (todo) or refresh
            window.location.reload();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex items-center justify-center bg-void">
            <div className="w-96 bg-gray-900/50 p-8 rounded-lg border border-white/10 backdrop-blur-md">
                <h2 className="text-2xl font-bold text-starlight mb-6 text-center">
                    {isSignUp ? 'Initialize Identity' : 'Resume Uplink'}
                </h2>

                {error && (
                    <div className="bg-red-500/20 text-red-400 p-3 rounded mb-4 text-sm border border-red-500/20">
                        {error}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                    {isSignUp && (
                        <div>
                            <label className="text-xs text-dust uppercase font-bold">Codename</label>
                            <input
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded p-2 text-starlight focus:border-nebula outline-none mt-1"
                                placeholder="Orbit"
                                required
                            />
                        </div>
                    )}

                    <div>
                        <label className="text-xs text-dust uppercase font-bold">Frequency (Email)</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded p-2 text-starlight focus:border-nebula outline-none mt-1"
                            placeholder="pilot@aether.net"
                            required
                        />
                    </div>

                    <div>
                        <label className="text-xs text-dust uppercase font-bold">Key (Password)</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded p-2 text-starlight focus:border-nebula outline-none mt-1"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-nebula hover:bg-nebula/80 text-void font-bold py-2 rounded transition-colors mt-4"
                    >
                        {loading ? 'Processing...' : (isSignUp ? 'Register' : 'Connect')}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-dust">
                    {isSignUp ? 'Already have an ID? ' : 'Need access? '}
                    <button
                        onClick={toggleMode}
                        className="text-nebula hover:underline font-bold"
                    >
                        {isSignUp ? 'Login' : 'Initialize'}
                    </button>
                </div>
            </div>
        </div>
    );
}
