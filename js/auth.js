/* ==========================================================================
   NorthLane Logistics — Authentication (demo, LocalStorage based)
   Users live in LocalStorage ("nl_users"); the session in LocalStorage when
   "Remember me" is ticked, otherwise in sessionStorage.
   ========================================================================== */
(function () {
  const LX = (window.LX = window.LX || {});
  const U = LX.util, I = (n) => LX.icon(n);
  const users = () => LX.store.get('users', []);

  function goHome(user) {
    setTimeout(() => { location.href = U.param('next') || LX.session.home(user.role); }, 1100);
  }

  /* ---------------- Login ---------------- */
  function login() {
    const form = document.getElementById('loginForm');
    if (!form) return;
    form.setAttribute('novalidate', '');
    const current = LX.session.current();
    if (current) {
      const n = document.getElementById('loggedInNote');
      if (n) { n.classList.remove('hidden'); n.querySelector('span').innerHTML = 'You are signed in as <strong>' + U.esc(current.email) + '</strong>. <a class="text-primary" href="' + LX.session.home(current.role) + '">Go to dashboard</a> · <button type="button" class="text-primary" id="signOutBtn" style="font-weight:700">Sign out</button>'; }
      document.getElementById('signOutBtn').onclick = () => { LX.session.logout(); location.reload(); };
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!LX.validate(form)) return;
      const email = form.email.value.trim().toLowerCase();
      const pass = form.password.value;
      const btn = form.querySelector('[type="submit"]');
      btn.classList.add('is-loading');
      const role = form.role.value;
      setTimeout(() => {
        btn.classList.remove('is-loading');
        const list = users();
        let user = list.find((u) => u.email.toLowerCase() === email);
        if (user && user.password !== pass) {
          const f = form.password.closest('.field');
          f.classList.add('invalid');
          f.querySelector('.field-error').textContent = 'Incorrect password. Try again or reset it.';
          LX.toast('Sign-in failed', 'The password is incorrect.', 'error');
          return;
        }
        if (!user) {
          /* No registration needed: create the account on first sign-in so the dashboard shows the user's details */
          const handle = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
          const name = handle ? handle.replace(/\b\w/g, (c) => c.toUpperCase()) : 'New User';
          user = { name, company: '', email, phone: '', password: pass, role, createdAt: Date.now() };
          list.push(user);
          LX.store.set('users', list);
        }
        /* The selected role decides which dashboard opens */
        const session = Object.assign({}, user, { role });
        LX.session.login(session, form.remember.checked);
        LX.toast('Welcome, ' + session.name.split(' ')[0], 'Opening your ' + ROLE_LABEL[role] + ' dashboard…', 'success');
        goHome(session);
      }, 800);
    });
    /* Pre-select the role when a registered email is typed */
    form.email.addEventListener('change', () => {
      const u = users().find((x) => x.email.toLowerCase() === form.email.value.trim().toLowerCase());
      if (u && !form.role.value) { form.role.value = u.role; form.role.dispatchEvent(new Event('change')); }
    });
  }
  const ROLE_LABEL = { customer: 'customer', business: 'business', driver: 'driver', fleet: 'fleet manager', admin: 'admin' };

  /* ---------------- Social login (UI only) ---------------- */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-social]');
    if (b) location.href = '404.html';
  });

  /* ---------------- Register ---------------- */
  function register() {
    const form = document.getElementById('registerForm');
    if (!form) return;
    form.setAttribute('novalidate', '');
    const pass = form.password, meter = document.getElementById('strength'), label = document.getElementById('strengthLabel');
    const names = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
    pass.addEventListener('input', () => {
      const s = pass.value ? Math.max(1, LX.passwordScore(pass.value)) : 0;
      meter.dataset.score = s;
      label.textContent = pass.value ? 'Password strength: ' + names[s] : 'Use 8+ characters with a number, capital letter and symbol.';
    });
    const plan = U.param('plan');
    if (plan) form.role.value = 'business';
    /* Full name: letters only (any alphabet), plus space, hyphen, apostrophe and dot — digits and symbols are stripped as you type or paste */
    const nameInput = form.name;
    const NOT_NAME = /[^\p{L}\s'.-]/gu;
    const HAS_BAD = /[^\p{L}\s'.-]/u;
    const nameField = nameInput.closest('.field');
    const showNameError = (msg) => { nameField.classList.add('invalid'); nameField.querySelector('.field-error').textContent = msg; nameInput.setAttribute('aria-invalid', 'true'); };
    nameInput.addEventListener('input', () => {
      if (!HAS_BAD.test(nameInput.value)) return;
      const pos = nameInput.selectionStart - (nameInput.value.slice(0, nameInput.selectionStart).match(NOT_NAME) || []).length;
      nameInput.value = nameInput.value.replace(NOT_NAME, '');
      nameInput.setSelectionRange(pos, pos);
      showNameError('Name can contain letters only — numbers and symbols aren\'t allowed.');
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!LX.validate(form)) { LX.toast('Please check the form', 'Some fields need your attention.', 'error'); return; }
      if (!/^\p{L}[\p{L}\s'.-]*\p{L}\.?$/u.test(nameInput.value.trim()) || (nameInput.value.match(/\p{L}/gu) || []).length < 2) {
        showNameError('Please enter your full name using letters only.');
        nameInput.focus();
        LX.toast('Please check the form', 'Name can contain letters only.', 'error');
        return;
      }
      const email = form.email.value.trim().toLowerCase();
      if (users().some((u) => u.email.toLowerCase() === email)) {
        const f = form.email.closest('.field');
        f.classList.add('invalid');
        f.querySelector('.field-error').innerHTML = 'An account already exists. <a class="text-primary" href="login.html">Log in instead</a>';
        form.email.focus();
        return;
      }
      const role = form.role.value;
      const user = { name: form.name.value.trim(), company: form.company.value.trim(), email, phone: form.phone.value.trim(), password: form.password.value, role, createdAt: Date.now(), plan: plan || null };
      const list = users(); list.push(user); LX.store.set('users', list);
      const btn = form.querySelector('[type="submit"]');
      btn.classList.add('is-loading');
      setTimeout(() => {
        btn.classList.remove('is-loading');
        LX.session.login(user, true);
        LX.notify.add('Welcome aboard', 'Your ' + ROLE_LABEL[role] + ' account is ready.', 'success');
        LX.toast('Account created', 'Welcome aboard, ' + user.name.split(' ')[0] + '! Redirecting to your dashboard…', 'success');
        goHome(user);
      }, 900);
    });
  }

  /* ---------------- Forgot password ---------------- */
  function forgot() {
    const wrap = document.getElementById('forgotFlow');
    if (!wrap) return;
    const steps = Array.from(wrap.querySelectorAll('[data-step]'));
    const bars = document.querySelectorAll('.auth-steps i');
    let email = '', code = '';
    const show = (n) => {
      steps.forEach((s, i) => { s.hidden = i !== n; });
      bars.forEach((b, i) => b.classList.toggle('on', i <= n));
      const f = steps[n].querySelector('input');
      if (f) setTimeout(() => f.focus(), 50);
    };
    const f1 = document.getElementById('forgotEmail');
    [f1, document.getElementById('forgotCode'), document.getElementById('forgotReset')].forEach((f) => f.setAttribute('novalidate', ''));
    f1.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!LX.validate(f1)) return;
      email = f1.email.value.trim().toLowerCase();
      code = String(Math.floor(100000 + Math.random() * 899999));
      const btn = f1.querySelector('[type="submit"]'); btn.classList.add('is-loading');
      setTimeout(() => {
        btn.classList.remove('is-loading');
        document.getElementById('sentTo').textContent = email;
        LX.toast('Verification code sent', 'Demo mode — your code is ' + code + '.', 'info', 9000);
        show(1);
      }, 800);
    });
    const otp = Array.from(document.querySelectorAll('.otp input'));
    otp.forEach((inp, i) => {
      inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, '').slice(-1); if (inp.value && otp[i + 1]) otp[i + 1].focus(); });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !inp.value && otp[i - 1]) otp[i - 1].focus(); });
      inp.addEventListener('paste', (e) => { const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6); if (t.length) { e.preventDefault(); t.split('').forEach((c, k) => { if (otp[k]) otp[k].value = c; }); (otp[t.length] || otp[5]).focus(); } });
    });
    document.getElementById('forgotCode').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = otp.map((i) => i.value).join('');
      if (v !== code) { LX.toast('Incorrect code', 'Check the 6-digit code and try again.', 'error'); otp.forEach((i) => i.classList.add('shake')); return; }
      show(2);
    });
    document.getElementById('resendCode').addEventListener('click', () => { code = String(Math.floor(100000 + Math.random() * 899999)); LX.toast('New code sent', 'Demo mode — your code is ' + code + '.', 'info', 9000); });
    const f3 = document.getElementById('forgotReset');
    const meter = document.getElementById('strength');
    f3.password.addEventListener('input', () => { meter.dataset.score = f3.password.value ? Math.max(1, LX.passwordScore(f3.password.value)) : 0; });
    f3.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!LX.validate(f3)) return;
      const list = users();
      const u = list.find((x) => x.email.toLowerCase() === email);
      if (u) { u.password = f3.password.value; LX.store.set('users', list); }
      show(3);
      LX.toast('Password updated', 'You can now log in with your new password.', 'success');
    });
    show(0);
  }

  LX.ready(() => { login(); register(); forgot(); });
})();
