import { useState, type ReactNode } from 'react';
import { LogIn, Loader2, Mail, KeyRound, ShieldAlert, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import logo from '../assets/logo.png';

function AuthShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="absolute -left-24 bottom-0 w-80 h-80 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative text-xs font-bold tracking-[0.2em] uppercase text-sky-300">Portal do Cliente</div>
        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight max-w-md">Seus equipamentos sempre em dia, com o custo sob controle.</h2>
          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            <li>• Histórico de manutenções por equipamento</li>
            <li>• Alertas de manutenção preventiva por e-mail</li>
            <li>• Quanto você gasta com cada peça</li>
            <li>• Estoque sugerido e códigos de erro</li>
          </ul>
        </div>
        <div className="relative text-xs text-slate-500">© {new Date().getFullYear()} Laser Tools Componentes</div>
      </div>
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <img src={logo} alt="Laser Tools" className="w-56 object-contain" />
          </div>
          <div className="card p-6">{children}</div>
          {footer}
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const submit = async () => {
    setError('');
    setInfo('');
    if (!email.trim()) { setError('Informe seu e-mail.'); return; }
    setLoading(true);
    try {
      if (mode === 'login') {
        if (!password) { setError('Informe sua senha.'); return; }
        const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (e) setError('E-mail ou senha inválidos.');
      } else {
        const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin + window.location.pathname,
        });
        if (e) setError(e.message);
        else setInfo('Se este e-mail tiver acesso ao portal, você vai receber um link para criar uma nova senha.');
      }
    } finally {
      setLoading(false);
    }
  };

  const onEnter = (e: React.KeyboardEvent) => e.key === 'Enter' && submit();

  return (
    <AuthShell
      footer={
        <p className="text-xs text-slate-400 text-center mt-4">
          O acesso é liberado pela equipe Laser Tools. Ainda não tem? Fale com seu vendedor.
        </p>
      }
    >
      <h1 className="text-base font-bold text-slate-900 mb-1">
        {mode === 'login' ? 'Entrar no portal' : 'Recuperar senha'}
      </h1>
      <p className="text-sm text-slate-500 mb-5">
        {mode === 'login' ? 'Use o e-mail cadastrado na Laser Tools.' : 'Enviaremos um link para o seu e-mail.'}
      </p>

      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3 mb-4">{error}</div>}
      {info && <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3 mb-4">{info}</div>}

      <div className="space-y-3">
        <div>
          <label className="label">E-mail</label>
          <input type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onEnter} />
        </div>
        {mode === 'login' && (
          <div>
            <label className="label">Senha</label>
            <input type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={onEnter} />
          </div>
        )}
      </div>

      <button className="btn-primary w-full mt-5" disabled={loading} onClick={submit}>
        {loading ? <Loader2 size={16} className="animate-spin" /> : mode === 'login' ? <LogIn size={16} /> : <Mail size={16} />}
        {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Enviar link'}
      </button>

      <button
        className="w-full mt-3 text-xs text-slate-400 hover:text-slate-600 inline-flex items-center justify-center gap-1"
        onClick={() => { setMode(mode === 'login' ? 'forgot' : 'login'); setError(''); setInfo(''); }}
      >
        {mode === 'login' ? 'Esqueci minha senha' : <><ArrowLeft size={12} /> Voltar para o login</>}
      </button>
    </AuthShell>
  );
}

export function SetPassword({ kind, onDone }: { kind: 'invite' | 'recovery'; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setError('');
    if (password.length < 8) { setError('A senha precisa ter pelo menos 8 caracteres.'); return; }
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    setSaving(true);
    const { error: e } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (e) { setError(e.message); return; }
    window.history.replaceState(null, '', window.location.pathname);
    onDone();
  };

  return (
    <AuthShell>
      <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center mb-4">
        <KeyRound size={20} />
      </div>
      <h1 className="text-base font-bold text-slate-900 mb-1">
        {kind === 'invite' ? 'Bem-vindo ao Portal Laser Tools!' : 'Crie uma nova senha'}
      </h1>
      <p className="text-sm text-slate-500 mb-5">
        {kind === 'invite' ? 'Para começar, defina a senha que você vai usar para entrar.' : 'Escolha uma senha nova para sua conta.'}
      </p>
      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3 mb-4">{error}</div>}
      <div className="space-y-3">
        <div>
          <label className="label">Nova senha</label>
          <input type="password" autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <label className="label">Confirmar senha</label>
          <input type="password" autoComplete="new-password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
        </div>
      </div>
      <button className="btn-primary w-full mt-5" disabled={saving} onClick={save}>
        {saving ? <Loader2 size={16} className="animate-spin" /> : null}
        {saving ? 'Salvando...' : 'Salvar senha e entrar'}
      </button>
    </AuthShell>
  );
}

export function NoAccess({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-sm text-center">
        <ShieldAlert size={40} className="text-amber-500 mx-auto mb-4" />
        <h1 className="text-lg font-bold text-slate-900 mb-2">Acesso não liberado</h1>
        <p className="text-sm text-slate-500 mb-6">
          A conta <span className="font-medium text-slate-700">{email}</span> não está vinculada a nenhum cliente
          ou foi desativada. Fale com a equipe Laser Tools.
        </p>
        <button className="btn-secondary" onClick={onSignOut}>Sair</button>
      </div>
    </div>
  );
}
