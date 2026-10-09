import { useState, type FormEvent } from 'react'
import { ArrowRight, KeyRound, ShieldCheck } from 'lucide-react'
import { apiRequest, setAccessToken, type LoginResponse } from '../lib/api'
import './login.css'

interface LoginScreenProps {
  onAuthenticated: (displayName: string) => void
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'company'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsSubmitting(true)

    try {
      if (mode === 'company') {
        await apiRequest('/api/auth/register-company', {
          method: 'POST',
          body: JSON.stringify({ companyName, email, displayName, password }),
        })
        setNotice('Empresa cadastrada. Entre com seu e-mail e senha para gerenciar sua empresa.')
        setMode('login')
        setPassword('')
        return
      }

      const session = await apiRequest<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      setAccessToken(session.accessToken)
      onAuthenticated(session.displayName)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha na autenticação.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-shell">
      <div className="login-grain" />
      <section className="login-panel">
        <a className="login-brand" href="#login">
          <span className="brand-mark"><ShieldCheck size={22} /></span>
          <span><strong>IDS</strong><small>Segurança operacional</small></span>
        </a>

        <div className="login-heading">
          <span className="login-overline">ACESSO SEGURO</span>
          <h1>{mode === 'company' ? 'Cadastrar minha empresa' : 'Acesse o sistema'}</h1>
          <p>{mode === 'company' ? 'Crie sua empresa e sua conta de administrador. Você gerenciará apenas os usuários e dados da sua empresa.' : 'Entre com suas credenciais corporativas. Colaboradores devem solicitar acesso ao administrador da sua empresa.'}</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {mode === 'company' && <label>Nome da empresa<input autoComplete="organization" maxLength={120} onChange={(event) => setCompanyName(event.target.value)} required value={companyName} /></label>}
          {mode !== 'login' && <label>Nome completo<input autoComplete="name" maxLength={120} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} /></label>}
          <label>E-mail corporativo<input autoComplete="username" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
          <label>Senha<input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? undefined : 8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />{mode !== 'login' && <small className="password-hint">Mínimo de 8 caracteres.</small>}</label>
          {error && <p className="login-alert error" role="alert">{error}</p>}
          {notice && <p className="login-alert success" role="status">{notice}</p>}
          <button className="login-submit" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Aguarde…' : mode === 'company' ? 'Cadastrar empresa e administrador' : 'Entrar'}
            {mode === 'login' ? <ArrowRight size={17} /> : <KeyRound size={17} />}
          </button>
        </form>

        <button className="login-mode-toggle" disabled={isSubmitting} onClick={() => { setMode(mode === 'login' ? 'company' : 'login'); setPassword(''); setError(''); setNotice('') }} type="button">
          {mode === 'login' ? 'Sou gestor: cadastrar minha empresa' : 'Voltar ao login'}
        </button>
        <div className="login-security"><span className="status-dot" /> Conexão protegida <span>·</span> Acesso auditável</div>
      </section>
      <aside className="login-side-note"><span>OBSERVAR</span><span>PREVENIR</span><span>EVOLUIR</span></aside>
    </main>
  )
}