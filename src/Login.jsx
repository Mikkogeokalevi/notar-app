import React, { useState } from 'react';
import { auth } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import './App.css'; // Käytetään samoja tyylejä

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false); // Vaihtaa kirjautumisen ja rekisteröinnin välillä
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegistering) {
        // Luo uusi tunnus
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        // Kirjaudu sisään
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.error("Login error:", err);
      if (err.code === 'auth/invalid-credential') setError('Väärä sähköposti tai salasana.');
      else if (err.code === 'auth/email-already-in-use') setError('Sähköposti on jo käytössä.');
      else if (err.code === 'auth/weak-password') setError('Salasanan pitää olla vähintään 6 merkkiä.');
      else setError('Virhe: ' + err.message);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center', 
      alignItems: 'center',
      padding: '20px'
    }}>
      <div className="card-box" style={{maxWidth: '400px', width: '100%', textAlign: 'center'}}>
        <h2 style={{marginTop: 0}}>{isRegistering ? 'Luo tunnus' : 'Kirjaudu sisään 2'}</h2>
        <p style={{color: '#aaa', marginBottom: '20px'}}>Kärkölän Notar Oy</p>
        
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label style={{textAlign: 'left'}}>Sähköposti</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              placeholder="esim. posti@firma.fi"
            />
          </div>
          <div className="form-group">
            <label style={{textAlign: 'left'}}>Salasana</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              placeholder="******"
            />
          </div>

          {error && (
            <div style={{
              backgroundColor: 'rgba(211, 47, 47, 0.1)', 
              color: '#ff5252', 
              padding: '10px', 
              borderRadius: '6px', 
              marginBottom: '15px',
              border: '1px solid #d32f2f'
            }}>
              {error}
            </div>
          )}

          <button type="submit" className="save-btn" style={{width: '100%', padding: '15px'}}>
            {isRegistering ? 'Rekisteröidy' : 'Kirjaudu'}
          </button>
        </form>

        <div style={{marginTop: '20px', borderTop: '1px solid #444', paddingTop: '15px'}}>
          <button 
            onClick={() => { setIsRegistering(!isRegistering); setError(''); }} 
            className="back-btn" 
            style={{border: 'none', color: '#2196f3', textDecoration: 'underline'}}
          >
            {isRegistering ? 'Onko sinulla jo tunnus? Kirjaudu' : 'Eikö tunnusta? Rekisteröidy'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;