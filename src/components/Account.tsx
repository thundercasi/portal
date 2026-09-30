import { useEffect, useState } from 'react';
import { Mail, KeyRound, CheckCircle2 } from 'lucide-react';
import { supabase, type Me } from '../lib/supabase';
import { PageHeader, Field, Loading, ErrorText } from './ui';

export default function Account({ onSaved }: { onSaved: () => void }) {
  const [me, setMe] = useState<Me | null>(null);
  const [userId, setUserId] = useState('');
  const [fullName, setFullName] = useState('');
  const [emailOn, setEmailOn] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    (async () => {
      const [{ data }, { data: u }] = await Promise.all([supabase.rpc('portal_me'), supabase.auth.getUser()]);
      const m = ((data as Me[] | null) ?? [])[0] ?? null;
      setMe(m);
      setUserId(u.user?.id ?? '');
      setFullName(m?.full_name ?? '');
      setEmailOn(m?.email_notifications ?? true);
    })();
  }, []);

  const save = async () => {
    setError(''); setSaved(false);
    setSaving(true);
    const { error: e } = await supabase.from('customer_users')
      .update({ full_name: fullName.trim() || null, email_notifications: emailOn })
      .eq('user_id', userId);
    setSaving(false);
    if (e) { setError(e.message); return; }
    setSaved(true);
    onSaved();
  };

  const changePassword = async () => {
    setPwError(''); setPwMsg('');
    if (password.length < 8) { setPwError('A senha precisa ter pelo menos 8 caracteres.'); return; }
    if (password !== confirm) { setPwError('As senhas não coincidem.'); return; }
    const { error: e } = await supabase.auth.updateUser({ password });
    if (e) { setPwError(e.message); return; }
    setPassword(''); setConfirm('');
    setPwMsg('Senha alterada com sucesso.');
  };

  if (!me) return <Loading />;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Minha conta" subtitle={`${me.email} · ${me.customer_name}`} />

      <div className="card p-6 mb-5 space-y-4">
        <Field label="Seu nome">
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 cursor-pointer">
          <input type="checkbox" className="rounded mt-0.5" checked={emailOn} onChange={(e) => setEmailOn(e.target.checked)} />
          <div>
            <div className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Mail size={15} /> Receber alertas por e-mail</div>
            <div className="text-xs text-slate-500 mt-0.5">Manutenções preventivas a vencer ou atrasadas e garantias terminando. Os alertas continuam aparecendo no portal.</div>
          </div>
        </label>
        <ErrorText>{error}</ErrorText>
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-emerald-600 flex items-center gap-1"><CheckCircle2 size={15} /> Salvo</span>}
          <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <div className="text-sm font-bold text-slate-900 flex items-center gap-2"><KeyRound size={16} /> Trocar senha</div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Nova senha"><input type="password" autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Field label="Confirmar"><input type="password" autoComplete="new-password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
        </div>
        <ErrorText>{pwError}</ErrorText>
        {pwMsg && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3">{pwMsg}</p>}
        <div className="flex justify-end">
          <button className="btn-secondary" onClick={changePassword}>Alterar senha</button>
        </div>
      </div>
    </div>
  );
}
