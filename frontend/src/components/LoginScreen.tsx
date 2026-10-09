import { useState, type FormEvent } from 'react'
import { ArrowRight, KeyRound, ShieldCheck } from 'lucide-react'
import { ApiError, apiRequest, setAccessToken, type LoginResponse } from '../lib/api'
import './login.css'

interface LoginScreenProps {
  onAuthenticated: (displayName: string) => void
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'bootstrap'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [setupKey, setSetupKey] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsSubmitting(true)

    try {
      if (mode === 'bootstrap') {
        await apiRequest('/api/auth/bootstrap-admin', {
          method: 'POST',
          body: JSON.stringify({ setupKey, email, displayName, password }),
        })
        setNotice('Administrador configurado. Entre com o novo usuário.')
        setMode('login')
        setPassword('')
        setSetupKey('')
        return
      }

      const session = await apiRequest<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      setAccessToken(session.accessToken)
      onAuthenticated(session.displayName)
    } catch (requestError) {
      if (mode === 'bootstrap' && requestError instanceof ApiError && requestError.status === 401) {
        setError('Chave de configuração inválida ou administrador já configurado.')
      } else {
        setError(requestError instanceof Error ? requestError.message : 'Falha na autenticação.')
      }
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
          <h1>{mode === 'bootstrap' ? 'Configurar administrador' : 'Acesse o sistema'}</h1>
          <p>{mode === 'bootstrap' ? 'Crie a primeira conta administrativa autorizada. A chave de configuração é fornecida pelo responsável pela instalação; escolha sua própria senha.' : 'Entre com suas credenciais corporativas. Para obter uma conta, solicite acesso ao administrador da sua empresa.'}</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {mode !== 'login' && <label>Nome completo<input autoComplete="name" onChange={(event) => setDisplayName(event.target.value)} required value={displayName} /></label>}
          <label>E-mail corporativo<input autoComplete="username" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
          {mode === 'bootstrap' && <label>Chave de configuração<input autoComplete="off" onChange={(event) => setSetupKey(event.target.value)} required type="password" value={setupKey} /></label>}
          <label>Senha<input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? undefined : 8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />{mode !== 'login' && <small className="password-hint">Mínimo de 8 caracteres.</small>}</label>
          {error && <p className="login-alert error" role="alert">{error}</p>}
          {notice && <p className="login-alert success" role="status">{notice}</p>}
          <button className="login-submit" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Aguarde…' : mode === 'bootstrap' ? 'Criar administrador' : 'Entrar'}
            {mode === 'login' ? <ArrowRight size={17} /> : <KeyRound size={17} />}
          </button>
        </form>

        <button className="login-mode-toggle" disabled={isSubmitting} onClick={() => { setMode(mode === 'login' ? 'bootstrap' : 'login'); setError(''); setNotice('') }} type="button">
          {mode === 'login' ? 'Primeiro acesso: configurar administrador' : 'Voltar ao login'}
        </button>
        <div className="login-security"><span className="status-dot" /> Conexão protegida <span>·</span> Acesso auditável</div>
      </section>
      <aside className="login-side-note"><span>OBSERVAR</span><span>PREVENIR</span><span>EVOLUIR</span></aside>
    </main>
  )
}