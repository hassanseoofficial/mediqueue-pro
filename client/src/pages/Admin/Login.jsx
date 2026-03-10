import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../hooks/useQueueActions';
import { useQueueStore } from '../../store/queueStore';

const Login = () => {
    const navigate = useNavigate();
    const { setAuth } = useQueueStore();
    const [form, setForm] = useState({ email: 'admin@demo.com', password: 'password' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await authApi.login(form.email, form.password);
            setAuth(res.data.user, res.data.token);
            const role = res.data.user.role;
            if (role === 'doctor') navigate('/doctor');
            else navigate('/admin');
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a1040 0%, #0a0a0f 60%)' }}>
            <div className="w-full max-w-sm">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
                        style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
                        <span className="text-3xl">🏥</span>
                    </div>
                    <h1 className="text-2xl font-black text-white">MediQueue Pro</h1>
                    <p className="text-gray-500 text-sm mt-1">Smart Medical Queue System</p>
                </div>

                <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4">
                    <h2 className="text-lg font-bold text-white mb-2">Staff Login</h2>

                    {error && (
                        <div className="bg-red-900/50 border border-red-700 text-red-200 text-sm px-4 py-3 rounded-xl">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Email</label>
                        <input
                            type="email"
                            required
                            className="w-full bg-gray-900 text-white rounded-xl px-4 py-3 text-sm border border-gray-700 focus:border-blue-500 outline-none transition-colors"
                            value={form.email}
                            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Password</label>
                        <input
                            type="password"
                            required
                            className="w-full bg-gray-900 text-white rounded-xl px-4 py-3 text-sm border border-gray-700 focus:border-blue-500 outline-none transition-colors"
                            value={form.password}
                            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 rounded-xl font-black text-white text-sm tracking-wide transition-all disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', boxShadow: '0 4px 0 rgba(0,0,0,0.3)' }}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>

                    <div className="text-center">
                        <p className="text-xs text-gray-600">Demo: admin@demo.com / password</p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
